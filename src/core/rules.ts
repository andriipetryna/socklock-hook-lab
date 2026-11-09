import { readFileSync } from 'node:fs';
import * as z from 'zod';

const RulesFileSchema = z.object({
  limits: z.object({
    firstLineMaxWords: z.number().int().positive(),
    onScreenMaxChars: z.number().int().positive(),
    hookVisualMaxWords: z.number().int().positive(),
    ctaSpokenMaxWords: z.number().int().positive(),
    ctaOnScreenMaxChars: z.number().int().positive(),
  }),
  similarity: z.object({
    duplicate: z.number().min(0).max(1),
    similar: z.number().min(0).max(1),
  }),
  allowedNumbers: z.array(z.string()),
  rules: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(['high', 'medium', 'info']),
      label: z.string(),
      pattern: z.string(),
      hint: z.string(),
    }),
  ),
});

export type RulesFile = z.infer<typeof RulesFileSchema>;
export type Limits = RulesFile['limits'];

export interface CompiledRule {
  id: string;
  severity: 'high' | 'medium' | 'info';
  label: string;
  regex: RegExp;
  hint: string;
}

export interface Rules {
  limits: Limits;
  similarity: RulesFile['similarity'];
  allowedNumbers: Set<string>;
  rules: CompiledRule[];
}

export function compileRules(file: RulesFile): Rules {
  return {
    limits: file.limits,
    similarity: file.similarity,
    allowedNumbers: new Set(file.allowedNumbers),
    rules: file.rules.map((r) => {
      try {
        return { id: r.id, severity: r.severity, label: r.label, hint: r.hint, regex: new RegExp(r.pattern, 'gi') };
      } catch (e) {
        throw new Error(`Rule "${r.id}" has an invalid regex: ${(e as Error).message}`);
      }
    }),
  };
}

export function loadRules(path: string): Rules {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const parsed = RulesFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid rules file ${path}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  return compileRules(parsed.data);
}
