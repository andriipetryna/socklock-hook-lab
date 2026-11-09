import type { CopyField, Flag } from '../schema.js';
import type { Rules } from './rules.js';

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });

export function countChars(text: string): number {
  return [...graphemes.segment(text)].length;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Copy checks that apply to anything the viewer hears or reads. */
export function checkClaims(text: string, field: CopyField, rules: Rules): Flag[] {
  const flags: Flag[] = [];

  for (const rule of rules.rules) {
    rule.regex.lastIndex = 0;
    const matches = [...text.matchAll(rule.regex)].map((m) => m[0]);
    if (matches.length) {
      flags.push({ ruleId: rule.id, severity: rule.severity, label: rule.label, field, match: [...new Set(matches)].join(', '), hint: rule.hint });
    }
  }

  // Prices: only the real offer price may appear.
  for (const m of text.matchAll(/\$\s?(\d+(?:[.,]\d+)?)/g)) {
    if (!rules.allowedNumbers.has(m[1]!)) {
      flags.push({ ruleId: 'price', severity: 'high', label: 'Неправильна ціна', field, match: m[0], hint: 'Єдина ціна в оферті — $29 за 5 пар.' });
    }
  }

  // Other numbers: likely an invented statistic unless it is part of the offer.
  const numbers = [...text.matchAll(/(?<![$\d.,])(\d+(?:[.,]\d+)?)(?![\d])/g)]
    .map((m) => m[1]!)
    .filter((n) => !rules.allowedNumbers.has(n));
  if (numbers.length) {
    flags.push({ ruleId: 'number', severity: 'medium', label: 'Неперевірене число', field, match: [...new Set(numbers)].join(', '), hint: 'Це число справжнє? Якщо ні, приберіть його або поставте [PLACEHOLDER].' });
  }

  const placeholders = text.match(/\[[^\]]+\]/g);
  if (placeholders) {
    flags.push({ ruleId: 'placeholder', severity: 'info', label: 'Плейсхолдер', field, match: placeholders.join(', '), hint: 'Заповніть реальними даними перед продакшном.' });
  }

  return flags;
}

function lengthFlag(field: CopyField, actual: number, max: number, unit: 'words' | 'chars'): Flag | null {
  if (actual <= max) return null;
  return {
    ruleId: 'length',
    severity: 'medium',
    label: 'Задовго',
    field,
    match: `${actual} ${unit === 'words' ? 'слів' : 'символів'} (макс. ${max})`,
    hint: unit === 'words' ? 'Має вміститися в перші 3 секунди.' : 'Має читатися за одну секунду.',
    limit: { actual, max, unit },
  };
}

export interface HookCopy {
  hookVisual: string;
  firstLine: string;
  onScreenText: string;
}

export function checkHook(v: HookCopy, rules: Rules): Flag[] {
  const { limits } = rules;
  return [
    ...checkClaims(v.firstLine, 'first_line', rules),
    ...checkClaims(v.onScreenText, 'on_screen_text', rules),
    lengthFlag('first_line', countWords(v.firstLine), limits.firstLineMaxWords, 'words'),
    lengthFlag('on_screen_text', countChars(v.onScreenText), limits.onScreenMaxChars, 'chars'),
    lengthFlag('hook_visual', countWords(v.hookVisual), limits.hookVisualMaxWords, 'words'),
  ].filter((f): f is Flag => f !== null);
}

export function checkCta(c: { spoken: string; onScreenText: string }, rules: Rules): Flag[] {
  const { limits } = rules;
  return [
    ...checkClaims(c.spoken, 'spoken', rules),
    ...checkClaims(c.onScreenText, 'on_screen_text', rules),
    lengthFlag('spoken', countWords(c.spoken), limits.ctaSpokenMaxWords, 'words'),
    lengthFlag('on_screen_text', countChars(c.onScreenText), limits.ctaOnScreenMaxChars, 'chars'),
  ].filter((f): f is Flag => f !== null);
}
