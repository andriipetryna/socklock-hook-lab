/**
 * Lexical near-duplicate detection.
 *
 * We compare strings with the Sørensen–Dice coefficient over character trigrams:
 *   dice = 2 · |A ∩ B| / (|A| + |B|)
 * where A and B are multisets of 3-character chunks of the normalized text.
 * It is cheap, deterministic and explainable, and catches reworded copies
 * ("Where do missing socks go?" vs "Where do all the missing socks actually go?").
 * It does NOT catch the same idea in different words — that needs embeddings (next iteration).
 */

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // accents
    .replace(/[’']/g, '') // don't -> dont
    .replace(/[^a-z0-9\s]/g, ' ') // punctuation, emoji
    .replace(/\s+/g, ' ')
    .trim();
}

function trigrams(normalized: string): Map<string, number> {
  const padded = `  ${normalized} `;
  const grams = new Map<string, number>();
  for (let i = 0; i < padded.length - 2; i++) {
    const g = padded.slice(i, i + 3);
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  return grams;
}

export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ga = trigrams(na);
  const gb = trigrams(nb);
  let overlap = 0;
  let sizeA = 0;
  let sizeB = 0;
  for (const [g, count] of ga) {
    sizeA += count;
    overlap += Math.min(count, gb.get(g) ?? 0);
  }
  for (const count of gb.values()) sizeB += count;
  return (2 * overlap) / (sizeA + sizeB);
}

export interface CorpusItem<T> {
  text: string;
  meta: T;
}

export interface Match<T> {
  score: number;
  text: string;
  meta: T;
}

export function bestMatch<T>(text: string, corpus: CorpusItem<T>[]): Match<T> | null {
  let best: Match<T> | null = null;
  for (const item of corpus) {
    const score = similarity(text, item.text);
    if (!best || score > best.score) best = { score, text: item.text, meta: item.meta };
  }
  return best;
}
