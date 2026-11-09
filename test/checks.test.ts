import { describe, expect, it } from 'vitest';
import { checkClaims, checkHook, countChars, countWords } from '../src/core/claims.js';
import { similarity, normalize } from '../src/core/similarity.js';
import { realRules } from './helpers.js';

const rules = realRules();
const ids = (text: string) => checkClaims(text, 'first_line', rules).map((f) => f.ruleId);

describe('similarity', () => {
  it('normalizes punctuation, case and apostrophes', () => {
    expect(normalize("Hear that? That's IT!")).toBe('hear that thats it');
  });

  it('scores reworded copies as duplicates and different ideas low', () => {
    const dup = rules.similarity.duplicate;
    expect(similarity('Where do missing socks actually go?', 'Where do all the missing socks actually go?')).toBeGreaterThanOrEqual(dup);
    expect(similarity('Stop buying new socks.', 'Stop buying new socks. Seriously.')).toBeGreaterThanOrEqual(dup);
    expect(similarity('My dryer has been stealing my socks for years.', "You're not losing your mind. The dryer is taking your socks.")).toBeLessThan(rules.similarity.similar);
    expect(similarity('No more lonely socks', 'Retire the single sock')).toBeLessThan(rules.similarity.similar);
  });

  it('handles empty strings', () => {
    expect(similarity('', 'anything')).toBe(0);
  });
});

describe('claims', () => {
  it('flags health claims about magnets as high severity', () => {
    const flags = checkClaims('The magnet even helps circulation', 'first_line', rules);
    expect(flags).toContainEqual(expect.objectContaining({ ruleId: 'health', severity: 'high' }));
  });

  it('flags absolute promises, off-offer terms and fake urgency', () => {
    expect(ids('Never lose a sock again, guaranteed')).toContain('absolute');
    expect(ids('Get them free with a discount')).toContain('offer');
    expect(ids('Today only, hurry')).toContain('urgency');
  });

  it('allows the real offer numbers and flags invented ones', () => {
    expect(ids('Get your first 5 pairs for $29')).toEqual([]);
    expect(ids('I lost 47 socks')).toContain('number');
    expect(ids('Only $19 for 5 pairs')).toContain('price');
  });

  it('marks placeholders as info so they are filled before production', () => {
    const flags = checkClaims('[REAL REVIEW QUOTE] — and she means it', 'first_line', rules);
    expect(flags).toContainEqual(expect.objectContaining({ ruleId: 'placeholder', severity: 'info' }));
  });

  it('does not flag clean copy', () => {
    expect(ids('Laundry day is where my socks go to die.')).toEqual([]);
  });
});

describe('length limits', () => {
  it('counts emoji as one character and words by letters', () => {
    expect(countChars('Laundry hack ✅')).toBe(14);
    expect(countWords('Click — wash — done.')).toBe(3);
  });

  it('flags a spoken line that cannot fit in 3 seconds', () => {
    const flags = checkHook(
      { hookVisual: 'Shot', firstLine: 'one two three four five six seven eight nine ten eleven twelve thirteen', onScreenText: 'ok' },
      rules,
    );
    expect(flags).toContainEqual(expect.objectContaining({ ruleId: 'length', field: 'first_line' }));
  });
});
