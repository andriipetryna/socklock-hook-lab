import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readConfig, type AppConfig } from '../src/config.js';
import { createLlmClient, providerProblem } from '../src/llm/index.js';
import { createApp } from '../src/server.js';
import { readEvents } from '../src/core/runlog.js';
import { FakeLlm, sampleGeneration } from './helpers.js';

/**
 * A stand-in for the Messages API so the real SDK clients (Anthropic and Foundry) are exercised
 * end to end without a key: request shape, auth header, URL path and structured-output parsing.
 */
interface Captured {
  path: string;
  headers: IncomingMessage['headers'];
  body: any;
}
let stub: Server;
let stubUrl: string;
const captured: Captured[] = [];

beforeAll(async () => {
  stub = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = JSON.parse(raw);
      captured.push({ path: req.url ?? '', headers: req.headers, body });
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          model: body.model,
          content: [{ type: 'text', text: JSON.stringify(sampleGeneration) }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 4000, output_tokens: 2000 },
        }),
      );
    });
  });
  await new Promise<void>((r) => stub.listen(0, '127.0.0.1', r));
  stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;
});
afterAll(() => stub.close());

const req = { system: 'sys', user: 'usr', maxTokens: 1000 };

describe('SDK wiring', () => {
  it('Anthropic API: sends structured-output schema and parses the answer', async () => {
    const cfg = readConfig({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-test', ANTHROPIC_BASE_URL: stubUrl });
    const res = await createLlmClient(cfg).generate(req);
    const call = captured.at(-1)!;
    expect(call.path).toBe('/v1/messages');
    // SDK v1 sends the key as a bearer token; older versions used x-api-key
    expect(call.headers['x-api-key'] ?? call.headers.authorization).toMatch(/sk-test/);
    expect(call.body.model).toBe('claude-sonnet-5-5');
    expect(call.body.output_config.format.type).toBe('json_schema');
    expect(call.body.output_config.format.schema.properties).toHaveProperty('variants');
    expect(res.output.variants).toHaveLength(sampleGeneration.variants.length);
    expect(res.usage).toEqual({ inputTokens: 4000, outputTokens: 2000 });
  });

  it('Foundry: same request through the Foundry client and deployment name', async () => {
    const cfg = readConfig({ LLM_PROVIDER: 'foundry', LLM_MODEL: 'my-sonnet-deployment', ANTHROPIC_FOUNDRY_API_KEY: 'az-test', ANTHROPIC_FOUNDRY_BASE_URL: `${stubUrl}/anthropic/` });
    const res = await createLlmClient(cfg).generate(req);
    const call = captured.at(-1)!;
    expect(call.path).toBe('/anthropic/v1/messages');
    expect(call.headers['api-key'] ?? call.headers['x-api-key']).toBe('az-test');
    expect(call.body.model).toBe('my-sonnet-deployment');
    expect(res.output.winner_analysis.original_hook).toBe(sampleGeneration.winner_analysis.original_hook);
  });

  it('explains what is missing in the config', () => {
    expect(providerProblem(readConfig({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: '' }))).toMatch(/ANTHROPIC_API_KEY/);
    expect(providerProblem(readConfig({ LLM_PROVIDER: 'foundry', ANTHROPIC_FOUNDRY_API_KEY: 'k' }))).toMatch(/RESOURCE/);
    expect(providerProblem(readConfig({ LLM_PROVIDER: 'foundry', ANTHROPIC_FOUNDRY_API_KEY: 'k', ANTHROPIC_FOUNDRY_RESOURCE: 'r' }))).toBeNull();
  });
});

describe('HTTP API', () => {
  let server: Server;
  let base: string;
  let config: AppConfig;

  beforeAll(async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hooklab-'));
    copyFileSync('data/hooks_library.csv', join(dir, 'lib.csv'));
    config = readConfig({ LIBRARY_PATH: join(dir, 'lib.csv'), LOG_PATH: join(dir, 'runs.jsonl') });
    server = createApp({ config, llm: new FakeLlm() }).listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());

  const post = (path: string, body: unknown) =>
    fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  it('generate → check an edit → export → save to library, with a run log', async () => {
    const script = readFileSync('examples/winner-02-demo-click.txt', 'utf8');
    const gen = await (await post('/api/generate', { script, count: 5, angles: ['pain', 'curiosity'], ctaCount: 2 })).json();
    expect(gen.variants).toHaveLength(5);

    // designer edits v03 and removes the absolute promise
    const edited = { ...gen.variants[2], firstLine: 'Buy socks once and keep both.' };
    const check = await (await post('/api/check', { originalHook: gen.analysis.original_hook, variants: [edited] })).json();
    expect(check.variants[0].status).toBe('ok');

    const exp = await post('/api/export', {
      format: 'csv',
      runId: gen.runId,
      scriptTitle: gen.scriptTitle,
      analysis: gen.analysis,
      variants: [gen.variants[0], edited],
      ctas: [gen.ctas[0]],
      edited: 1,
      secondsSinceGeneration: 240,
    });
    expect(exp.headers.get('content-disposition')).toContain('.csv');
    const csv = await exp.text();
    expect(csv).toContain('Buy socks once and keep both.');

    const before = (await (await fetch(base + '/api/meta')).json()).librarySize;
    const saved = await (await post('/api/library', { runId: gen.runId, scriptTitle: gen.scriptTitle, variants: [edited] })).json();
    expect(saved).toEqual({ added: 1, librarySize: before + 1 });

    expect(readEvents(config.paths.log).map((e) => e.type)).toEqual(['generated', 'exported', 'saved_to_library']);
  });

  it('returns 400 with a readable message for bad input', async () => {
    const res = await post('/api/generate', { script: 'short', count: 500 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/script|count/);
  });

  it('returns 503 when no provider is configured', async () => {
    const s = createApp({ config, llm: null }).listen(0);
    await new Promise((r) => s.once('listening', r));
    const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    const res = await fetch(url + '/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(res.status).toBe(503);
    const meta = await (await fetch(url + '/api/meta')).json();
    expect(meta.ready).toBe(false);
    s.close();
  });
});
