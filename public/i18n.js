// UI strings for the browser side. English is the default UI language. The server speaks Ukrainian
// (angle labels, rule labels from config/claims-rules.json), so for those we only keep English overrides
// keyed by id and fall back to whatever the server sent.

export const LANGS = ['en', 'uk'];
const STORAGE_KEY = 'hooklab.lang';

const dict = {
  uk: {
    'doc.title': 'SockLock Hook Lab',
    'lang.aria': 'Мова інтерфейсу',
    'brand.sub': 'модифікації переможців SockLock',
    'runtime.connecting': 'Підключаюся…',
    'runtime.info': 'Провайдер {provider}, модель {model}. У бібліотеці {library}.',
    'runtime.offline': 'Сервер недоступний: {message}',
    'banner.disabled': 'Генерація вимкнена: {problem} Після зміни .env перезапустіть сервер.',
    'error.http': 'Помилка {status}',

    'form.script': 'Скрипт переможця',
    'form.examples': 'Підставити приклад',
    'form.examplePlaceholder': 'Приклад…',
    'form.scriptPlaceholder': 'Вставте скрипт: хук, озвучку, текст на екрані, сцени, CTA. Формат довільний.',
    'form.angles': 'Кути',
    'form.count': 'Хуків',
    'form.ctaCount': 'CTA',
    'form.generate': 'Згенерувати варіанти',
    'form.pickAngle': 'Оберіть хоча б один кут.',
    'form.progress': 'Генерую {hooks}… {seconds} с',

    'results.aria': 'Результати',
    'empty.title': 'Нові перші три секунди для ролика, який уже працює',
    'empty.body': 'Вставте скрипт переможця ліворуч. Інструмент запропонує хуки під різні кути, перевірить їх на ризикові твердження й повтори з бібліотеки, а ви оберете, поправите і віддасте бриф у продакшн.',

    'seam.aria': 'Як новий хук переходить у тіло ролика',
    'seam.new': 'Новий початок, 0–3 с',
    'seam.placeholder': 'Наведіть на рядок, щоб прочитати хук разом із тілом ролика',
    'seam.body': 'Тіло без змін',

    'analysis.summary': 'Як модель прочитала переможця',
    'analysis.originalHook': 'Оригінальний хук',
    'analysis.corePromise': 'Головна обіцянка',
    'analysis.bodyStarts': 'Тіло починається з',
    'analysis.keep': 'Не змінюємо',

    'filters.aria': 'Фільтр',
    'filter.all': 'Усі',
    'filter.ok': 'Готові',
    'filter.review': 'Перевірити',
    'filter.duplicate': 'Дублі',

    'stats.variants': 'Варіантів',
    'stats.time': 'Час',
    'stats.cost': 'Вартість',
    'stats.na': 'н/д',
    'stats.seconds': '{n} с',

    'table.pickAll': 'Обрати всі видимі',
    'table.pick': 'Обрати {id}',
    'col.angle': 'Кут',
    'col.visual': 'Перший кадр',
    'col.line': 'Перша фраза',
    'col.screen': 'Текст на екрані',
    'col.check': 'Перевірка',
    'field.spoken': 'Озвучка CTA',
    'field.ctaOnScreen': 'Текст CTA на екрані',
    'unit.words': 'слів',
    'unit.chars': 'символів',

    'check.clean': 'Без зауважень',
    'check.duplicate': 'Повторює {source}: «{text}» (схожість {score})',
    'check.similar': 'Схожий на {source}: «{text}» (схожість {score})',
    'check.lengthMatch': '{actual} {unit} (макс. {max})',
    'source.library': 'хук з бібліотеки',
    'source.batch': 'інший варіант у цій видачі',
    'source.winner': 'оригінальний хук переможця',

    'ctas.title': 'Варіанти CTA',
    'selection.none': 'Нічого не обрано',
    'selection.some': 'Обрано {items}',
    'selection.and': ' і ',
    'selection.ctas': '{n} CTA',
    'actions.saveLibrary': 'Додати в бібліотеку',
    'actions.exportMd': 'Завантажити бриф',
    'actions.exportCsv': 'Експорт CSV',
    'toast.savedCsv': 'Збережено {name}',
    'toast.savedBrief': 'Бриф збережено: {name}',
    'toast.addedLibrary': 'Додано {hooks} у бібліотеку. Наступна генерація позначить повтори.',

    hooks: { one: '{n} хук', few: '{n} хуки', many: '{n} хуків', other: '{n} хука' },
  },

  en: {
    'doc.title': 'SockLock Hook Lab',
    'lang.aria': 'Interface language',
    'brand.sub': 'variations on SockLock winners',
    'runtime.connecting': 'Connecting…',
    'runtime.info': 'Provider {provider}, model {model}. Library: {library}.',
    'runtime.offline': 'Server unavailable: {message}',
    'banner.disabled': 'Generation is disabled: {problem} Restart the server after editing .env.',
    'error.http': 'Error {status}',

    'form.script': 'Winning script',
    'form.examples': 'Insert an example',
    'form.examplePlaceholder': 'Example…',
    'form.scriptPlaceholder': 'Paste the script: hook, voiceover, on-screen text, scenes, CTA. Any format.',
    'form.angles': 'Angles',
    'form.count': 'Hooks',
    'form.ctaCount': 'CTAs',
    'form.generate': 'Generate variants',
    'form.pickAngle': 'Pick at least one angle.',
    'form.progress': 'Generating {hooks}… {seconds} s',

    'results.aria': 'Results',
    'empty.title': 'New first three seconds for an ad that already works',
    'empty.body': 'Paste a winning script on the left. The tool suggests hooks across different angles, checks them for risky claims and repeats from the library, and you pick, tweak and hand the brief to production.',

    'seam.aria': 'How the new hook flows into the body of the ad',
    'seam.new': 'New opening, 0–3 s',
    'seam.placeholder': 'Hover a row to read the hook together with the body of the ad',
    'seam.body': 'Body, unchanged',

    'analysis.summary': 'How the model read the winner',
    'analysis.originalHook': 'Original hook',
    'analysis.corePromise': 'Core promise',
    'analysis.bodyStarts': 'Body starts with',
    'analysis.keep': 'Keep unchanged',

    'filters.aria': 'Filter',
    'filter.all': 'All',
    'filter.ok': 'Ready',
    'filter.review': 'Review',
    'filter.duplicate': 'Duplicates',

    'stats.variants': 'Variants',
    'stats.time': 'Time',
    'stats.cost': 'Cost',
    'stats.na': 'n/a',
    'stats.seconds': '{n} s',

    'table.pickAll': 'Select all visible',
    'table.pick': 'Select {id}',
    'col.angle': 'Angle',
    'col.visual': 'First frame',
    'col.line': 'First line',
    'col.screen': 'On-screen text',
    'col.check': 'Check',
    'field.spoken': 'CTA voiceover',
    'field.ctaOnScreen': 'CTA on-screen text',
    'unit.words': 'words',
    'unit.chars': 'chars',

    'check.clean': 'No issues',
    'check.duplicate': 'Repeats {source}: “{text}” (similarity {score})',
    'check.similar': 'Similar to {source}: “{text}” (similarity {score})',
    'check.lengthMatch': '{actual} {unit} (max {max})',
    'source.library': 'a library hook',
    'source.batch': 'another variant in this batch',
    'source.winner': 'the winner’s original hook',

    'ctas.title': 'CTA variants',
    'selection.none': 'Nothing selected',
    'selection.some': 'Selected {items}',
    'selection.and': ' and ',
    'selection.ctas': '{n} CTA',
    'actions.saveLibrary': 'Add to library',
    'actions.exportMd': 'Download brief',
    'actions.exportCsv': 'Export CSV',
    'toast.savedCsv': 'Saved {name}',
    'toast.savedBrief': 'Brief saved: {name}',
    'toast.addedLibrary': 'Added {hooks} to the library. The next run will flag repeats.',

    hooks: { one: '{n} hook', other: '{n} hooks' },

    // Server-provided labels (Ukrainian at the source), overridden by id.
    'angle.pain': 'Pain',
    'angle.curiosity': 'Curiosity',
    'angle.contrarian': 'Contrarian',
    'angle.demo': 'Demo',
    'angle.ugc': 'UGC',
    'angle.humor': 'Humor',
    'angle.family': 'Family',
    'angle.social_proof': 'Social proof',

    'rule.health.label': 'Health claim',
    'rule.health.hint': 'Therapeutic promises about magnets break Meta’s ad policy and have no evidence behind them.',
    'rule.safety.label': 'Safety claim',
    'rule.safety.hint': 'Safety has to be proven (magnets and pacemakers). Remove it or clear it with legal.',
    'rule.absolute.label': 'Absolute promise',
    'rule.absolute.hint': 'Absolute promises are risky (FTC, Meta). Softer: “stay together in the wash”.',
    'rule.superlative.label': 'Superlative',
    'rule.superlative.hint': '“Best” needs proof. Be specific instead.',
    'rule.urgency.label': 'Invented urgency',
    'rule.urgency.hint': 'The offer has no deadline; don’t make one up.',
    'rule.offer.label': 'Terms outside the offer',
    'rule.offer.hint': 'Only “5 pairs for $29, then a new delivery every quarter” is allowed.',
    'rule.proof.label': 'Unverified social proof',
    'rule.proof.hint': 'Social proof must be real. Put in a [PLACEHOLDER] and fill it with real data.',
    'rule.price.label': 'Wrong price',
    'rule.price.hint': 'The only price in the offer is $29 for 5 pairs.',
    'rule.number.label': 'Unverified number',
    'rule.number.hint': 'Is this number real? If not, remove it or use a [PLACEHOLDER].',
    'rule.placeholder.label': 'Placeholder',
    'rule.placeholder.hint': 'Fill in real data before production.',
    'rule.length.label': 'Too long',
    'rule.length.hint.words': 'Has to fit in the first 3 seconds.',
    'rule.length.hint.chars': 'Has to read in one second.',
  },
};

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

let lang = readStored() ?? 'en';

export const getLang = () => lang;

export function setLang(next) {
  if (!LANGS.includes(next)) return;
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {}
}

const fill = (s, params) => s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));

/** Has a string for this key in the current language (no fallback). */
export const has = (key) => typeof dict[lang][key] === 'string';

/** Translate a key; falls back to English, then to `fallback`, then to the key itself. */
export function t(key, params = {}, fallback) {
  const s = dict[lang][key] ?? dict.en[key] ?? fallback ?? key;
  return typeof s === 'string' ? fill(s, params) : key;
}

/** Plural-aware translation; the dictionary entry is an object keyed by Intl.PluralRules category. */
export function tn(key, n) {
  const forms = dict[lang][key] ?? dict.en[key];
  const cat = new Intl.PluralRules(lang).select(n);
  return fill(forms[cat] ?? forms.other, { n });
}

/** Like t(), but `{name}` slots can be DOM nodes. Returns an array for replaceChildren(). */
export function tNodes(key, nodes) {
  const template = dict[lang][key] ?? dict.en[key] ?? key;
  return template.split(/(\{\w+\})/).filter(Boolean).map((part) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return m && m[1] in nodes ? nodes[m[1]] : part;
  });
}

/**
 * Applies translations to static markup:
 *   data-i18n="key"                       → textContent
 *   data-i18n-attr="placeholder:key;aria-label:key2"  → attributes
 */
export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  document.title = t('doc.title');
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  }
}
