import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { OffscriptStore } from '../src/server/db';
import { AppError } from '../src/server/errors';

const errorCode = (code: string) => (error: unknown) => error instanceof AppError && error.code === code;
const paragraph = (content: string) => ({ id: randomUUID(), type: 'paragraph' as const, content });

test('branching saves the complete initial question once without starting an AI run', () => {
  const store = new OffscriptStore(':memory:', false);
  try {
    const { topic: parent } = store.createNotebook({ title: 'Statistics' });
    const question = 'Why does variance square the distance?\n' + 'Please explain with an example. '.repeat(20);
    const input = { parentId: parent.id, question, requestKey: randomUUID() };
    assert.equal(typeof store.branchFromQuestion, 'function');
    const branch = store.branchFromQuestion(input);
    assert.equal(branch.topic.parentId, parent.id);
    assert.equal(branch.topic.notebookId, parent.notebookId);
    assert.ok(branch.topic.title.length <= 160);
    assert.ok(!branch.topic.title.includes('\n'));
    assert.equal(branch.question.content, question.trim());
    assert.equal(branch.question.role, 'user');
    assert.equal(branch.question.state, 'complete');
    assert.equal(branch.question.topicId, branch.topic.id);
    assert.equal(branch.question.runId, undefined);
    assert.equal(branch.topic.anchor?.blockId, undefined);
    assert.deepEqual(store.branchFromQuestion(input), branch);
    assert.equal(store.workspace().topics.length, 2);
    assert.equal(store.getMessages(branch.topic.id).length, 1);
    assert.equal((store.db.prepare('SELECT COUNT(*) AS count FROM ai_runs').get() as { count: number }).count, 0);
    assert.throws(() => store.branchFromQuestion({ ...input, question: 'A different question' }), errorCode('IDEMPOTENCY_CONFLICT'));
  } finally { store.close(); }
});

test('a question branch inherits frozen ancestors but never sibling or other-map content', () => {
  const store = new OffscriptStore(':memory:', false);
  try {
    const { topic: root } = store.createNotebook({ title: 'Statistics' });
    store.updateTopic(root.id, { expectedRevision: 1, blocks: [paragraph('ROOT_AT_FORK')] });
    const parent = store.createTopic({ notebookId: root.notebookId, parentId: root.id, title: 'Variance', requestKey: randomUUID() });
    store.updateTopic(root.id, { expectedRevision: 2, blocks: [paragraph('LATER_ROOT_EDIT')] });
    store.updateTopic(parent.id, { expectedRevision: 1, blocks: [paragraph('CURRENT_PARENT_NOTE')] });
    const sibling = store.createTopic({ notebookId: root.notebookId, parentId: root.id, title: 'Sibling', requestKey: randomUUID() });
    store.updateTopic(sibling.id, { expectedRevision: 1, blocks: [paragraph('SIBLING_SECRET')] });
    const other = store.createNotebook({ title: 'Other map' });
    store.updateTopic(other.topic.id, { expectedRevision: 1, blocks: [paragraph('OTHER_MAP_SECRET')] });
    const branch = store.branchFromQuestion({ parentId: parent.id, question: 'Why square it?', requestKey: randomUUID() });
    assert.match(branch.topic.inheritedContext, /ROOT_AT_FORK/);
    assert.match(branch.topic.inheritedContext, /CURRENT_PARENT_NOTE/);
    for (const excluded of ['LATER_ROOT_EDIT', 'SIBLING_SECRET', 'OTHER_MAP_SECRET']) assert.ok(!branch.topic.inheritedContext.includes(excluded));
    store.updateTopic(parent.id, { expectedRevision: 2, blocks: [paragraph('AFTER_CHILD_FORK')] });
    assert.ok(!store.getTopic(branch.topic.id).inheritedContext.includes('AFTER_CHILD_FORK'));
  } finally { store.close(); }
});

test('promoting a parent follow-up validates its exact source and leaves the original discussion intact', () => {
  const store = new OffscriptStore(':memory:', false);
  try {
    const { topic: parent } = store.createNotebook({ title: 'Statistics' });
    const run = store.beginRun({ topicId: parent.id, question: 'Why square the difference?', requestKey: randomUUID() });
    const answer = store.finishRun(run, 'It removes the sign.');
    const input = { parentId: parent.id, question: run.userMessage.content, sourceMessageId: run.userMessage.id, requestKey: randomUUID() };
    const branch = store.branchFromQuestion(input);
    assert.notEqual(branch.question.id, run.userMessage.id);
    assert.equal(branch.question.content, run.userMessage.content);
    assert.equal(store.getMessages(parent.id).length, 2);
    assert.equal(store.getMessages(branch.topic.id).length, 1);
    const before = store.workspace().topics.length;
    assert.throws(() => store.branchFromQuestion({ ...input, question: 'Altered source question', requestKey: randomUUID() }), errorCode('INVALID_SOURCE_MESSAGE'));
    assert.throws(() => store.branchFromQuestion({ ...input, sourceMessageId: answer.message.id, requestKey: randomUUID() }), errorCode('INVALID_SOURCE_MESSAGE'));
    const other = store.createNotebook({ title: 'Other map' });
    assert.throws(() => store.branchFromQuestion({ ...input, parentId: other.topic.id, requestKey: randomUUID() }), errorCode('INVALID_SOURCE_MESSAGE'));
    assert.equal(store.workspace().topics.length, before + 1);
  } finally { store.close(); }
});

test('invalid anchors and failed question inserts leave no partial branch or replay record', () => {
  const store = new OffscriptStore(':memory:', false);
  try {
    const { topic: parent } = store.createNotebook({ title: 'Atomic branch' });
    const input = { parentId: parent.id, question: 'Explain this term', requestKey: randomUUID() };
    assert.throws(() => store.branchFromQuestion({ ...input, anchor: { topicId: parent.id, blockId: randomUUID(), quote: 'missing', scrollTop: 0, draft: '' } }), errorCode('INVALID_ANCHOR'));
    store.db.exec("CREATE TRIGGER reject_test_message BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT, 'injected message write failure'); END");
    assert.throws(() => store.branchFromQuestion(input), /injected message write failure/);
    assert.equal(store.workspace().topics.length, 1);
    assert.equal(store.workspace().selectedTopicId, parent.id);
    assert.equal((store.db.prepare('SELECT COUNT(*) AS count FROM idempotency').get() as { count: number }).count, 0);
    store.db.exec('DROP TRIGGER reject_test_message');
    const branch = store.branchFromQuestion(input);
    assert.equal(store.getMessages(branch.topic.id).length, 1);
  } finally { store.close(); }
});

test('first AI run binds a saved question without duplicating it in messages or local context', () => {
  const store = new OffscriptStore(':memory:', false);
  try {
    const { topic: parent } = store.createNotebook({ title: 'Statistics' });
    const branch = store.branchFromQuestion({ parentId: parent.id, question: 'Explain variance', requestKey: randomUUID() });
    const input = { topicId: branch.topic.id, question: branch.question.content, userMessageId: branch.question.id, requestKey: randomUUID() };
    const run = store.beginRun(input);
    assert.equal(run.userMessage.id, branch.question.id);
    assert.equal(run.userMessage.runId, run.id);
    assert.equal(store.getMessages(branch.topic.id).length, 1);
    assert.deepEqual(JSON.parse(run.context).discussion, []);
    assert.throws(() => store.beginRun({ ...input, requestKey: randomUUID() }), errorCode('RUN_IN_PROGRESS'));
    const result = store.finishRun(run, 'Variance is average squared distance.');
    assert.deepEqual(store.beginRun(input).result, result);
    assert.equal(store.getMessages(branch.topic.id).length, 2);
    assert.throws(() => store.beginRun({ ...input, requestKey: randomUUID() }), errorCode('MESSAGE_ALREADY_USED'));
  } finally { store.close(); }
});

test('an explicitly retried failed or interrupted answer reuses its matching saved user question', () => {
  const store = new OffscriptStore(':memory:', false);
  try {
    const { topic: parent } = store.createNotebook({ title: 'Statistics' });
    const branch = store.branchFromQuestion({ parentId: parent.id, question: 'Explain variance', requestKey: randomUUID() });
    const base = { topicId: branch.topic.id, question: branch.question.content, userMessageId: branch.question.id };
    const first = store.beginRun({ ...base, requestKey: randomUUID() });
    store.failRun(first);
    const retry = store.beginRun({ ...base, requestKey: randomUUID() });
    store.failRun(retry, true);
    const final = store.beginRun({ ...base, requestKey: randomUUID() });
    store.finishRun(final, 'The successful answer.');
    assert.equal(store.getMessages(branch.topic.id).filter(message => message.role === 'user').length, 1);
    assert.equal(store.getMessages(branch.topic.id).find(message => message.role === 'user')?.runId, final.id);
  } finally { store.close(); }
});

test('AI cannot bind a message from another topic or change its saved question', () => {
  const store = new OffscriptStore(':memory:', false);
  try {
    const { topic: parent } = store.createNotebook({ title: 'Statistics' });
    const branch = store.branchFromQuestion({ parentId: parent.id, question: 'Explain variance', requestKey: randomUUID() });
    const input = { topicId: branch.topic.id, question: branch.question.content, userMessageId: branch.question.id, requestKey: randomUUID() };
    assert.throws(() => store.beginRun({ ...input, topicId: parent.id }), errorCode('INVALID_USER_MESSAGE'));
    assert.throws(() => store.beginRun({ ...input, question: 'Replace the saved content' }), errorCode('INVALID_USER_MESSAGE'));
    assert.equal(store.getMessages(branch.topic.id)[0].content, 'Explain variance');
    assert.equal((store.db.prepare('SELECT COUNT(*) AS count FROM ai_runs').get() as { count: number }).count, 0);
  } finally { store.close(); }
});
