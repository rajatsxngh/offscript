import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Exercises the local HTTP contract without sending any question to a provider.
const base = new URL(process.env.OFFSCRIPT_TEST_URL || 'http://127.0.0.1:3000');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname));
const request = (path, method = 'GET', body, origin = base.origin) => fetch(new URL(path, base), {
  method, headers: { Origin: origin, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
async function json(path, method, body) {
  const response = await request(path, method, body);
  assert.ok(response.ok, `${path} returned HTTP ${response.status}`);
  return response.json();
}

let fixtureId;
const before = await json('/api/workspace');
try {
  const settings = await json('/api/ai/settings');
  assert.deepEqual(Object.keys(settings).sort(), ['configured', 'model', 'source']);
  assert.equal((await request('/api/ai/settings', 'POST', {}, 'https://untrusted.example')).status, 403);
  assert.equal((await request('/api/ai/settings', 'POST', { apiKey: '', model: '' })).status, 400);

  const fixture = await json('/api/notebooks', 'POST', { title: 'Temporary AI branching smoke check' });
  fixtureId = fixture.notebook.id;
  const input = { parentId: fixture.topic.id, question: 'How does a z-score compare values across distributions?', requestKey: randomUUID() };
  const branch = await json('/api/topics/branch', 'POST', input);
  const replay = await json('/api/topics/branch', 'POST', input);
  assert.equal(replay.topic.id, branch.topic.id);
  assert.equal(replay.question.id, branch.question.id);
  assert.equal(branch.topic.parentId, fixture.topic.id);
  assert.equal(branch.question.topicId, branch.topic.id);
  assert.equal(branch.question.content, input.question);
  assert.equal((await request('/api/topics/branch', 'POST', { ...input, question: 'A different question' })).status, 409);

  const nested = await json('/api/topics/branch', 'POST', { parentId: branch.topic.id, question: branch.question.content, sourceMessageId: branch.question.id, requestKey: randomUUID() });
  assert.equal(nested.topic.parentId, branch.topic.id);
  assert.ok(JSON.parse(nested.topic.inheritedContext).some(context => context.messages.some(message => message.id === branch.question.id)));
  const saved = await json('/api/workspace');
  assert.equal(saved.topics.filter(topic => topic.notebookId === fixtureId).length, 3);
  assert.equal(saved.messages.filter(message => message.topicId === branch.topic.id).length, 1);
  assert.equal(saved.messages.filter(message => message.topicId === nested.topic.id).length, 1);
  console.log('AI HTTP smoke passed: safe settings, protected writes, atomic question branches, idempotent replay, source promotion, inherited conversation and saved first questions. No AI generation requested.');
} finally {
  if (fixtureId) assert.ok((await request(`/api/notebooks/${fixtureId}`, 'DELETE')).ok, 'Fixture cleanup failed');
  if (before.selectedTopicId) assert.ok((await request('/api/view', 'POST', { topicId: before.selectedTopicId })).ok, 'Resume location restoration failed');
}
