import { stringify } from 'csv-stringify/sync';
import type { Cta, Flag, Variant, WinnerAnalysis } from '../schema.js';

export interface ExportPayload {
  scriptTitle: string;
  analysis: WinnerAnalysis | null;
  variants: Variant[];
  ctas: Cta[];
  model?: string;
  createdAt?: string;
}

const BOM = '﻿'; // lets Excel open UTF-8 (emoji, curly quotes) correctly

function flagText(flags: Flag[]): string {
  return flags.map((f) => `${f.severity.toUpperCase()} ${f.label} [${f.field}]: ${f.match}`).join('; ');
}

export function toCsv(p: ExportPayload): string {
  const header = ['type', 'id', 'status', 'angle', 'hook_visual', 'first_line', 'on_screen_text', 'rationale', 'flags', 'similar_to', 'similarity'];
  const rows: string[][] = [
    ...p.variants.map((v) => [
      'hook',
      v.id,
      v.status,
      v.angle,
      v.hookVisual,
      v.firstLine,
      v.onScreenText,
      v.rationale,
      flagText(v.flags),
      v.similar ? `${v.similar.source}: ${v.similar.text}` : '',
      v.similar ? v.similar.score.toFixed(2) : '',
    ]),
    ...p.ctas.map((c) => ['cta', c.id, c.status, '', '', c.spoken, c.onScreenText, '', flagText(c.flags), '', '']),
  ];
  return BOM + stringify([header, ...rows]);
}

const md = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function toBrief(p: ExportPayload): string {
  const lines: string[] = [];
  lines.push(`# Бриф на модифікації: ${p.scriptTitle}`, '');
  lines.push(`Згенеровано ${p.createdAt ?? new Date().toISOString()}${p.model ? `, модель ${p.model}` : ''}.`, '');
  lines.push('**Міняємо лише перші 1–3 секунди: кадр, першу фразу і текст на екрані. Решта ролика-переможця без змін.**', '');

  if (p.analysis) {
    lines.push('## Переможець', '');
    lines.push(`- Оригінальний хук: “${p.analysis.original_hook}”`);
    lines.push(`- Головна обіцянка: ${p.analysis.core_promise}`);
    lines.push(`- Тіло починається з фрази “${p.analysis.body_starts_with}”, і кожен новий хук має природно в неї переходити.`);
    lines.push(`- Не змінюємо: ${p.analysis.keep_unchanged}`, '');
  }

  lines.push(`## Хуки (${p.variants.length})`, '');
  lines.push('| # | Кут | Перший кадр | Перша фраза | Текст на екрані | Перевірка |');
  lines.push('|---|---|---|---|---|---|');
  for (const v of p.variants) {
    const check = v.flags.length ? v.flags.map((f) => `${f.label}: ${f.match}`).join('; ') : '✓';
    lines.push(`| ${v.id} | ${v.angle} | ${md(v.hookVisual)} | ${md(v.firstLine)} | ${md(v.onScreenText)} | ${md(check)} |`);
  }
  lines.push('');

  if (p.ctas.length) {
    lines.push(`## Варіанти CTA (${p.ctas.length})`, '');
    for (const c of p.ctas) {
      const check = c.flags.length ? ` ⚠ ${c.flags.map((f) => `${f.label}: ${f.match}`).join('; ')}` : '';
      lines.push(`- **${c.id}** Озвучка: “${c.spoken}”. На екрані: “${c.onScreenText}”.${check}`);
    }
    lines.push('');
  }

  const toFill = p.variants.some((v) => v.flags.some((f) => f.ruleId === 'placeholder'));
  if (toFill) lines.push('> Рядки з [PLACEHOLDER] потребують реальних даних (цитата відгуку, числа) перед продакшном.', '');
  return lines.join('\n');
}
