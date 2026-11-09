import type { LlmUsage } from './client.js';

/**
 * USD per million tokens (standard rates, platform.claude.com/docs/en/about-claude/pricing, Nov 2026).
 * Foundry bills the same per-token rates through Azure Marketplace.
 * Matched by substring so a Foundry deployment called e.g. "claude-sonnet-5-5-prod" still resolves.
 */
const PRICES: Array<{ match: string; input: number; output: number }> = [
  { match: 'sonnet-5-5', input: 2, output: 10 },
  { match: 'opus-5-5', input: 4, output: 20 },
  { match: 'haiku-5-5', input: 0.1, output: 0.5 }, // prompts up to 100k tokens
  { match: 'sonnet-5', input: 2, output: 10 },
  { match: 'opus-5', input: 5, output: 25 },
];

export function estimateCostUsd(model: string, usage: LlmUsage): number | null {
  const price = PRICES.find((p) => model.includes(p.match));
  if (!price) return null;
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
}
