import { ANGLE_IDS, type Cta, type Flag, type Generation, type SimilarityHit, type Variant, type VariantStatus } from '../schema.js';
import { checkCta, checkHook, type HookCopy } from './claims.js';
import type { LibraryEntry } from './library.js';
import type { Rules } from './rules.js';
import { bestMatch, type CorpusItem } from './similarity.js';

type HitMeta = Pick<SimilarityHit, 'source' | 'field'>;

export interface PostprocessContext {
  rules: Rules;
  library: LibraryEntry[];
  /** The winner's own first line: a "modification" that repeats it is useless. */
  originalHook: string;
}

function libraryCorpus(library: LibraryEntry[], originalHook: string): CorpusItem<HitMeta>[] {
  const corpus: CorpusItem<HitMeta>[] = [];
  if (originalHook.trim()) corpus.push({ text: originalHook, meta: { source: 'winner', field: 'first_line' } });
  for (const e of library) {
    corpus.push({ text: e.firstLine, meta: { source: 'library', field: 'first_line' } });
    if (e.onScreenText) corpus.push({ text: e.onScreenText, meta: { source: 'library', field: 'on_screen_text' } });
  }
  return corpus;
}

/**
 * Highest similarity of the hook's first line / on-screen text against the corpus (fields compared like-for-like).
 * Returns null below the "similar" threshold so weak matches don't clutter the UI and the export.
 */
function findSimilar(v: HookCopy, corpus: CorpusItem<HitMeta>[], rules: Rules): SimilarityHit | null {
  const byLine = bestMatch(v.firstLine, corpus.filter((c) => c.meta.field === 'first_line'));
  const byScreen = v.onScreenText ? bestMatch(v.onScreenText, corpus.filter((c) => c.meta.field === 'on_screen_text')) : null;
  const best = [byLine, byScreen].filter((m) => m !== null).sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < rules.similarity.similar) return null;
  return { score: Math.round(best.score * 100) / 100, source: best.meta.source, field: best.meta.field, text: best.text };
}

export function statusFor(flags: Flag[], similar: SimilarityHit | null, rules: Rules): VariantStatus {
  if (similar && similar.score >= rules.similarity.duplicate) return 'duplicate';
  if (flags.some((f) => f.severity !== 'info')) return 'review';
  if (similar && similar.score >= rules.similarity.similar) return 'review';
  return 'ok';
}

function normalizeAngle(angle: string): string {
  const a = angle.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return (ANGLE_IDS as readonly string[]).includes(a) ? a : angle.trim();
}

/** Checks one (possibly hand-edited) hook against the library. Used by the UI after a designer edits a cell. */
export function evaluateHook(v: HookCopy, ctx: PostprocessContext): Pick<Variant, 'flags' | 'similar' | 'status'> {
  const flags = checkHook(v, ctx.rules);
  const similar = findSimilar(v, libraryCorpus(ctx.library, ctx.originalHook), ctx.rules);
  return { flags, similar, status: statusFor(flags, similar, ctx.rules) };
}

export function postprocess(gen: Generation, ctx: PostprocessContext): { variants: Variant[]; ctas: Cta[] } {
  const corpus = libraryCorpus(ctx.library, ctx.originalHook);
  const variants: Variant[] = [];

  gen.variants.forEach((raw, i) => {
    const copy: HookCopy = {
      hookVisual: raw.hook_visual.trim(),
      firstLine: raw.first_line.trim(),
      onScreenText: raw.on_screen_text.trim(),
    };
    const flags = checkHook(copy, ctx.rules);
    // Compare against the library, the winner AND the variants already accepted in this batch.
    const batchCorpus: CorpusItem<HitMeta>[] = variants
      .filter((v) => v.status !== 'duplicate')
      .flatMap((v) => [
        { text: v.firstLine, meta: { source: 'batch', field: 'first_line' } as HitMeta },
        { text: v.onScreenText, meta: { source: 'batch', field: 'on_screen_text' } as HitMeta },
      ]);
    const similar = findSimilar(copy, [...corpus, ...batchCorpus], ctx.rules);
    variants.push({
      id: `v${String(i + 1).padStart(2, '0')}`,
      angle: normalizeAngle(raw.angle),
      ...copy,
      rationale: raw.rationale.trim(),
      flags,
      similar,
      status: statusFor(flags, similar, ctx.rules),
    });
  });

  const ctas: Cta[] = gen.ctas.map((raw, i) => {
    const c = { spoken: raw.spoken.trim(), onScreenText: raw.on_screen_text.trim() };
    const flags = checkCta(c, ctx.rules);
    return { id: `c${i + 1}`, ...c, flags, status: statusFor(flags, null, ctx.rules) };
  });

  return { variants, ctas };
}
