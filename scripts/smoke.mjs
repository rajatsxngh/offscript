import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.OFFSCRIPT_TEST_URL || 'http://127.0.0.1:3000';
const url = new URL(base);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Smoke checks are only allowed against a local server.');
const request = (path, method = 'GET', body, headers = {}) => fetch(`${base}${path}`, {
  method, headers: { Origin: url.origin, 'Content-Type': 'application/json', ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const json = async (path, method, body) => {
  const response = await request(path, method, body);
  assert.ok(response.ok, `${method || 'GET'} ${path}: ${response.status} ${await response.clone().text()}`);
  return response.json();
};

let notebookId;
try {
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Offscript/i);
  const forbidden = await request('/api/notebooks', 'POST', { title: 'must not create' }, { Origin: 'https://untrusted.example' });
  assert.equal(forbidden.status, 403, 'Cross-origin writes must be rejected');
  const malformed = await request('/api/notebooks', 'POST', { title: '' });
  assert.equal(malformed.status, 400, 'Invalid input must be rejected');

  const created = await json('/api/notebooks', 'POST', { title: `Smoke check ${randomUUID()}`, description: 'Temporary automated check' });
  notebookId = created.notebook.id;
  let parent = created.topic;
  const originBlock = { id: randomUUID(), type: 'paragraph', content: 'The original learning passage.' };
  parent = (await json(`/api/topics/${parent.id}`, 'PATCH', { expectedRevision: parent.revision, blocks: [originBlock] })).topic;
  const rootId = parent.id;
  const rootRevision = parent.revision;
  const requestKey = randomUUID();
  const branchInput = { notebookId, parentId: rootId, title: 'First branch', requestKey, anchor: { topicId: rootId, blockId: originBlock.id, quote: 'original learning passage', scrollTop: 220, draft: 'My question in progress' } };
  const first = (await json('/api/topics', 'POST', branchInput)).topic;
  const repeated = (await json('/api/topics', 'POST', branchInput)).topic;
  assert.equal(repeated.id, first.id, 'Repeated branch creation must not duplicate');
  assert.equal(first.anchor.draft, 'My question in progress');
  assert.match(first.inheritedContext, /original learning passage/);

  parent = first;
  for (let depth = 2; depth <= 12; depth++) {
    parent = (await json('/api/topics', 'POST', { notebookId, parentId: parent.id, title: `Branch level ${depth}`, requestKey: randomUUID() })).topic;
  }
  await json(`/api/topics/${rootId}`, 'PATCH', { expectedRevision: rootRevision, blocks: [{ ...originBlock, content: 'A later revision.' }] });
  const conflict = await request(`/api/topics/${rootId}`, 'PATCH', { expectedRevision: rootRevision, title: 'Stale change' });
  assert.equal(conflict.status, 409, 'A stale save must not overwrite the newer page');
  await json('/api/view', 'POST', { topicId: parent.id });
  const workspace = await json('/api/workspace');
  assert.equal(workspace.selectedTopicId, parent.id);
  assert.equal(workspace.topics.filter(topic => topic.notebookId === notebookId).length, 13);
  assert.match(workspace.topics.find(topic => topic.id === first.id).inheritedContext, /original learning passage/);
  assert.doesNotMatch(workspace.topics.find(topic => topic.id === first.id).inheritedContext, /A later revision/);
  const history = await json(`/api/topics/${rootId}/history`);
  assert.equal(history.revisions.length, 3);
  const markdown = await request(`/api/export?notebookId=${notebookId}&format=markdown`);
  assert.ok(markdown.ok);
  assert.match(await markdown.text(), /A later revision/);
  const exported = await request(`/api/export?notebookId=${notebookId}&format=json`);
  assert.ok(exported.ok);
  const packageData = await exported.json();
  assert.ok(packageData);
  assert.doesNotMatch(JSON.stringify(packageData), /My question in progress/, 'Default notes export must not leak private return drafts');
  console.log('HTTP smoke passed: page, same-origin validation, input validation, persisted notes, 12-level branches, idempotency, frozen context, revision conflicts, history, view state, and notes exports.');
} finally {
  if (notebookId) {
    const deleted = await request(`/api/notebooks/${notebookId}`, 'DELETE');
    assert.ok(deleted.ok, 'Temporary smoke notebook cleanup must succeed');
  }
}
