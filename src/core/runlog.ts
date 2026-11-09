import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * One JSON line per event in logs/runs.jsonl. This is the measurement for the pilot:
 * how many variants designers actually keep, how much they edit, how fast they get to an export.
 */
export type RunEvent =
  | {
      type: 'generated';
      runId: string;
      ts: string;
      via: 'web' | 'cli';
      scriptTitle: string;
      provider: string;
      model: string;
      durationMs: number;
      costUsd: number | null;
      requested: number;
      generated: number;
      ok: number;
      review: number;
      duplicate: number;
    }
  | {
      type: 'exported';
      runId: string;
      ts: string;
      format: 'csv' | 'md';
      selected: number;
      edited: number;
      secondsSinceGeneration: number | null;
    }
  | { type: 'saved_to_library'; runId: string; ts: string; count: number };

export function logEvent(path: string, event: RunEvent): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(event) + '\n');
  } catch (e) {
    // Logging must never break the designer's flow.
    console.warn(`Could not write run log: ${(e as Error).message}`);
  }
}

export function readEvents(path: string): RunEvent[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as RunEvent];
      } catch {
        return [];
      }
    });
}
