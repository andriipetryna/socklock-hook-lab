import { ANGLES, type AngleId } from './schema.js';
import type { Limits } from './core/rules.js';

export interface AnglePlan {
  angle: AngleId;
  count: number;
}

/** Spreads `total` variants as evenly as possible across the selected angles (remainder goes to the first ones). */
export function distributeCounts(total: number, angles: AngleId[]): AnglePlan[] {
  if (angles.length === 0) throw new Error('Select at least one angle');
  const base = Math.floor(total / angles.length);
  const remainder = total % angles.length;
  return angles
    .map((angle, i) => ({ angle, count: base + (i < remainder ? 1 : 0) }))
    .filter((p) => p.count > 0);
}

export function buildSystemPrompt(brandFacts: string, limits: Limits): string {
  return `You are a senior performance-creative strategist. You write MODIFICATIONS of winning Meta video ads (Reels, Stories, Feed) for a DTC subscription brand.

## What a modification is
- The team keeps the winning video as it is and replaces only the opening 1-3 seconds: the opening shot (hook_visual), the first spoken line (first_line) and the text overlay (on_screen_text).
- Everything after the hook stays unchanged. Every new opening must hand off naturally into the first line of the existing body and keep the same core promise, so viewers don't notice a seam.
- You may also be asked for alternative CTAs for the last seconds of the ad.

## How to work
1. Read the winning script and fill winner_analysis.
2. Write exactly the requested number of variants for each requested angle, in the order given. Put the angle id in "angle".
3. Write exactly the requested number of CTAs.

## Quality bar for every variant
- first_line: spoken in the first 3 seconds, max ${limits.firstLineMaxWords} words, sounds natural said out loud, US English.
- on_screen_text: max ${limits.onScreenMaxChars} characters including emoji, readable in one second, complements the spoken line instead of repeating it.
- hook_visual: one concrete shot a motion designer can make from the winner's existing footage or a simple re-shoot, max ${limits.hookVisualMaxWords} words.
- rationale: one short sentence on why it stops the scroll and how it hands off to the body.
- Variants must be meaningfully different from the original hook, from each other and from the "already used" list: change the opening image or the sentence structure, not just synonyms.
- Use only facts from the brand facts below. When proof is needed, write a [PLACEHOLDER] instead of inventing it.

## CTA rules
- spoken: max ${limits.ctaSpokenMaxWords} words; on_screen_text: max ${limits.ctaOnScreenMaxChars} characters.
- Invite people to take the quiz. Mention the offer only exactly as stated in the brand facts.

## Brand facts and hard rules
<brand_facts>
${brandFacts.trim()}
</brand_facts>

Return only JSON that matches the schema.`;
}

export interface UserPromptInput {
  script: string;
  plan: AnglePlan[];
  ctaCount: number;
  avoid: string[];
}

export function buildUserPrompt({ script, plan, ctaCount, avoid }: UserPromptInput): string {
  const angleLines = plan
    .map((p) => {
      const def = ANGLES.find((a) => a.id === p.angle)!;
      return `- ${p.angle} × ${p.count}: ${def.brief}`;
    })
    .join('\n');

  const avoidBlock = avoid.length
    ? `## Already used hooks — do not repeat or paraphrase closely\n${avoid.map((a) => `- ${a}`).join('\n')}\n\n`
    : '';

  return `## Winning ad script
<winner_script>
${script.trim()}
</winner_script>

## Variants to write
${angleLines}

## CTAs to write
${ctaCount}

${avoidBlock}Write the modifications now.`;
}
