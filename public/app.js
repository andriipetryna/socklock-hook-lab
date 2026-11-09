// SockLock Hook Lab — browser side. No build step: plain ES module talking to the local server.

const $ = (id) => document.getElementById(id);

const state = {
  meta: null,
  result: null,
  generatedAt: 0,
  filter: 'all',
  /** id → { ...variant, selected, edited, checked } */
  rows: new Map(),
  ctas: new Map(),
};

const SOURCE_LABEL = { library: 'хук з бібліотеки', batch: 'інший варіант у цій видачі', winner: 'оригінальний хук переможця' };

/* ---------- helpers ---------- */

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('data-')) el.setAttribute(k, v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
const hooksWord = (n) => `${n} ${plural(n, 'хук', 'хуки', 'хуків')}`;

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });
const countChars = (s) => [...graphemes.segment(s)].length;
const countWords = (s) => s.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

async function api(path, body) {
  const res = await fetch(path, body === undefined ? {} : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Помилка ${res.status}`;
    try { message = (await res.json()).error ?? message; } catch {}
    throw new Error(message);
  }
  return res;
}

let toastTimer;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 4500);
}

/* ---------- startup ---------- */

async function init() {
  try {
    const [meta, examples] = await Promise.all([
      api('/api/meta').then((r) => r.json()),
      api('/api/examples').then((r) => r.json()),
    ]);
    state.meta = meta;
    renderRuntime();
    renderAngles(meta);
    $('count').value = meta.defaults.count;
    $('ctaCount').value = meta.defaults.ctaCount;
    for (const ex of examples) $('examples').append(h('option', { value: ex.script, text: ex.title }));
    if (!meta.ready) {
      $('banner').textContent = `Генерація вимкнена: ${meta.problem} Після зміни .env перезапустіть сервер.`;
      $('banner').hidden = false;
      $('generate').disabled = true;
    }
  } catch (e) {
    $('runtime').textContent = `Сервер недоступний: ${e.message}`;
  }
}

function renderRuntime() {
  const m = state.meta;
  $('runtime').replaceChildren(
    'Провайдер ', h('strong', { text: m.provider }), ', модель ', h('strong', { text: m.model }),
    '. У бібліотеці ', h('strong', { text: hooksWord(m.librarySize) }), '.',
  );
}

function renderAngles(meta) {
  $('angles').replaceChildren(
    ...meta.angles.map((a) =>
      h('label', { class: 'chip', title: a.brief },
        h('input', { type: 'checkbox', name: 'angle', value: a.id, checked: meta.defaults.angles.includes(a.id) }),
        h('span', { text: a.label })),
    ),
  );
}

$('examples').addEventListener('change', (e) => {
  if (e.target.value) $('script').value = e.target.value;
  e.target.value = '';
});

/* ---------- generate ---------- */

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const angles = [...document.querySelectorAll('input[name=angle]:checked')].map((i) => i.value);
  if (!angles.length) return toast('Оберіть хоча б один кут.');
  const body = {
    script: $('script').value,
    count: Number($('count').value),
    angles,
    ctaCount: Number($('ctaCount').value),
  };

  const btn = $('generate');
  btn.disabled = true;
  const started = Date.now();
  const tick = () => ($('progress').textContent = `Генерую ${hooksWord(body.count)}… ${Math.round((Date.now() - started) / 1000)} с`);
  tick();
  const timer = setInterval(tick, 1000);

  try {
    const result = await api('/api/generate', body).then((r) => r.json());
    state.result = result;
    state.generatedAt = Date.now();
    state.rows = new Map(result.variants.map((v) => [v.id, { ...v, selected: false, edited: false, checked: snapshot(v) }]));
    state.ctas = new Map(result.ctas.map((c) => [c.id, { ...c, selected: false, edited: false, checked: snapshotCta(c) }]));
    state.filter = 'all';
    renderResults();
    $('progress').textContent = '';
  } catch (err) {
    $('progress').textContent = '';
    toast(err.message);
  } finally {
    clearInterval(timer);
    btn.disabled = !state.meta?.ready;
  }
});

const snapshot = (v) => `${v.hookVisual}\u0000${v.firstLine}\u0000${v.onScreenText}`;
const snapshotCta = (c) => `${c.spoken}\u0000${c.onScreenText}`;

/* ---------- results ---------- */

function renderResults() {
  const r = state.result;
  $('empty').hidden = true;
  $('results').hidden = false;
  $('actionbar').hidden = false;

  $('seamBody').textContent = r.analysis.body_starts_with;
  setSeam(null);

  $('analysis').replaceChildren(
    ...[
      ['Оригінальний хук', r.analysis.original_hook],
      ['Головна обіцянка', r.analysis.core_promise],
      ['Тіло починається з', r.analysis.body_starts_with],
      ['Не змінюємо', r.analysis.keep_unchanged],
    ].flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })]),
  );

  $('rows').replaceChildren(...[...state.rows.values()].map(rowEl));
  $('ctaSection').hidden = state.ctas.size === 0;
  $('ctas').replaceChildren(...[...state.ctas.values()].map(ctaEl));
  document.querySelectorAll('.filters button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === 'all')));
  $('pickAll').checked = false;
  renderStats();
  applyFilter();
  updateSelection();
}

function renderStats() {
  const r = state.result;
  const rows = [...state.rows.values()];
  const count = (s) => rows.filter((v) => v.status === s).length;
  const items = [
    ['', 'Варіантів', rows.length],
    ['ok', 'Готові', count('ok')],
    ['review', 'Перевірити', count('review')],
    ['duplicate', 'Дублі', count('duplicate')],
    ['', 'Час', `${Math.round(r.durationMs / 1000)} с`],
    ['', 'Вартість', r.costUsd === null ? 'н/д' : `$${r.costUsd.toFixed(3)}`],
  ];
  $('stats').replaceChildren(...items.map(([cls, k, v]) => h('div', { class: cls }, h('dt', { text: k }), h('dd', { text: String(v) }))));
}

function setSeam(text) {
  const p = $('seamNew');
  if (text) {
    p.textContent = text;
    p.classList.remove('placeholder');
  } else {
    p.textContent = 'Наведіть на рядок, щоб прочитати хук разом із тілом ролика';
    p.classList.add('placeholder');
  }
}

function angleLabel(id) {
  return state.meta.angles.find((a) => a.id === id)?.label ?? id;
}

const FIELD_LABEL = {
  hookVisual: 'Перший кадр',
  firstLine: 'Перша фраза',
  onScreenText: 'Текст на екрані',
  spoken: 'Озвучка CTA',
  ctaOnScreen: 'Текст CTA на екрані',
};

function editable(field, value, cls) {
  const el = h('span', { class: `copy ${cls}`, spellcheck: true, 'data-field': field, text: value, role: 'textbox', 'aria-label': FIELD_LABEL[field] });
  try {
    el.contentEditable = 'plaintext-only'; // no rich-text paste
  } catch {
    el.contentEditable = 'true'; // older browsers; we read textContent anyway
  }
  return el;
}

function counterText(field, value) {
  const L = state.meta.limits;
  if (field === 'firstLine') return [countWords(value), L.firstLineMaxWords, 'слів'];
  if (field === 'onScreenText') return [countChars(value), L.onScreenMaxChars, 'символів'];
  if (field === 'spoken') return [countWords(value), L.ctaSpokenMaxWords, 'слів'];
  if (field === 'ctaOnScreen') return [countChars(value), L.ctaOnScreenMaxChars, 'символів'];
  return null;
}

function counterEl(field, value) {
  const [n, max, unit] = counterText(field, value);
  return h('span', { class: `counter${n > max ? ' over' : ''}`, 'data-for': field, text: `${n}/${max} ${unit}` });
}

function rowEl(v) {
  return h('tr', { 'data-id': v.id, 'data-status': v.status },
    h('td', { class: 'col-pick' }, h('input', { type: 'checkbox', checked: v.selected, 'aria-label': `Обрати ${v.id}` })),
    h('td', { class: 'col-angle' }, h('span', { class: 'status-dot' }), h('span', { class: 'angle', text: angleLabel(v.angle) })),
    h('td', { class: 'col-visual' }, editable('hookVisual', v.hookVisual, 'visual')),
    h('td', { class: 'col-line' },
      editable('firstLine', v.firstLine, 'line'),
      counterEl('firstLine', v.firstLine),
      h('span', { class: 'rationale', text: v.rationale })),
    h('td', { class: 'col-screen' }, editable('onScreenText', v.onScreenText, 'screen'), counterEl('onScreenText', v.onScreenText)),
    h('td', { class: 'col-check' }, checksEl(v)),
  );
}

function checksEl(item) {
  const items = [];
  const sim = item.similar;
  const t = state.meta.similarity;
  if (sim && sim.score >= t.duplicate) {
    items.push(h('li', { class: 'flag dup', text: `Повторює ${SOURCE_LABEL[sim.source]}: «${sim.text}» (схожість ${sim.score.toFixed(2)})` }));
  } else if (sim && sim.score >= t.similar) {
    items.push(h('li', { class: 'flag medium', text: `Схожий на ${SOURCE_LABEL[sim.source]}: «${sim.text}» (схожість ${sim.score.toFixed(2)})` }));
  }
  // The same rule can fire on the spoken line and the on-screen text; show it once.
  const seen = new Set();
  for (const f of item.flags) {
    const text = `${f.label}: ${f.match}`;
    if (seen.has(text)) continue;
    seen.add(text);
    items.push(h('li', { class: `flag ${f.severity}`, title: f.hint, text }));
  }
  if (!items.length) return h('span', { class: 'clean', text: 'Без зауважень' });
  return h('ul', { class: 'flags' }, items);
}

function ctaEl(c) {
  return h('li', { 'data-cta': c.id, 'data-status': c.status },
    h('input', { type: 'checkbox', checked: c.selected, 'aria-label': `Обрати ${c.id}` }),
    h('div', {}, editable('spoken', c.spoken, 'line'), counterEl('spoken', c.spoken)),
    h('div', {}, editable('ctaOnScreen', c.onScreenText, 'screen'), counterEl('ctaOnScreen', c.onScreenText)),
    h('div', { class: 'cta-check' }, checksEl(c)),
  );
}

/* ---------- interactions: rows ---------- */

const rowsEl = $('rows');

rowsEl.addEventListener('mouseover', (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (tr) setSeam(state.rows.get(tr.dataset.id).firstLine);
});
rowsEl.addEventListener('focusin', (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (tr) setSeam(state.rows.get(tr.dataset.id).firstLine);
});

rowsEl.addEventListener('change', (e) => {
  if (e.target.type !== 'checkbox') return;
  const id = e.target.closest('tr').dataset.id;
  state.rows.get(id).selected = e.target.checked;
  updateSelection();
});

function wireEditing(container, getItem, recheck) {
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.copy')) {
      e.preventDefault();
      e.target.blur();
    }
  });
  container.addEventListener('input', (e) => {
    if (!e.target.matches('.copy')) return;
    const { item, host } = getItem(e.target);
    const field = e.target.dataset.field;
    const value = e.target.textContent.replace(/\s+/g, ' ').trim();
    item[field === 'ctaOnScreen' ? 'onScreenText' : field] = value;
    item.edited = true;
    const counter = host.querySelector(`.counter[data-for="${field}"]`);
    if (counter) counter.replaceWith(counterEl(field, value));
    if (field === 'firstLine') setSeam(value);
  });
  container.addEventListener('focusout', (e) => {
    if (!e.target.matches('.copy')) return;
    const { item, host } = getItem(e.target);
    recheck(item, host);
  });
}

wireEditing(rowsEl, (el) => {
  const host = el.closest('tr');
  return { item: state.rows.get(host.dataset.id), host };
}, async (item, host) => {
  if (snapshot(item) === item.checked) return;
  item.checked = snapshot(item);
  try {
    const res = await api('/api/check', { originalHook: state.result.analysis.original_hook, variants: [pickCopy(item)] }).then((r) => r.json());
    Object.assign(item, res.variants[0]);
    host.dataset.status = item.status;
    host.querySelector('.col-check').replaceChildren(checksEl(item));
    renderStats();
    applyFilter();
  } catch (err) {
    toast(err.message);
  }
});

wireEditing($('ctas'), (el) => {
  const host = el.closest('li');
  return { item: state.ctas.get(host.dataset.cta), host };
}, async (item, host) => {
  if (snapshotCta(item) === item.checked) return;
  item.checked = snapshotCta(item);
  try {
    const res = await api('/api/check', { ctas: [{ id: item.id, spoken: item.spoken, onScreenText: item.onScreenText }] }).then((r) => r.json());
    Object.assign(item, res.ctas[0]);
    host.dataset.status = item.status;
    host.querySelector('.cta-check').replaceChildren(checksEl(item));
  } catch (err) {
    toast(err.message);
  }
});

$('ctas').addEventListener('change', (e) => {
  if (e.target.type !== 'checkbox') return;
  state.ctas.get(e.target.closest('li').dataset.cta).selected = e.target.checked;
  updateSelection();
});

/* ---------- filter & selection ---------- */

document.querySelector('.filters').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-filter]');
  if (!btn) return;
  state.filter = btn.dataset.filter;
  document.querySelectorAll('.filters button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  applyFilter();
});

function applyFilter() {
  for (const tr of rowsEl.children) {
    tr.hidden = state.filter !== 'all' && tr.dataset.status !== state.filter;
  }
}

$('pickAll').addEventListener('change', (e) => {
  for (const tr of rowsEl.children) {
    if (tr.hidden) continue;
    state.rows.get(tr.dataset.id).selected = e.target.checked;
    tr.querySelector('input[type=checkbox]').checked = e.target.checked;
  }
  updateSelection();
});

function selected() {
  return {
    variants: [...state.rows.values()].filter((v) => v.selected),
    ctas: [...state.ctas.values()].filter((c) => c.selected),
  };
}

function updateSelection() {
  const { variants, ctas } = selected();
  const parts = [];
  if (variants.length) parts.push(hooksWord(variants.length));
  if (ctas.length) parts.push(`${ctas.length} CTA`);
  $('selection').textContent = parts.length ? `Обрано ${parts.join(' і ')}` : 'Нічого не обрано';
  $('exportCsv').disabled = $('exportMd').disabled = !(variants.length || ctas.length);
  $('saveLibrary').disabled = !variants.length;
}

/* ---------- export & library ---------- */

const pickCopy = (v) => ({ id: v.id, angle: v.angle, hookVisual: v.hookVisual, firstLine: v.firstLine, onScreenText: v.onScreenText, rationale: v.rationale });

async function exportAs(format) {
  const r = state.result;
  const { variants, ctas } = selected();
  try {
    const res = await api('/api/export', {
      format,
      runId: r.runId,
      scriptTitle: r.scriptTitle,
      analysis: r.analysis,
      model: r.model,
      createdAt: r.createdAt,
      variants: variants.map(pickCopy),
      ctas: ctas.map((c) => ({ id: c.id, spoken: c.spoken, onScreenText: c.onScreenText })),
      edited: variants.filter((v) => v.edited).length + ctas.filter((c) => c.edited).length,
      secondsSinceGeneration: Math.round((Date.now() - state.generatedAt) / 1000),
    });
    const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? `mods.${format}`;
    const url = URL.createObjectURL(await res.blob());
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(format === 'csv' ? `Збережено ${name}` : `Бриф збережено: ${name}`);
  } catch (err) {
    toast(err.message);
  }
}

$('exportCsv').addEventListener('click', () => exportAs('csv'));
$('exportMd').addEventListener('click', () => exportAs('md'));

$('saveLibrary').addEventListener('click', async () => {
  const { variants } = selected();
  try {
    const res = await api('/api/library', { runId: state.result.runId, scriptTitle: state.result.scriptTitle, variants: variants.map(pickCopy) }).then((r) => r.json());
    state.meta.librarySize = res.librarySize;
    renderRuntime();
    toast(`Додано ${hooksWord(res.added)} у бібліотеку. Наступна генерація позначить повтори.`);
  } catch (err) {
    toast(err.message);
  }
});

init();
