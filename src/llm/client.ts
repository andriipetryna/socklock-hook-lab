import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { GenerationSchema, type Generation } from '../schema.js';

export interface LlmRequest {
  system: string;
  user: string;
  maxTokens: number;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmResult {
  output: Generation;
  usage: LlmUsage;
  model: string;
}

/** The only thing the app needs from a model. Tests swap in a fake. */
export interface LlmClient {
  readonly provider: string;
  readonly model: string;
  generate(req: LlmRequest): Promise<LlmResult>;
}

export class LlmError extends Error {}

/**
 * Works for both providers: `AnthropicFoundry` extends the `Anthropic` client and speaks the same
 * Messages API, so only the constructor differs (see ./index.ts).
 */
type MessagesApi = Pick<Anthropic['messages'], 'parse'>;

export class ClaudeClient implements LlmClient {
  constructor(
    private readonly sdk: { messages: MessagesApi },
    readonly provider: 'anthropic' | 'foundry',
    readonly model: string,
  ) {}

  async generate(req: LlmRequest): Promise<LlmResult> {
    let message;
    try {
      message = await this.sdk.messages.parse({
        model: this.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
        // Structured outputs: the API constrains the answer to this JSON schema and the SDK
        // validates it with zod, so we get a typed object back instead of free text.
        output_config: { format: zodOutputFormat(GenerationSchema) },
      });
    } catch (e) {
      throw new LlmError(`Запит до ${this.provider} не вдався: ${(e as Error).message}`);
    }

    if (message.stop_reason === 'max_tokens') {
      throw new LlmError('Відповідь обрізано (max_tokens). Попросіть менше варіантів.');
    }
    if (message.stop_reason === 'refusal') {
      throw new LlmError('Модель відмовилася обробляти цей скрипт. Перевірте, чи немає в ньому забороненого контенту.');
    }
    if (!message.parsed_output) {
      throw new LlmError('Модель не повернула структуровану відповідь.');
    }

    return {
      output: message.parsed_output,
      usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
      model: message.model,
    };
  }
}
