import * as z from 'zod';

/**
 * Creative angles a modification can take. The `brief` text goes straight into the prompt,
 * the `label` is what the designer sees in the UI.
 */
export const ANGLES = [
  { id: 'pain', label: 'Біль', brief: 'Name one concrete, annoying everyday moment (sorting laundry, the lonely sock in the drawer).' },
  { id: 'curiosity', label: 'Цікавість', brief: 'Open a loop or ask a question the viewer needs answered; the body pays it off.' },
  { id: 'contrarian', label: 'Всупереч очікуванням', brief: 'A counter-intuitive or bold statement that makes people stop ("Stop buying new socks").' },
  { id: 'demo', label: 'Демо', brief: 'Show the mechanism (cuffs clicking together, pair coming out of the dryer) in the first second.' },
  { id: 'ugc', label: 'UGC', brief: 'First-person creator talking to camera, casual and specific, as a real customer would say it.' },
  { id: 'humor', label: 'Гумор', brief: 'Playful exaggeration or a skit beat (the washer "eats" socks), still on-brand and not mean.' },
  { id: 'family', label: 'Сім’я', brief: 'Relatable family, partner or kids laundry chaos.' },
  { id: 'social_proof', label: 'Соцдоказ', brief: 'Lead with what customers say or do. Use [PLACEHOLDERS] for any real quote, number or name.' },
] as const;

export type AngleId = (typeof ANGLES)[number]['id'];
export const ANGLE_IDS = ANGLES.map((a) => a.id) as [AngleId, ...AngleId[]];
export const DEFAULT_ANGLES: AngleId[] = ['pain', 'curiosity', 'contrarian', 'demo', 'ugc', 'humor'];

/**
 * The JSON shape the model must return (Claude structured outputs).
 * Length limits are deliberately NOT encoded here: the API strips such constraints anyway, and we
 * prefer to flag an over-long line for the designer instead of failing the whole run.
 */
export const GenerationSchema = z.object({
  winner_analysis: z.object({
    original_hook: z.string().describe('The first spoken line of the winning ad, verbatim.'),
    core_promise: z.string().describe('What the ad sells in one sentence.'),
    body_starts_with: z.string().describe('The first line after the hook; every new hook must hand off into it.'),
    keep_unchanged: z.string().describe('What must stay the same in a modification.'),
  }),
  variants: z.array(
    z.object({
      angle: z.string().describe(`One of: ${ANGLE_IDS.join(', ')}`),
      hook_visual: z.string().describe('The opening shot for the first 1-3 seconds.'),
      first_line: z.string().describe('The first spoken line (voice-over or creator).'),
      on_screen_text: z.string().describe('Text overlay shown during the hook.'),
      rationale: z.string().describe('One sentence: why it stops the scroll and how it hands off to the body.'),
    }),
  ),
  ctas: z.array(
    z.object({
      spoken: z.string(),
      on_screen_text: z.string(),
    }),
  ),
});

export type Generation = z.infer<typeof GenerationSchema>;
export type WinnerAnalysis = Generation['winner_analysis'];

export type Severity = 'high' | 'medium' | 'info';
export type CopyField = 'first_line' | 'on_screen_text' | 'hook_visual' | 'spoken';

export interface Flag {
  ruleId: string;
  severity: Severity;
  label: string;
  field: CopyField;
  match: string;
  hint: string;
}

export interface SimilarityHit {
  score: number;
  /** Where the near-duplicate came from. */
  source: 'library' | 'batch' | 'winner';
  text: string;
  field: 'first_line' | 'on_screen_text';
}

export type VariantStatus = 'ok' | 'review' | 'duplicate';

export interface Variant {
  id: string;
  angle: string;
  hookVisual: string;
  firstLine: string;
  onScreenText: string;
  rationale: string;
  flags: Flag[];
  similar: SimilarityHit | null;
  status: VariantStatus;
}

export interface Cta {
  id: string;
  spoken: string;
  onScreenText: string;
  flags: Flag[];
  status: VariantStatus;
}
