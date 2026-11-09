import { randomUUID } from 'node:crypto';
import * as z from 'zod';
import { ANGLE_IDS, DEFAULT_ANGLES, type Cta, type Variant, type WinnerAnalysis } from '../schema.js';
import { buildSystemPrompt, buildUserPrompt, distributeCounts } from '../prompt.js';
import type { LlmClient, LlmUsage } from '../llm/client.js';
import { estimateCostUsd } from '../llm/pricing.js';
import { avoidList, type LibraryEntry } from './library.js';
import { postprocess } from './postprocess.js';
import type { Rules } from './rules.js';

export const MAX_VARIANTS = 40;

export const GenerateInputSchema = z.object({
  script: z.string().trim().min(20, 'Paste the full winning script (at least the hook and the body).').max(20_000),
  count: z.coerce.number().int().min(1).max(MAX_VARIANTS).default(20),
  angles: z.array(z.enum(ANGLE_IDS)).min(1).default(DEFAULT_ANGLES),
  ctaCount: z.coerce.number().int().min(0).max(10).default(4),
});
export type GenerateInput = z.input<typeof GenerateInputSchema>;

export interface GenerateDeps {
  llm: LlmClient;
  brandFacts: string;
  rules: Rules;
  library: LibraryEntry[];
}

export interface GenerationResult {
  runId: string;
  createdAt: string;
  scriptTitle: string;
  provider: string;
  model: string;
  durationMs: number;
  usage: LlmUsage;
  costUsd: number | null;
  analysis: WinnerAnalysis;
  variants: Variant[];
  ctas: Cta[];
  stats: { requested: number; generated: number; ok: number; review: number; duplicate: number };
}

/** "Title: UGC lonely socks — winner" → "UGC lonely socks — winner"; falls back to the first line. */
export function scriptTitle(script: string): string {
  const firstLine = script.trim().split('\n')[0] ?? '';
  return firstLine.replace(/^title:\s*/i, '').slice(0, 120) || 'Untitled winner';
}

export async function generateVariants(input: GenerateInput, deps: GenerateDeps): Promise<GenerationResult> {
  const { script, count, angles, ctaCount } = GenerateInputSchema.parse(input);
  const plan = distributeCounts(count, angles);

  const system = buildSystemPrompt(deps.brandFacts, deps.rules.limits);
  const user = buildUserPrompt({ script, plan, ctaCount, avoid: avoidList(deps.library) });
  // A ceiling, not a target: you pay only for tokens actually produced. It must also cover the
  // model's thinking (on by default for current models), and Ukrainian copy takes more tokens per
  // character than English, so a tight per-variant estimate truncates the JSON mid-string.
  const maxTokens = 64_000;

  const started = Date.now();
  const res = await deps.llm.generate({ system, user, maxTokens });
  const durationMs = Date.now() - started;

  const { variants, ctas } = postprocess(res.output, {
    rules: deps.rules,
    library: deps.library,
    originalHook: res.output.winner_analysis.original_hook,
  });

  return {
    runId: randomUUID(),
    createdAt: new Date().toISOString(),
    scriptTitle: scriptTitle(script),
    provider: deps.llm.provider,
    model: res.model,
    durationMs,
    usage: res.usage,
    costUsd: estimateCostUsd(res.model, res.usage),
    analysis: res.output.winner_analysis,
    variants,
    ctas,
    stats: {
      requested: count,
      generated: variants.length,
      ok: variants.filter((v) => v.status === 'ok').length,
      review: variants.filter((v) => v.status === 'review').length,
      duplicate: variants.filter((v) => v.status === 'duplicate').length,
    },
  };
}
