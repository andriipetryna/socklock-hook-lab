import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { describe, expect, it } from 'vitest';
import { generateVariants, scriptTitle } from '../src/core/generate.js';
import { appendToLibrary, avoidList, loadLibrary } from '../src/core/library.js';
import { distributeCounts, buildUserPrompt } from '../src/prompt.js';
import { toBrief, toCsv } from '../src/export/exporters.js';
import { FakeLlm, realRules } from './helpers.js';

const script = readFileSync('examples/winner-01-ugc-lonely-socks.txt', 'utf8');
const brandFacts = readFileSync('brand/socklock.md', 'utf8');

describe('prompt', () => {
  it('spreads the requested count across angles', () => {
    expect(distributeCounts(20, ['pain', 'curiosity', 'demo'])).toEqual([
      { angle: 'pain', count: 7 },
      { angle: 'curiosity', count: 7 },
      { angle: 'demo', count: 6 },
    ]);
    expect(distributeCounts(2, ['pain', 'curiosity', 'demo'])).toHaveLength(2);
  });

  it('includes the script, the plan and the already-used hooks', () => {
    const user = buildUserPrompt({ script: 'SCRIPT', plan: [{ angle: 'pain', count: 3 }], ctaCount: 2, avoid: ['Old hook'] });
    expect(user).toContain('<winner_script>\nSCRIPT\n</winner_script>');
    expect(user).toContain('- pain × 3');
    expect(user).toContain('- Old hook');
  });
});

describe('generateVariants', () => {
  it('runs the full pipeline: prompt → model → checks → statuses', async () => {
    const llm = new FakeLlm();
    const library = loadLibrary('data/hooks_library.csv');
    const r = await generateVariants({ script, count: 5, angles: ['pain', 'curiosity', 'contrarian', 'ugc'], ctaCount: 2 }, { llm, brandFacts, rules: realRules(), library });

    // the system prompt carries the brand facts, the user prompt the library
    expect(llm.calls[0]!.system).toContain('5 pairs for $29');
    expect(llm.calls[0]!.user).toContain('Where do all the missing socks actually go?');

    const byId = Object.fromEntries(r.variants.map((v) => [v.id, v]));
    expect(byId.v01!.status).toBe('ok');
    // copied from the library
    expect(byId.v02!.status).toBe('duplicate');
    expect(byId.v02!.similar?.source).toBe('library');
    // "Contrarian" is normalized; absolute promise → review
    expect(byId.v03!.angle).toBe('contrarian');
    expect(byId.v03!.status).toBe('review');
    // invented number → review
    expect(byId.v04!.flags.map((f) => f.ruleId)).toContain('number');
    // near-copy of v01 inside the same batch
    expect(byId.v05!.status).toBe('duplicate');
    expect(byId.v05!.similar?.source).toBe('batch');

    expect(r.ctas[0]!.status).toBe('ok');
    expect(r.ctas[1]!.flags.map((f) => f.ruleId)).toEqual(expect.arrayContaining(['offer', 'urgency']));
    expect(r.stats).toMatchObject({ requested: 5, generated: 5, duplicate: 2 });
    expect(r.costUsd).toBeCloseTo(0.035, 3); // 5k in × $2/M + 2.5k out × $10/M
    expect(r.scriptTitle).toBe('UGC "Lonely socks pile" — winner, US');
  });

  it('rejects an empty script before calling the model', async () => {
    const llm = new FakeLlm();
    await expect(generateVariants({ script: ' ' }, { llm, brandFacts, rules: realRules(), library: [] })).rejects.toThrow();
    expect(llm.calls).toHaveLength(0);
  });
});

describe('library CSV', () => {
  const entry = { firstLine: '"Okay, washer." Where are they?', onScreenText: 'Sock tax 😩', hookVisual: 'Dad, washer', angle: 'humor', status: 'planned', source: 'w1', addedAt: '2026-11-09' };

  it('round-trips quotes, commas and emoji, and follows the existing file columns', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'lib-')), 'lib.csv');
    // a team export with its own column order, an extra column and no trailing newline
    writeFileSync(path, 'angle,first_line,ad_id,on_screen_text\npain,Old hook,123,Old text');
    appendToLibrary(path, [entry]);
    const lib = loadLibrary(path);
    expect(lib).toHaveLength(2);
    expect(lib[1]).toMatchObject({ firstLine: entry.firstLine, onScreenText: 'Sock tax 😩', angle: 'humor', hookVisual: '' });
    expect(avoidList(lib)[0]).toBe('"Okay, washer." Where are they? | on-screen: Sock tax 😩');
  });

  it('creates the file with the standard header when missing', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'lib-')), 'new', 'lib.csv');
    appendToLibrary(path, [entry]);
    expect(readFileSync(path, 'utf8').split('\n')[0]).toBe('first_line,on_screen_text,hook_visual,angle,status,source,added_at');
    expect(loadLibrary(path)[0]).toMatchObject(entry);
  });

  it('returns an empty library when the file is missing', () => {
    expect(loadLibrary('does/not/exist.csv')).toEqual([]);
  });
});

describe('exporters', () => {
  it('writes an Excel-friendly CSV with hooks and CTAs', async () => {
    const r = await generateVariants({ script, count: 5, angles: ['pain'], ctaCount: 2 }, { llm: new FakeLlm(), brandFacts, rules: realRules(), library: [] });
    const csv = toCsv({ scriptTitle: r.scriptTitle, analysis: r.analysis, variants: r.variants, ctas: r.ctas });
    expect(csv.startsWith('﻿')).toBe(true);
    const rows = parse(csv, { columns: true, bom: true }) as Record<string, string>[];
    expect(rows).toHaveLength(7);
    expect(rows.filter((x) => x.type === 'cta')).toHaveLength(2);
    expect(rows[0]!.first_line).toBe('Laundry day is where my socks go to die.');

    const brief = toBrief({ scriptTitle: r.scriptTitle, analysis: r.analysis, variants: r.variants, ctas: r.ctas });
    expect(brief).toContain('Тіло починається з фрази');
    expect(brief).toContain('| v01 | pain |');
  });

  it('extracts a title from the script', () => {
    expect(scriptTitle('Title: Demo — winner\nrest')).toBe('Demo — winner');
    expect(scriptTitle('Just a hook line\nrest')).toBe('Just a hook line');
  });
});

describe('similarity reporting', () => {
  it('reports a match only above the "similar" threshold', async () => {
    const r = await generateVariants({ script, count: 5, angles: ['pain'], ctaCount: 0 }, { llm: new FakeLlm(), brandFacts, rules: realRules(), library: loadLibrary('data/hooks_library.csv') });
    const v01 = r.variants[0]!;
    expect(v01.similar).toBeNull(); // best library match is ~0.38, below 0.45
    const csv = toCsv({ scriptTitle: r.scriptTitle, analysis: r.analysis, variants: [v01], ctas: [] });
    expect(csv).not.toContain('library:');
  });
});
