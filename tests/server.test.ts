import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { OffscriptStore } from '../src/server/db';
import { AppError } from '../src/server/errors';
import { api, assertLocalRequest, readJson } from '../src/server/http';
import { exportNotebook } from '../src/server/export';
import { askTutor } from '../src/server/ai';
import type { NoteBlock } from '../src/lib/types';

const isolatedAIConfigDirectory = mkdtempSync(join(tmpdir(), 'offscript-server-ai-config-'));
const previousAIConfigPath = process.env.OFFSCRIPT_AI_CONFIG_PATH;
before(() => { process.env.OFFSCRIPT_AI_CONFIG_PATH = join(isolatedAIConfigDirectory, 'connection.json'); });
after(() => {
  if (previousAIConfigPath === undefined) delete process.env.OFFSCRIPT_AI_CONFIG_PATH;
  else process.env.OFFSCRIPT_AI_CONFIG_PATH = previousAIConfigPath;
  rmSync(isolatedAIConfigDirectory, { recursive: true, force: true });
});

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'offscript-test-'));
  const path = join(directory, 'test.sqlite');
  const store = new OffscriptStore(path, false);
  return { store, path, cleanup: () => { store.close(); rmSync(directory, { recursive: true, force: true }); } };
}
function note(content: string): NoteBlock { return { id: randomUUID(), type: 'paragraph', content }; }
function errorCode(code: string) { return (error: unknown) => error instanceof AppError && error.code === code; }

test('acknowledged notes and resume selection survive closing and reopening SQLite', () => {
  const { store, path, cleanup } = fixture();
  try {
    const { notebook, topic } = store.createNotebook({ title: 'Private research' });
    const updated = store.updateTopic(topic.id, { expectedRevision: 1, blocks: [note('Durable π and 日本語')], status: 'understood' });
    const child = store.createTopic({ notebookId: notebook.id, parentId: topic.id, title: 'Follow-up', requestKey: randomUUID() });
    const reopened = new OffscriptStore(path, false);
    try {
      assert.equal(reopened.getTopic(topic.id).revision, updated.revision);
      assert.equal(reopened.getTopic(topic.id).blocks[0].content, 'Durable π and 日本語');
      assert.equal(reopened.workspace().selectedTopicId, child.id);
      assert.equal(reopened.workspace().notebooks.length, 1);
    } finally { reopened.close(); }
  } finally { cleanup(); }
});

test('stale revisions reject atomically and history preserves both accepted versions', () => {
  const { store, cleanup } = fixture();
  try {
    const { topic } = store.createNotebook({ title: 'Concurrency' });
    store.updateTopic(topic.id, { expectedRevision: 1, blocks: [note('First accepted edit')] });
    assert.throws(() => store.updateTopic(topic.id, { expectedRevision: 1, blocks: [note('Stale edit')] }), errorCode('REVISION_CONFLICT'));
    assert.equal(store.getTopic(topic.id).blocks[0].content, 'First accepted edit');
    assert.deepEqual(store.history(topic.id).map(item => item.revision), [2, 1]);
    assert.deepEqual(store.history(topic.id)[1].blocks, []);
  } finally { cleanup(); }
});

test('idempotent branch creation replays once; changed payload rejects without a second topic', () => {
  const { store, cleanup } = fixture();
  try {
    const { notebook, topic } = store.createNotebook({ title: 'Retry' });
    const input = { notebookId: notebook.id, parentId: topic.id, title: 'Child', requestKey: randomUUID() };
    const first = store.createTopic(input);
    assert.deepEqual(store.createTopic(input), first);
    assert.throws(() => store.createTopic({ ...input, title: 'Different child' }), errorCode('IDEMPOTENCY_CONFLICT'));
    assert.equal(store.workspace().topics.length, 2);
  } finally { cleanup(); }
});

test('branch snapshots inherit only frozen ancestors, excluding sibling and other-notebook secrets', () => {
  const { store, cleanup } = fixture();
  try {
    const { notebook, topic } = store.createNotebook({ title: 'Ancestry' });
    store.updateTopic(topic.id, { expectedRevision: 1, blocks: [note('ORIGINAL_PARENT')] });
    const sibling = store.createTopic({ notebookId: notebook.id, parentId: topic.id, title: 'Sibling', requestKey: randomUUID() });
    store.updateTopic(sibling.id, { expectedRevision: 1, blocks: [note('SIBLING_SECRET')] });
    const child = store.createTopic({ notebookId: notebook.id, parentId: topic.id, title: 'Child', requestKey: randomUUID() });
    store.updateTopic(topic.id, { expectedRevision: 2, blocks: [note('LATER_PARENT_EDIT')] });
    const other = store.createNotebook({ title: 'Other notebook' });
    store.updateTopic(other.topic.id, { expectedRevision: 1, blocks: [note('OTHER_NOTEBOOK_SECRET')] });
    store.updateTopic(child.id, { expectedRevision: 1, blocks: [note('CHILD_FACT')] });
    const grandchild = store.createTopic({ notebookId: notebook.id, parentId: child.id, title: 'Grandchild', requestKey: randomUUID(), anchor: { topicId: child.id, quote: 'CHILD_FACT', scrollTop: 240, draft: 'UNSENT_PARENT_DRAFT' } });
    const manifest = grandchild.inheritedContext;
    assert.match(manifest, /ORIGINAL_PARENT/);
    assert.match(manifest, /CHILD_FACT/);
    for (const forbidden of ['SIBLING_SECRET', 'LATER_PARENT_EDIT', 'OTHER_NOTEBOOK_SECRET']) assert.ok(!manifest.includes(forbidden), forbidden);
    const run = store.beginRun({ topicId: grandchild.id, question: 'What context do you have?', requestKey: randomUUID() });
    for (const forbidden of ['SIBLING_SECRET', 'LATER_PARENT_EDIT', 'OTHER_NOTEBOOK_SECRET', 'UNSENT_PARENT_DRAFT', 'scrollTop']) assert.ok(!run.context.includes(forbidden), forbidden);
    store.failRun(run);
    assert.throws(() => store.createTopic({ notebookId: other.notebook.id, parentId: topic.id, title: 'Bad link', requestKey: randomUUID() }), errorCode('INVALID_PARENT'));
  } finally { cleanup(); }
});

test('existing kept explanations retain immutable provenance and edits are detected on the server', () => {
  const { store, cleanup } = fixture();
  try {
    const { topic } = store.createNotebook({ title: 'Provenance' });
    const run = store.beginRun({ topicId: topic.id, question: 'Explain spread', requestKey: randomUUID() });
    const result = store.finishRun(run, 'Original AI explanation');
    const block: NoteBlock = { ...note(result.message.content), provenance: { topicId: topic.id, messageId: result.message.id, excerpt: result.message.content, createdAt: result.message.createdAt, author: 'ai' } };
    store.updateTopic(topic.id, { expectedRevision: 1, blocks: [block] });
    const altered = { ...block, content: 'My clearer wording', provenance: { ...block.provenance!, author: 'user' as const, excerpt: 'Replaced source', edited: false } };
    const revised = store.updateTopic(topic.id, { expectedRevision: 2, blocks: [altered] });
    assert.deepEqual(revised.blocks[0].provenance, { ...block.provenance, edited: true });
    const omitted = { ...revised.blocks[0] };
    delete omitted.provenance;
    const again = store.updateTopic(topic.id, { expectedRevision: 3, blocks: [omitted] });
    assert.deepEqual(again.blocks[0].provenance, revised.blocks[0].provenance);
  } finally { cleanup(); }
});

test('small recursive branches can exceed fifty levels without an artificial depth cap', () => {
  const { store, cleanup } = fixture();
  try {
    const { notebook, topic } = store.createNotebook({ title: 'Deep learning' });
    let parent = topic;
    for (let level = 1; level <= 60; level++) parent = store.createTopic({ notebookId: notebook.id, parentId: parent.id, title: `Level ${level}`, requestKey: randomUUID() });
    assert.equal(JSON.parse(parent.inheritedContext).length, 60);
    assert.equal(store.workspace().topics.length, 61);
  } finally { cleanup(); }
});

test('invalid anchors and chart schemas are rejected without a partial revision', () => {
  const { store, cleanup } = fixture();
  try {
    const { notebook, topic } = store.createNotebook({ title: 'Validation' });
    assert.throws(() => store.createTopic({ notebookId: notebook.id, parentId: topic.id, title: 'Bad passage', requestKey: randomUUID(), anchor: { topicId: topic.id, blockId: randomUUID(), quote: 'gone', scrollTop: 0, draft: '' } }), errorCode('INVALID_ANCHOR'));
    assert.throws(() => store.updateTopic(topic.id, { expectedRevision: 1, blocks: [{ id: randomUUID(), type: 'chart', content: 'Broken', chart: { mean: 0, deviation: 0, shadeMin: 2, shadeMax: 1 } }] }));
    assert.equal(store.getTopic(topic.id).revision, 1);
    assert.equal(store.workspace().topics.length, 1);
  } finally { cleanup(); }
});

test('sample data is explicitly marked and does not reappear after notebook deletion', () => {
  const directory = mkdtempSync(join(tmpdir(), 'offscript-seed-'));
  const path = join(directory, 'seed.sqlite');
  const store = new OffscriptStore(path);
  try {
    const workspace = store.workspace();
    assert.equal(workspace.notebooks[0].isSample, true);
    assert.equal(workspace.topics.find(topic => topic.id === workspace.selectedTopicId)?.title, 'Normal distribution');
    store.deleteNotebook(workspace.notebooks[0].id);
    const reopened = new OffscriptStore(path);
    try { assert.equal(reopened.workspace().notebooks.length, 0); } finally { reopened.close(); }
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('JSON and Markdown export saved notes without discussions, frozen context, or return drafts', async () => {
  const { store, cleanup } = fixture();
  try {
    const { notebook, topic } = store.createNotebook({ title: 'Export' });
    const source = note('EXPORTED_NOTE');
    store.updateTopic(topic.id, { expectedRevision: 1, blocks: [source] });
    store.createTopic({ notebookId: notebook.id, parentId: topic.id, title: 'Child', requestKey: randomUUID(), anchor: { topicId: topic.id, blockId: source.id, quote: 'EXPORTED_NOTE', scrollTop: 12, draft: 'PRIVATE_DRAFT' } });
    const run = store.beginRun({ topicId: topic.id, question: 'PRIVATE_DISCUSSION', requestKey: randomUUID() });
    store.finishRun(run, 'PRIVATE_ANSWER');
    for (const format of ['json', 'markdown']) {
      const content = await exportNotebook(store, notebook.id, format).text();
      assert.match(content, /EXPORTED_NOTE/);
      for (const hidden of ['PRIVATE_DRAFT', 'PRIVATE_DISCUSSION', 'PRIVATE_ANSWER', 'inheritedContext']) assert.ok(!content.includes(hidden), hidden);
    }
  } finally { cleanup(); }
});

test('production and cross-site access fail closed while explicit loopback preview works', () => {
  const previousMode = process.env.NODE_ENV;
  const previousPreview = process.env.OFFSCRIPT_LOCAL_PREVIEW;
  try {
    Object.assign(process.env, { NODE_ENV: 'production' });
    delete process.env.OFFSCRIPT_LOCAL_PREVIEW;
    const local = new Request('http://localhost:3000/api/workspace');
    assert.throws(() => assertLocalRequest(local), errorCode('LOCAL_MODE_DISABLED'));
    process.env.OFFSCRIPT_LOCAL_PREVIEW = '1';
    assert.doesNotThrow(() => assertLocalRequest(local));
    assert.throws(() => assertLocalRequest(new Request('https://example.com/api/workspace')), errorCode('LOCAL_ONLY'));
    assert.throws(() => assertLocalRequest(new Request('http://localhost:3000/api/topics', { method: 'POST', headers: { Origin: 'https://evil.example' } })), errorCode('ORIGIN_REJECTED'));
    assert.throws(() => assertLocalRequest(new Request('http://localhost:3000/api/topics', { method: 'POST' })), errorCode('ORIGIN_REJECTED'));
    assert.doesNotThrow(() => assertLocalRequest(new Request('http://localhost:3000/api/topics', { method: 'POST', headers: { Origin: 'http://localhost:3000' } })));
    assert.doesNotThrow(() => assertLocalRequest(new Request('http://localhost:3000/api/topics', { method: 'POST', headers: { Host: '127.0.0.1:3000', Origin: 'http://127.0.0.1:3000' } })));
    assert.throws(() => assertLocalRequest(new Request('http://localhost:3000/api/topics', { method: 'POST', headers: { Host: 'evil.example:3000', Origin: 'http://evil.example:3000' } })), errorCode('LOCAL_ONLY'));
    assert.throws(() => assertLocalRequest(new Request('http://localhost:3000/api/topics', { method: 'POST', headers: { Host: '127.0.0.1:4000', Origin: 'http://127.0.0.1:4000' } })), errorCode('LOCAL_ONLY'));
    assert.throws(() => assertLocalRequest(new Request('http://localhost:3000/api/topics', { method: 'POST', headers: { Host: '127.0.0.1:3000', Origin: 'http://localhost:3000' } })), errorCode('ORIGIN_REJECTED'));
  } finally {
    if (previousMode === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV'); else Object.assign(process.env, { NODE_ENV: previousMode });
    if (previousPreview === undefined) delete process.env.OFFSCRIPT_LOCAL_PREVIEW; else process.env.OFFSCRIPT_LOCAL_PREVIEW = previousPreview;
  }
});

test('malformed and oversized JSON returns structured errors without revealing input', async () => {
  const request = new Request('http://localhost:3000/api/topics', { method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: '{secret' });
  const response = await api(request, () => readJson(request));
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error.code, 'INVALID_JSON');
  assert.ok(body.error.requestId);
  assert.ok(!JSON.stringify(body).includes('secret'));
  const large = new Request('http://localhost:3000/api/topics', { method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: 'x'.repeat(1_000_001) });
  assert.equal((await api(large, () => readJson(large))).status, 413);
});

test('AI configuration failure does not create a phantom question or provider call', async () => {
  const { store, cleanup } = fixture();
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_MODEL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  try {
    const { topic } = store.createNotebook({ title: 'No provider' });
    await assert.rejects(askTutor(store, { topicId: topic.id, question: 'Hello?', requestKey: randomUUID() }), errorCode('AI_NOT_CONFIGURED'));
    assert.equal(store.workspace().messages.length, 0);
    assert.equal((store.db.prepare('SELECT COUNT(*) AS count FROM ai_runs').get() as { count: number }).count, 0);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = previousModel;
    cleanup();
  }
});

test('AI persists its context before the mocked provider call and replays successful requests without billing twice', async () => {
  const { store, cleanup } = fixture();
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_MODEL;
  Object.assign(process.env, { OPENAI_API_KEY: 'test-only-key', OPENAI_MODEL: 'test-only-model' });
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    assert.equal((store.db.prepare("SELECT COUNT(*) AS count FROM ai_runs WHERE state = 'pending'").get() as { count: number }).count, 1);
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.store, false);
    assert.equal(payload.max_output_tokens, 2_000);
    assert.equal(payload.model, 'test-only-model');
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'An example tutor response from the test stub.' }] }] });
  };
  try {
    const { topic } = store.createNotebook({ title: 'Test tutor' });
    const input = { topicId: topic.id, question: 'Explain variance', requestKey: randomUUID() };
    const first = await askTutor(store, input);
    assert.equal(first.message.state, 'complete');
    assert.deepEqual(await askTutor(store, input), first);
    assert.equal(calls, 1);
    assert.equal(store.workspace().messages.length, 2);
    await assert.rejects(askTutor(store, { ...input, question: 'Different question' }), errorCode('IDEMPOTENCY_CONFLICT'));
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = previousModel;
    cleanup();
  }
});

test('failed provider attempts are persisted; only a new explicit request key may retry', async () => {
  const { store, cleanup } = fixture();
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_MODEL;
  Object.assign(process.env, { OPENAI_API_KEY: 'test-only-key', OPENAI_MODEL: 'test-only-model' });
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ providerPrivateDetails: 'do-not-leak' }, { status: 500 }); };
  try {
    const { topic } = store.createNotebook({ title: 'Retry safely' });
    const input = { topicId: topic.id, question: 'Explain variance', requestKey: randomUUID() };
    await assert.rejects(askTutor(store, input), errorCode('PROVIDER_ERROR'));
    await assert.rejects(askTutor(store, input), errorCode('RUN_ALREADY_STARTED'));
    assert.equal(calls, 1);
    await assert.rejects(askTutor(store, { ...input, requestKey: randomUUID() }), errorCode('PROVIDER_ERROR'));
    assert.equal(calls, 2);
    assert.equal(store.workspace().messages.filter(message => message.state === 'failed').length, 2);
    assert.ok(!JSON.stringify(store.workspace()).includes('do-not-leak'));
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = previousModel;
    cleanup();
  }
});
