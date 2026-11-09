import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import * as z from 'zod';
import { loadDotEnv, readConfig, type AppConfig } from './config.js';
import { ANGLES, DEFAULT_ANGLES } from './schema.js';
import { GenerateInputSchema, generateVariants, scriptTitle } from './core/generate.js';
import { appendToLibrary, loadLibrary } from './core/library.js';
import { evaluateHook, statusFor } from './core/postprocess.js';
import { checkCta } from './core/claims.js';
import { loadRules } from './core/rules.js';
import { logEvent } from './core/runlog.js';
import { toBrief, toCsv } from './export/exporters.js';
import { createLlmClient, LlmError, providerProblem, type LlmClient } from './llm/index.js';

export interface AppDeps {
  config: AppConfig;
  llm: LlmClient | null;
}

const HookCopySchema = z.object({
  id: z.string().default(''),
  angle: z.string().default(''),
  hookVisual: z.string().default(''),
  firstLine: z.string().min(1),
  onScreenText: z.string().default(''),
  rationale: z.string().default(''),
});
const CtaCopySchema = z.object({ id: z.string().default(''), spoken: z.string().min(1), onScreenText: z.string().default('') });
const AnalysisSchema = z.object({
  original_hook: z.string(),
  core_promise: z.string(),
  body_starts_with: z.string(),
  keep_unchanged: z.string(),
});

const CheckBody = z.object({
  originalHook: z.string().default(''),
  variants: z.array(HookCopySchema).default([]),
  ctas: z.array(CtaCopySchema).default([]),
});

const ExportBody = CheckBody.extend({
  format: z.enum(['csv', 'md']),
  runId: z.string().default(''),
  scriptTitle: z.string().default('winner'),
  analysis: AnalysisSchema.nullable().default(null),
  model: z.string().optional(),
  createdAt: z.string().optional(),
  edited: z.number().int().min(0).default(0),
  secondsSinceGeneration: z.number().min(0).nullable().default(null),
});

const LibraryBody = z.object({
  runId: z.string().default(''),
  scriptTitle: z.string().default(''),
  variants: z.array(HookCopySchema).min(1),
});

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'winner';
}

export function createApp({ config, llm }: AppDeps) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));

  // Brand facts, rules and library are re-read on every request so marketers can edit the files without a restart.
  const rules = () => loadRules(config.paths.rules);
  const library = () => loadLibrary(config.paths.library);

  // Example winners for the "try an example" menu.
  app.get('/api/examples', (_req, res) => {
    const dir = fileURLToPath(new URL('../examples', import.meta.url));
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.txt')).sort() : [];
    res.json(files.map((f) => {
      const script = readFileSync(join(dir, f), 'utf8');
      return { file: f, title: scriptTitle(script), script };
    }));
  });

  app.get('/api/meta', (_req, res) => {
    res.json({
      provider: config.provider,
      model: config.model,
      ready: llm !== null,
      problem: llm ? null : providerProblem(config),
      angles: ANGLES.map(({ id, label, brief }) => ({ id, label, brief })),
      defaults: { count: 20, ctaCount: 4, angles: DEFAULT_ANGLES },
      limits: rules().limits,
      similarity: rules().similarity,
      librarySize: library().length,
    });
  });

  app.post('/api/generate', async (req, res) => {
    if (!llm) {
      res.status(503).json({ error: providerProblem(config) ?? 'Провайдер LLM не налаштовано.' });
      return;
    }
    const input = GenerateInputSchema.parse(req.body);
    const result = await generateVariants(input, {
      llm,
      brandFacts: readFileSync(config.paths.brand, 'utf8'),
      rules: rules(),
      library: library(),
    });
    logEvent(config.paths.log, {
      type: 'generated',
      runId: result.runId,
      ts: result.createdAt,
      via: 'web',
      scriptTitle: result.scriptTitle,
      provider: result.provider,
      model: result.model,
      durationMs: result.durationMs,
      costUsd: result.costUsd,
      ...result.stats,
    });
    res.json(result);
  });

  // Re-checks rows after the designer edits them in the table.
  app.post('/api/check', (req, res) => {
    const body = CheckBody.parse(req.body);
    const ctx = { rules: rules(), library: library(), originalHook: body.originalHook };
    res.json({
      variants: body.variants.map((v) => evaluateHook(v, ctx)),
      ctas: body.ctas.map((c) => {
        const flags = checkCta(c, ctx.rules);
        return { flags, status: statusFor(flags, null, ctx.rules) };
      }),
    });
  });

  app.post('/api/export', (req, res) => {
    const body = ExportBody.parse(req.body);
    const ctx = { rules: rules(), library: library(), originalHook: body.analysis?.original_hook ?? body.originalHook };
    // Re-evaluate on export so the flags in the file always match the final (edited) copy.
    const variants = body.variants.map((v) => ({ ...v, ...evaluateHook(v, ctx) }));
    const ctas = body.ctas.map((c) => {
      const flags = checkCta(c, ctx.rules);
      return { ...c, flags, status: statusFor(flags, null, ctx.rules) };
    });
    const payload = { scriptTitle: body.scriptTitle, analysis: body.analysis, variants, ctas, model: body.model, createdAt: body.createdAt };

    logEvent(config.paths.log, {
      type: 'exported',
      runId: body.runId,
      ts: new Date().toISOString(),
      format: body.format,
      selected: variants.length,
      edited: body.edited,
      secondsSinceGeneration: body.secondsSinceGeneration,
    });

    const name = `${slug(body.scriptTitle)}-mods.${body.format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    if (body.format === 'csv') res.type('text/csv; charset=utf-8').send(toCsv(payload));
    else res.type('text/markdown; charset=utf-8').send(toBrief(payload));
  });

  // Closes the loop: hooks the designer is going to produce become "already used" for the next run.
  app.post('/api/library', (req, res) => {
    const body = LibraryBody.parse(req.body);
    const today = new Date().toISOString().slice(0, 10);
    const added = appendToLibrary(
      config.paths.library,
      body.variants.map((v) => ({
        firstLine: v.firstLine,
        onScreenText: v.onScreenText,
        hookVisual: v.hookVisual,
        angle: v.angle,
        status: 'planned',
        source: body.scriptTitle,
        addedAt: today,
      })),
    );
    logEvent(config.paths.log, { type: 'saved_to_library', runId: body.runId, ts: new Date().toISOString(), count: added });
    res.json({ added, librarySize: library().length });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') });
    } else if (err instanceof LlmError) {
      res.status(502).json({ error: err.message });
    } else {
      console.error(err);
      res.status(500).json({ error: (err as Error).message ?? 'Unexpected error' });
    }
  });

  return app;
}

function main() {
  loadDotEnv();
  const config = readConfig();
  const problem = providerProblem(config);
  const llm = problem ? null : createLlmClient(config);
  createApp({ config, llm }).listen(config.port, () => {
    console.log(`SockLock Hook Lab → http://localhost:${config.port}`);
    console.log(`Провайдер: ${config.provider}, модель/деплоймент: ${config.model}`);
    if (problem) console.warn(`⚠ Генерація вимкнена: ${problem} Сторінка відкриється, але кнопка генерації працюватиме лише після виправлення .env.`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
