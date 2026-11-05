import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as routes from '../src/app/api/ai/settings/route';
import { askTutor } from '../src/server/ai';
import { OffscriptStore } from '../src/server/db';
import { randomUUID } from 'node:crypto';
import { disconnectChatGPT } from '../src/server/chatgpt-auth';

const names = ['OPENAI_API_KEY', 'OPENAI_MODEL', 'OFFSCRIPT_AI_CONFIG_PATH', 'OFFSCRIPT_CHATGPT_CONFIG_PATH', 'OFFSCRIPT_AI_SELECTION_PATH', 'NODE_ENV'];
let directory: string;
let env: Record<string, string | undefined>;
const originalFetch = globalThis.fetch;
beforeEach(() => {
  env = Object.fromEntries(names.map(name => [name, process.env[name]]));
  directory = mkdtempSync(join(tmpdir(), 'offscript-providers-'));
  process.env.OFFSCRIPT_AI_CONFIG_PATH = join(directory, 'api.json');
  process.env.OFFSCRIPT_CHATGPT_CONFIG_PATH = join(directory, 'chatgpt.json');
  process.env.OFFSCRIPT_AI_SELECTION_PATH = join(directory, 'provider.json');
  process.env.OPENAI_API_KEY = 'sk-test-api-only';
  process.env.OPENAI_MODEL = 'api-test-model';
  Object.assign(process.env, { NODE_ENV: 'test' });
  globalThis.fetch = async () => { throw new Error('Unexpected network request.'); };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of names) { if (env[name] === undefined) delete process.env[name]; else process.env[name] = env[name]; }
  rmSync(directory, { recursive: true, force: true });
});
function request(method = 'GET', value?: unknown, origin = 'http://127.0.0.1:3001') {
  return new Request('http://localhost:3001/api/ai/settings', { method, headers: { host: '127.0.0.1:3001', origin, 'content-type': 'application/json' }, ...(value ? { body: JSON.stringify(value) } : {}) });
}

test('settings exposes both connection choices and preserves existing API-key default', async () => {
  const result = await routes.GET(request());
  const settings = await result.json();
  assert.equal(settings.activeProvider, 'api-key');
  assert.equal(settings.configured, true);
  assert.equal(settings.apiKey.model, 'api-test-model');
  assert.equal(settings.chatgpt.connected, false);
  assert.ok(!JSON.stringify(settings).includes('sk-test'));
});

test('selected but disconnected ChatGPT never falls back to a saved API key', async () => {
  writeFileSync(process.env.OFFSCRIPT_AI_SELECTION_PATH!, JSON.stringify({ version: 1, provider: 'chatgpt' }));
  const settings = await (await routes.GET(request())).json();
  assert.equal(settings.activeProvider, 'chatgpt');
  assert.equal(settings.configured, false);
  assert.equal(settings.apiKey.configured, true);
  const store = new OffscriptStore(join(directory, 'test.sqlite'), false);
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({}); };
  try {
    const { topic } = store.createNotebook({ title: 'No silent charges' });
    await assert.rejects(askTutor(store, { topicId: topic.id, question: 'Hello?', requestKey: randomUUID() }));
    assert.equal(calls, 0);
    assert.equal(store.workspace().messages.length, 0);
  } finally { store.close(); }
});

test('provider changes require same origin and persist only after validating the choice', async () => {
  const patch = routes.PATCH;
  assert.equal(typeof patch, 'function');
  assert.equal((await patch(request('PATCH', { provider: 'api-key' }, 'https://external.example'))).status, 403);
  assert.equal((await patch(request('PATCH', { provider: 'chatgpt' }))).status, 409);
  assert.equal((await patch(request('PATCH', { provider: 'api-key' }))).status, 200);
  assert.equal(statSync(process.env.OFFSCRIPT_AI_SELECTION_PATH!).mode & 0o777, 0o600);
  assert.equal(JSON.parse(readFileSync(process.env.OFFSCRIPT_AI_SELECTION_PATH!, 'utf8')).provider, 'api-key');
  assert.equal((await patch(request('PATCH', { provider: 'invalid' }))).status, 400);
});

test('unreadable provider selection fails closed instead of charging the API', async () => {
  writeFileSync(process.env.OFFSCRIPT_AI_SELECTION_PATH!, 'broken');
  const response = await routes.GET(request());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.configured, false);
  assert.equal(data.activeProvider, null);
  assert.ok(data.selectionError);
  assert.ok(!JSON.stringify(data).includes('sk-test'));
});

function connectTestChatGPT() {
  writeFileSync(process.env.OFFSCRIPT_CHATGPT_CONFIG_PATH!, JSON.stringify({
    version: 1, hostId: 'urn:uuid:11111111-1111-4111-8111-111111111111', generation: '22222222-2222-4222-8222-222222222222',
    registration: { clientId: 'oaiapp_test', issuer: 'https://auth.openai.com', subject: 'test-subject', email: 'test@example.com' },
    credentials: { accessToken: 'test-access', refreshToken: 'test-refresh', idToken: 'test-id', expiresAt: Date.now() + 3_600_000, scopes: ['chatgpt.tokens.use.direct'] },
    model: 'test-model', models: [{ id: 'test-model', name: 'Test model' }], needsReauth: false,
  }), { mode: 0o600 });
  writeFileSync(process.env.OFFSCRIPT_AI_SELECTION_PATH!, JSON.stringify({ version: 1, provider: 'chatgpt' }));
}
function completedAnswer(text: string) {
  return new Response(`data: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] } })}\n\n`);
}

test('ChatGPT generation uses its own credential and supported request, replays once, and retains scoped context', async () => {
  connectTestChatGPT();
  const store = new OffscriptStore(join(directory, 'test.sqlite'), false);
  let calls = 0;
  try {
    const { notebook, topic } = store.createNotebook({ title: 'Statistics' });
    store.updateTopic(topic.id, { expectedRevision: 1, blocks: [{ id: randomUUID(), type: 'paragraph', content: 'ANCESTOR_CONTEXT' }] });
    const child = store.createTopic({ notebookId: notebook.id, parentId: topic.id, title: 'Z-scores', requestKey: randomUUID() });
    const sibling = store.createTopic({ notebookId: notebook.id, parentId: topic.id, title: 'Sibling', requestKey: randomUUID() });
    store.updateTopic(sibling.id, { expectedRevision: 1, blocks: [{ id: randomUUID(), type: 'paragraph', content: 'SIBLING_SECRET' }] });
    globalThis.fetch = async (url, init) => {
      calls++;
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-access');
      const payload = JSON.parse(String(init?.body));
      assert.equal(payload.model, 'test-model');
      assert.equal(payload.stream, true);
      assert.equal(payload.store, false);
      assert.equal('max_output_tokens' in payload, false);
      assert.ok(JSON.stringify(payload).includes('ANCESTOR_CONTEXT'));
      assert.ok(!JSON.stringify(payload).includes('SIBLING_SECRET'));
      return completedAnswer('Two standard deviations above the mean.');
    };
    const input = { topicId: child.id, question: 'What does z = 2 mean?', requestKey: randomUUID() };
    const result = await askTutor(store, input);
    assert.equal(result.message.content, 'Two standard deviations above the mean.');
    assert.deepEqual(await askTutor(store, input), result);
    assert.equal(calls, 1);
    assert.equal(store.workspace().messages.length, 2);
  } finally { store.close(); }
});

test('late ChatGPT failure saves the failed question and never retries through API billing', async () => {
  connectTestChatGPT();
  const store = new OffscriptStore(join(directory, 'test.sqlite'), false);
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response('data: {"type":"response.output_text.delta","delta":"Partial"}\n\ndata: {"type":"response.failed","response":{"error":{"code":"subscription_sharing_usage_limit_exceeded","message":"private-detail"}}}\n\n');
  };
  try {
    const { topic } = store.createNotebook({ title: 'Limits' });
    await assert.rejects(askTutor(store, { topicId: topic.id, question: 'Explain?', requestKey: randomUUID() }), (error: unknown) => (error as { code: string }).code === 'PROVIDER_LIMIT');
    assert.equal(calls, 1);
    const messages = store.workspace().messages;
    assert.equal(messages.length, 2);
    assert.equal(messages.find(message => message.role === 'assistant')?.state, 'failed');
    assert.ok(!JSON.stringify(messages).includes('Partial'));
  } finally { store.close(); }
});

test('cancellation before committing terminal completion leaves the question interrupted', async () => {
  connectTestChatGPT();
  const store = new OffscriptStore(join(directory, 'test.sqlite'), false);
  const controller = new AbortController();
  globalThis.fetch = async () => { controller.abort(); return completedAnswer('Do not save this.'); };
  try {
    const { topic } = store.createNotebook({ title: 'Cancellation' });
    await assert.rejects(askTutor(store, { topicId: topic.id, question: 'Explain?', requestKey: randomUUID() }, controller.signal), (error: unknown) => (error as { code: string }).code === 'RUN_INTERRUPTED');
    const messages = store.workspace().messages;
    assert.equal(messages.length, 2);
    assert.equal(messages.find(message => message.role === 'assistant')?.state, 'interrupted');
  } finally { store.close(); }
});

test('disconnecting ChatGPT stops its active generation and prevents a completed answer', async () => {
  connectTestChatGPT();
  const fixture = JSON.parse(readFileSync(process.env.OFFSCRIPT_CHATGPT_CONFIG_PATH!, 'utf8'));
  delete fixture.credentials.refreshToken;
  writeFileSync(process.env.OFFSCRIPT_CHATGPT_CONFIG_PATH!, JSON.stringify(fixture));
  const store = new OffscriptStore(join(directory, 'test.sqlite'), false);
  const userAbort = new AbortController();
  let started!: () => void;
  const providerStarted = new Promise<void>(resolve => { started = resolve; });
  let requestSignal: AbortSignal | null | undefined;
  globalThis.fetch = async (_url, init) => {
    requestSignal = init?.signal;
    const response = new Response(new ReadableStream({ start(controller) {
      init?.signal?.addEventListener('abort', () => controller.error(new DOMException('Stopped', 'AbortError')), { once: true });
    } }));
    started();
    return response;
  };
  const { topic } = store.createNotebook({ title: 'Disconnect stops answers' });
  const pending = askTutor(store, { topicId: topic.id, question: 'Explain?', requestKey: randomUUID() }, userAbort.signal);
  const outcome = pending.then(() => 'completed', (error: { code: string }) => error.code);
  try {
    await providerStarted;
    await disconnectChatGPT();
    assert.equal(requestSignal?.aborted, true);
    assert.equal(await outcome, 'RUN_INTERRUPTED');
    assert.equal(store.workspace().messages.find(message => message.role === 'assistant')?.state, 'interrupted');
  } finally { userAbort.abort(); await outcome; store.close(); }
});
