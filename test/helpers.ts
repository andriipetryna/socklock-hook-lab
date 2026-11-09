import { readFileSync } from 'node:fs';
import { compileRules, type Rules } from '../src/core/rules.js';
import type { Generation } from '../src/schema.js';
import type { LlmClient, LlmRequest, LlmResult } from '../src/llm/client.js';

export function realRules(): Rules {
  return compileRules(JSON.parse(readFileSync('config/claims-rules.json', 'utf8')));
}

export const sampleGeneration: Generation = {
  winner_analysis: {
    original_hook: 'This is every sock I lost last year. Then I found these.',
    core_promise: 'Pairs stay together in the wash thanks to a tiny magnet in the cuff.',
    body_starts_with: "There's a tiny magnet in the cuff.",
    keep_unchanged: 'Product, proof and CTA scenes.',
  },
  variants: [
    { angle: 'pain', hook_visual: 'Creator holds one sock up to camera, deadpan.', first_line: 'Laundry day is where my socks go to die.', on_screen_text: 'RIP, left sock', rationale: 'Relatable loss.' },
    { angle: 'curiosity', hook_visual: 'Detective zooms into the drum.', first_line: 'Where do all the missing socks actually go?', on_screen_text: 'Case closed?', rationale: 'Open loop.' },
    { angle: 'Contrarian', hook_visual: 'Creator tosses a pack of new socks in the bin.', first_line: 'Your sock drawer is lying to you, guaranteed.', on_screen_text: 'Pairs stay pairs', rationale: 'Bold claim.' },
    { angle: 'ugc', hook_visual: 'Creator taps the cuffs together.', first_line: 'I lost 47 socks before I found these.', on_screen_text: 'Click = no more lonely socks', rationale: 'Specific story.' },
    { angle: 'pain', hook_visual: 'Same deadpan shot.', first_line: 'Laundry day is where my socks go to die!', on_screen_text: 'RIP left sock', rationale: 'Dup.' },
  ],
  ctas: [
    { spoken: 'Take the quick quiz and get your first 5 pairs for $29.', on_screen_text: '5 pairs for $29 → quiz' },
    { spoken: 'Grab them free today only!', on_screen_text: 'Free today only' },
  ],
};

export class FakeLlm implements LlmClient {
  readonly provider = 'fake';
  readonly model = 'claude-sonnet-5-5';
  calls: LlmRequest[] = [];
  constructor(private readonly output: Generation = sampleGeneration) {}
  async generate(req: LlmRequest): Promise<LlmResult> {
    this.calls.push(req);
    return { output: structuredClone(this.output), usage: { inputTokens: 5000, outputTokens: 2500 }, model: this.model };
  }
}
