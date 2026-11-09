import { existsSync, readFileSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

/**
 * The hooks library is a plain CSV the team already can keep in Google Sheets / Airtable export:
 * every hook that has been produced or launched. Only `first_line` is required.
 */
export const LIBRARY_COLUMNS = ['first_line', 'on_screen_text', 'hook_visual', 'angle', 'status', 'source', 'added_at'] as const;

export interface LibraryEntry {
  firstLine: string;
  onScreenText: string;
  hookVisual: string;
  angle: string;
  status: string;
  source: string;
  addedAt: string;
}

type Row = Partial<Record<(typeof LIBRARY_COLUMNS)[number], string>>;

export function loadLibrary(path: string): LibraryEntry[] {
  if (!existsSync(path)) return [];
  const rows = parse(readFileSync(path, 'utf8'), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Row[];
  if (rows.length && !('first_line' in rows[0]!)) {
    throw new Error(`${path}: the library CSV needs a "first_line" column`);
  }
  return rows
    .filter((r) => r.first_line)
    .map((r) => ({
      firstLine: r.first_line ?? '',
      onScreenText: r.on_screen_text ?? '',
      hookVisual: r.hook_visual ?? '',
      angle: r.angle ?? '',
      status: r.status ?? '',
      source: r.source ?? '',
      addedAt: r.added_at ?? '',
    }));
}

function toRow(e: LibraryEntry): Row {
  return {
    first_line: e.firstLine,
    on_screen_text: e.onScreenText,
    hook_visual: e.hookVisual,
    angle: e.angle,
    status: e.status,
    source: e.source,
    added_at: e.addedAt,
  };
}

/** Appends rows in the column order of the existing file (a team's export may have fewer or extra columns). */
export function appendToLibrary(path: string, entries: LibraryEntry[]): number {
  if (!entries.length) return 0;
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, stringify(entries.map(toRow), { header: true, columns: [...LIBRARY_COLUMNS] }));
    return entries.length;
  }
  const current = readFileSync(path, 'utf8');
  const [header = []] = parse(current, { bom: true, to_line: 1 }) as string[][];
  if (!header.includes('first_line')) throw new Error(`${path}: the library CSV needs a "first_line" column`);
  const prefix = current.length && !current.endsWith('\n') ? '\n' : '';
  appendFileSync(path, prefix + stringify(entries.map(toRow), { columns: header }));
  return entries.length;
}

/** Most recent hooks first (file order = chronological), capped so the prompt stays small. */
export function avoidList(library: LibraryEntry[], max = 150): string[] {
  return library
    .slice(-max)
    .reverse()
    .map((e) => (e.onScreenText ? `${e.firstLine} | on-screen: ${e.onScreenText}` : e.firstLine));
}
