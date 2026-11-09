import { loadDotEnv, readConfig } from './config.js';
import { readEvents, type RunEvent } from './core/runlog.js';

/**
 * Pilot metrics from logs/runs.jsonl:
 *   acceptance rate  = selected / generated  — are the variants good enough to keep?
 *   edit rate        = edited / selected     — how much rework do designers still do?
 *   time to export   — minutes from generation to an exported brief (the "half a day" from the interview)
 *   cost per kept variant
 */
loadDotEnv();
const { paths } = readConfig();
const events = readEvents(paths.log);

const generated = events.filter((e): e is Extract<RunEvent, { type: 'generated' }> => e.type === 'generated');
const exported = events.filter((e): e is Extract<RunEvent, { type: 'exported' }> => e.type === 'exported');

if (!generated.length) {
  console.log(`No runs logged yet in ${paths.log}.`);
  process.exit(0);
}

// One export per run counts (the last one wins if a designer exported twice).
const lastExport = new Map<string, Extract<RunEvent, { type: 'exported' }>>();
for (const e of exported) lastExport.set(e.runId, e);

const genById = new Map(generated.map((g) => [g.runId, g]));
const exportedRuns = [...lastExport.values()].filter((e) => genById.has(e.runId));

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

const totalGenerated = sum(generated.map((g) => g.generated));
const totalCost = sum(generated.map((g) => g.costUsd ?? 0));
const genOfExported = sum(exportedRuns.map((e) => genById.get(e.runId)!.generated));
const selected = sum(exportedRuns.map((e) => e.selected));
const edited = sum(exportedRuns.map((e) => e.edited));
const minutes = exportedRuns.map((e) => e.secondsSinceGeneration).filter((s): s is number => s !== null).map((s) => s / 60);
const medMin = median(minutes);

console.log(`Runs: ${generated.length} (exported: ${exportedRuns.length})`);
console.log(`Variants generated: ${totalGenerated}, duplicates caught: ${sum(generated.map((g) => g.duplicate))}, to review: ${sum(generated.map((g) => g.review))}`);
if (exportedRuns.length) {
  console.log(`Acceptance rate (selected / generated): ${pct(selected / Math.max(1, genOfExported))}`);
  console.log(`Edit rate (edited / selected): ${pct(edited / Math.max(1, selected))}`);
  if (medMin !== null) console.log(`Median time from generation to export: ${medMin.toFixed(1)} min`);
}
console.log(`LLM cost: $${totalCost.toFixed(2)} total${selected ? `, $${(totalCost / selected).toFixed(3)} per kept variant` : ''}`);
console.log(`Median generation time: ${((median(generated.map((g) => g.durationMs)) ?? 0) / 1000).toFixed(1)} s`);
