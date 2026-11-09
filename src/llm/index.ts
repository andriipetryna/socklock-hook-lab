import Anthropic from '@anthropic-ai/sdk';
import { AnthropicFoundry, type FoundryClientOptions } from '@anthropic-ai/foundry-sdk';
import type { AppConfig } from '../config.js';
import { ClaudeClient, type LlmClient } from './client.js';

export { LlmError, type LlmClient } from './client.js';

/** What is missing to call the configured provider, or null when ready. */
export function providerProblem(cfg: AppConfig): string | null {
  if (cfg.provider === 'anthropic') {
    return cfg.anthropic.apiKey ? null : 'не задано ANTHROPIC_API_KEY. Скопіюйте .env.example у .env і додайте ключ.';
  }
  if (!cfg.foundry.apiKey) return 'не задано ANTHROPIC_FOUNDRY_API_KEY (Foundry portal → деплоймент → Details → Key).';
  if (!cfg.foundry.resource && !cfg.foundry.baseUrl) return 'задайте ANTHROPIC_FOUNDRY_RESOURCE або ANTHROPIC_FOUNDRY_BASE_URL.';
  if (cfg.foundry.resource && cfg.foundry.baseUrl) return 'задайте щось одне: ANTHROPIC_FOUNDRY_RESOURCE або ANTHROPIC_FOUNDRY_BASE_URL.';
  return null;
}

export function createLlmClient(cfg: AppConfig): LlmClient {
  const problem = providerProblem(cfg);
  if (problem) throw new Error(problem);

  if (cfg.provider === 'foundry') {
    // Pass exactly one of resource / baseURL; `null` stops the SDK from also reading the other one from env.
    const opts: FoundryClientOptions = cfg.foundry.baseUrl
      ? { apiKey: cfg.foundry.apiKey, baseURL: cfg.foundry.baseUrl, resource: null }
      : { apiKey: cfg.foundry.apiKey, resource: cfg.foundry.resource };
    return new ClaudeClient(new AnthropicFoundry(opts), 'foundry', cfg.model);
  }

  return new ClaudeClient(new Anthropic({ apiKey: cfg.anthropic.apiKey, baseURL: cfg.anthropic.baseUrl }), 'anthropic', cfg.model);
}
