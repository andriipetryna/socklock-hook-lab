import { existsSync } from 'node:fs';
import * as z from 'zod';

/** Loads .env into process.env if it exists (built into Node >= 20.12, no dotenv needed). */
export function loadDotEnv(path = '.env'): void {
  if (existsSync(path)) process.loadEnvFile(path);
}

// "KEY=" in .env gives an empty string; treat it as "not set".
const optional = z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().optional());

const EnvSchema = z.object({
  LLM_PROVIDER: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['anthropic', 'foundry']).default('anthropic')),
  LLM_MODEL: optional,
  ANTHROPIC_API_KEY: optional,
  ANTHROPIC_BASE_URL: optional,
  ANTHROPIC_FOUNDRY_API_KEY: optional,
  ANTHROPIC_FOUNDRY_RESOURCE: optional,
  ANTHROPIC_FOUNDRY_BASE_URL: optional,
  PORT: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().positive().default(3000)),
  BRAND_PATH: optional,
  LIBRARY_PATH: optional,
  RULES_PATH: optional,
  LOG_PATH: optional,
});

export interface AppConfig {
  provider: 'anthropic' | 'foundry';
  /** Model ID (Anthropic) or deployment name (Foundry). */
  model: string;
  anthropic: { apiKey?: string; baseUrl?: string };
  foundry: { apiKey?: string; resource?: string; baseUrl?: string };
  port: number;
  paths: { brand: string; library: string; rules: string; log: string };
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid .env: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  const e = parsed.data;
  return {
    provider: e.LLM_PROVIDER,
    model: e.LLM_MODEL ?? 'claude-sonnet-5-5',
    anthropic: { apiKey: e.ANTHROPIC_API_KEY, baseUrl: e.ANTHROPIC_BASE_URL },
    foundry: { apiKey: e.ANTHROPIC_FOUNDRY_API_KEY, resource: e.ANTHROPIC_FOUNDRY_RESOURCE, baseUrl: e.ANTHROPIC_FOUNDRY_BASE_URL },
    port: e.PORT,
    paths: {
      brand: e.BRAND_PATH ?? 'brand/socklock.md',
      library: e.LIBRARY_PATH ?? 'data/hooks_library.csv',
      rules: e.RULES_PATH ?? 'config/claims-rules.json',
      log: e.LOG_PATH ?? 'logs/runs.jsonl',
    },
  };
}
