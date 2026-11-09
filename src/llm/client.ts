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
type MessagesApi = Pick<Anthropic['messages'], 'stream'>;

export class ClaudeClient implements LlmClient {
  constructor(
    private readonly sdk: { messages: MessagesApi },
    readonly provider: 'anthropic' | 'foundry',
    readonly model: string,
  ) {}

  async generate(req: LlmRequest): Promise<LlmResult> {
    // Streaming, so a large max_tokens doesn't hit HTTP timeouts. The SDK parses the JSON when the
    // message ends and throws if it is cut off, so we note stop_reason from the stream events
    // first and turn a truncation/refusal into a clear error instead of a JSON parse failure.
    let stopReason: string | null = null;
    let message;
    let failure: Error | undefined;
    try {
      const stream = this.sdk.messages.stream({
        model: this.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
        // Structured outputs: the API constrains the answer to this JSON schema and the SDK
        // validates it with zod, so we get a typed object back instead of free text.
        output_config: { format: zodOutputFormat(GenerationSchema) },
      });
      stream.on('streamEvent', (event) => {
        if (event.type === 'message_delta') stopReason = event.delta.stop_reason;
      });
      message = await stream.finalMessage();
      stopReason = message.stop_reason;
    } catch (e) {
      failure = e as Error;
    }

    if (stopReason === 'max_tokens') {
      throw new LlmError('Відповідь обрізано (max_tokens). Попросіть менше варіантів.');
    }
    if (stopReason === 'refusal') {
      throw new LlmError('Модель відмовилася обробляти цей скрипт. Перевірте, чи немає в ньому забороненого контенту.');
    }
    if (!message) {
      throw new LlmError(`Запит до ${this.provider} не вдався: ${failure?.message ?? 'невідома помилка'}`);
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
