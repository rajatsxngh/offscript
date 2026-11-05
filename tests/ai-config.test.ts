import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_AI_MODEL, getAIConnection, getAISettings, saveAIConnection } from '../src/server/ai-config';
import { aiConfigured } from '../src/server/ai';
import { AppError } from '../src/server/errors';
import { GET, POST } from '../src/app/api/ai/settings/route';

const originalFetch = globalThis.fetch;
const environmentNames = ['OPENAI_API_KEY', 'OPENAI_MODEL', 'OFFSCRIPT_AI_CONFIG_PATH', 'OFFSCRIPT_LOCAL_PREVIEW', 'NODE_ENV'] as const;
let originalEnvironment: Record<string, string | undefined>;
let directory: string;
let path: string;

beforeEach(() => {
  originalEnvironment = Object.fromEntries(environmentNames.map(key => [key, process.env[key]]));
  directory = mkdtempSync(join(tmpdir(), 'offscript-connection-test-'));
  path = join(directory, 'ai-connection.json');
  process.env.OFFSCRIPT_AI_CONFIG_PATH = path;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  Object.assign(process.env, { NODE_ENV: 'test' });
  globalThis.fetch = async () => { throw new Error('Unmocked provider request is forbidden in this test.'); };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of environmentNames) {
    if (originalEnvironment[key] === undefined) Reflect.deleteProperty(process.env, key);
    else Object.assign(process.env, { [key]: originalEnvironment[key] });
  }
  rmSync(directory, { recursive: true, force: true });
});

function matches(code: string) { return (error: unknown) => error instanceof AppError && error.code === code; }
function localPost(body: unknown, origin = 'http://127.0.0.1:3000') {
  return new Request('http://localhost:3000/api/ai/settings', { method: 'POST', headers: { Host: '127.0.0.1:3000', Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('unconfigured status uses the default model and environment fallback never exposes its key', () => {
  assert.deepEqual(getAISettings(), { configured: false, model: DEFAULT_AI_MODEL, source: null });
  assert.equal(aiConfigured(), false);
  process.env.OPENAI_API_KEY = 'sk-environment-secret-test-only';
  assert.deepEqual(getAISettings(), { configured: true, model: DEFAULT_AI_MODEL, source: 'environment' });
  assert.equal(aiConfigured(), true);
  assert.ok(!JSON.stringify(getAISettings()).includes('secret'));
  process.env.OPENAI_MODEL = 'test-specific-model';
  assert.equal(getAISettings().model, 'test-specific-model');
});

test('connection check is a metadata GET; verified settings persist privately with no secret response', async () => {
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/models/ft%3Atest-model%3Aexample');
    assert.equal(init?.method, 'GET');
    assert.equal(init?.body, undefined);
    assert.equal(init?.redirect, 'error');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer sk-local-secret-test-only');
    return Response.json({ id: 'ft:test-model:example', object: 'model' });
  };
  const settings = await saveAIConnection({ apiKey: 'sk-local-secret-test-only', model: 'ft:test-model:example' });
  assert.deepEqual(settings, { configured: true, model: 'ft:test-model:example', source: 'local' });
  assert.equal(calls, 1);
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).apiKey, 'sk-local-secret-test-only');
  assert.deepEqual(readdirSync(directory), ['ai-connection.json']);
  assert.deepEqual(getAISettings(), settings);
  assert.equal(aiConfigured(), true);
  process.env.OPENAI_API_KEY = 'sk-environment-other-test-only';
  process.env.OPENAI_MODEL = 'other-model';
  assert.equal(getAIConnection()?.source, 'local');
  assert.equal(getAISettings().model, 'ft:test-model:example');
  assert.ok(!JSON.stringify(settings).includes('secret'));
});

test('failed validation preserves an already working connection and returns sanitized provider errors', async () => {
  globalThis.fetch = async () => Response.json({ id: DEFAULT_AI_MODEL });
  await saveAIConnection({ apiKey: 'sk-working-connection-test-only', model: DEFAULT_AI_MODEL });
  const saved = readFileSync(path, 'utf8');
  for (const [status, code] of [[401, 'AI_AUTH_FAILED'], [403, 'AI_ACCESS_DENIED'], [404, 'AI_MODEL_UNAVAILABLE'], [429, 'AI_PROVIDER_LIMIT'], [500, 'AI_CONNECTION_FAILED']] as const) {
    globalThis.fetch = async () => Response.json({ error: { message: 'provider-secret-content' } }, { status });
    await assert.rejects(saveAIConnection({ apiKey: 'sk-rejected-secret-test-only', model: 'other-model' }), error => matches(code)(error) && !String(error).includes('provider-secret-content') && !String(error).includes('sk-rejected'));
    assert.equal(readFileSync(path, 'utf8'), saved);
    assert.equal(getAISettings().model, DEFAULT_AI_MODEL);
  }
});

test('bounded malformed credentials fail before a network request or file write', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({}); };
  for (const input of [
    { apiKey: '', model: DEFAULT_AI_MODEL },
    { apiKey: 'x'.repeat(513), model: DEFAULT_AI_MODEL },
    { apiKey: 'secret\nheader', model: DEFAULT_AI_MODEL },
    { apiKey: 'sk-sample-test-only', model: '../../responses' },
    { apiKey: 'sk-sample-test-only', model: 'x'.repeat(121) },
    { apiKey: 'sk-sample-test-only', model: DEFAULT_AI_MODEL, extra: 'unexpected' },
  ]) await assert.rejects(saveAIConnection(input), matches('INVALID_AI_SETTINGS'));
  assert.equal(calls, 0);
  assert.deepEqual(readdirSync(directory), []);
});

test('aborted and failed network validation creates no stored connection', async () => {
  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = async (_url, init) => { assert.equal(init?.signal?.aborted, true); throw new DOMException('stopped', 'AbortError'); };
  await assert.rejects(saveAIConnection({ apiKey: 'sk-timeout-test-only', model: DEFAULT_AI_MODEL }, { signal: controller.signal }), matches('AI_CONNECTION_TIMEOUT'));
  globalThis.fetch = async () => { throw new Error('network-private-content'); };
  await assert.rejects(saveAIConnection({ apiKey: 'sk-timeout-test-only', model: DEFAULT_AI_MODEL }), error => matches('AI_CONNECTION_FAILED')(error) && !String(error).includes('network-private-content'));
  assert.equal(getAISettings().configured, false);
  assert.deepEqual(readdirSync(directory), []);
});

test('malformed local file safely falls back to environment without revealing stored contents', () => {
  writeFileSync(path, '{malformed-secret-file', { mode: 0o600 });
  process.env.OPENAI_API_KEY = 'sk-fallback-secret-test-only';
  assert.deepEqual(getAISettings(), { configured: true, model: DEFAULT_AI_MODEL, source: 'environment' });
  assert.ok(!JSON.stringify(getAISettings()).includes('secret'));
});

test('settings routes use local origin protection and only return the public status shape', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ id: DEFAULT_AI_MODEL }); };
  const input = { apiKey: 'sk-route-secret-test-only', model: DEFAULT_AI_MODEL };
  const denied = await POST(localPost(input, 'https://evil.example'));
  assert.equal(denied.status, 403);
  assert.equal(calls, 0);
  const saved = await POST(localPost(input));
  assert.equal(saved.status, 200);
  const savedStatus = await saved.json();
  assert.deepEqual(savedStatus.apiKey, { configured: true, model: DEFAULT_AI_MODEL, source: 'local' });
  assert.equal(savedStatus.activeProvider, 'api-key');
  assert.equal(savedStatus.configured, true);
  assert.equal(savedStatus.chatgpt.connected, false);
  assert.ok(!JSON.stringify(savedStatus).includes('sk-route-secret'));
  const status = await GET(new Request('http://localhost:3000/api/ai/settings'));
  assert.equal(status.status, 200);
  assert.equal(status.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await status.json(), savedStatus);
  assert.equal(calls, 1);
});
