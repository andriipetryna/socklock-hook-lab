import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadDotEnv, readConfig } from './config.js';
import { ANGLE_IDS, type AngleId, type Variant } from './schema.js';
import { generateVariants } from './core/generate.js';
import { loadLibrary } from './core/library.js';
import { loadRules } from './core/rules.js';
import { logEvent } from './core/runlog.js';
import { toBrief, toCsv } from './export/exporters.js';
import { createLlmClient } from './llm/index.js';

const HELP = `SockLock Hook Lab — CLI

Usage:
  npm run generate -- <winner.txt> [more.txt ...] [options]

Options:
  --count <n>       variants per winner (default 20, max 40)
  --angles <list>   comma-separated: ${ANGLE_IDS.join(',')}
  --ctas <n>        CTA variants (default 4, 0 to skip)
  --out <dir>       output folder (default out)
  --no-library      ignore the hooks library (no "already used" check)
  -h, --help

Writes <out>/<winner>-<timestamp>.csv, .md (designer brief) and .json for every winner file.`;

const ICON: Record<Variant['status'], string> = { ok: '✓', review: '!', duplicate: '×' };

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      count: { type: 'string', default: '20' },
      angles: { type: 'string' },
      ctas: { type: 'string', default: '4' },
      out: { type: 'string', default: 'out' },
      'no-library': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    process.exit(values.help ? 0 : 1);
  }

  const angles = values.angles?.split(',').map((a) => a.trim()).filter(Boolean);
  const unknown = angles?.filter((a) => !(ANGLE_IDS as readonly string[]).includes(a));
  if (unknown?.length) throw new Error(`Невідомі кути: ${unknown.join(', ')}. Доступні: ${ANGLE_IDS.join(', ')}`);

  loadDotEnv();
  const config = readConfig();
  const llm = createLlmClient(config);
  const rules = loadRules(config.paths.rules);
  const brandFacts = readFileSync(config.paths.brand, 'utf8');
  const library = values['no-library'] ? [] : loadLibrary(config.paths.library);
  mkdirSync(values.out, { recursive: true });

  console.log(`Провайдер: ${llm.provider}, модель: ${llm.model}, у бібліотеці ${library.length} хуків\n`);

  let failed = 0;
  for (const file of positionals) {
    const script = readFileSync(file, 'utf8');
    process.stdout.write(`→ ${file} … `);
    try {
      const r = await generateVariants(
        { script, count: Number(values.count), angles: angles as AngleId[] | undefined, ctaCount: Number(values.ctas) },
        { llm, brandFacts, rules, library },
      );
      const stamp = r.createdAt.replace(/[:.]/g, '-').slice(0, 19);
      const base = join(values.out, `${basename(file, extname(file))}-${stamp}`);
      const payload = { scriptTitle: r.scriptTitle, analysis: r.analysis, variants: r.variants, ctas: r.ctas, model: r.model, createdAt: r.createdAt };
      writeFileSync(`${base}.csv`, toCsv(payload));
      writeFileSync(`${base}.md`, toBrief(payload));
      writeFileSync(`${base}.json`, JSON.stringify(r, null, 2));

      logEvent(config.paths.log, {
        type: 'generated',
        runId: r.runId,
        ts: r.createdAt,
        via: 'cli',
        scriptTitle: r.scriptTitle,
        provider: r.provider,
        model: r.model,
        durationMs: r.durationMs,
        costUsd: r.costUsd,
        ...r.stats,
      });

      const cost = r.costUsd === null ? '' : `, ~$${r.costUsd.toFixed(3)}`;
      console.log(`${(r.durationMs / 1000).toFixed(1)}s${cost}`);
      console.log(`  готові: ${r.stats.ok}, перевірити: ${r.stats.review}, дублі: ${r.stats.duplicate}`);
      for (const v of r.variants) {
        const why = v.status === 'duplicate' && v.similar ? `  ← ${v.similar.source}: "${v.similar.text}"` : v.flags.length ? `  ← ${v.flags.map((f) => f.label).join(', ')}` : '';
        console.log(`  ${ICON[v.status]} [${v.angle}] ${v.firstLine}  |  ${v.onScreenText}${why}`);
      }
      console.log(`  збережено: ${base}.csv, .md, .json\n`);
    } catch (e) {
      failed++;
      console.log('помилка');
      console.error(`  ${(e as Error).message}\n`);
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
