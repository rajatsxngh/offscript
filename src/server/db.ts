import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AIInput, BranchQuestionInput, BranchQuestionResult, CreateTopicInput, Message, NoteBlock, Notebook, Topic, UpdateTopicInput, Workspace } from '../lib/types';
import { AppError, assert } from './errors';
import { sampleNotebook } from './seed';
import { aiInputSchema, branchQuestionSchema, createNotebookSchema, createTopicSchema, idSchema, updateTopicSchema } from './validation';

type Row = { data: string };
export interface AIResult { message: Message; userMessage: Message; context: { title: string; inherited: boolean } }
export interface PendingRun { id: string; topicId: string; context: string; title: string; inherited: boolean; userMessage: Message; result?: AIResult }
const now = () => new Date().toISOString();
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
function fingerprint(value: unknown) { return createHash('sha256').update(canonical(value)).digest('hex'); }

/** One trusted local learner. This database layer does not provide tenant authentication. */
export class OffscriptStore {
  readonly db: DatabaseSync;

  constructor(path = resolve(process.cwd(), '.data/offscript.sqlite'), seed = true) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS notebooks (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS topics (
        id TEXT PRIMARY KEY, notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
        parent_id TEXT REFERENCES topics(id) ON DELETE CASCADE, revision INTEGER NOT NULL CHECK(revision > 0), data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS topics_notebook ON topics(notebook_id);
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE, data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS messages_topic ON messages(topic_id);
      CREATE TABLE IF NOT EXISTS revisions (
        topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE, revision INTEGER NOT NULL, data TEXT NOT NULL,
        PRIMARY KEY(topic_id, revision)
      );
      CREATE TABLE IF NOT EXISTS idempotency (
        operation TEXT NOT NULL, key TEXT NOT NULL, fingerprint TEXT NOT NULL,
        notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE, result TEXT NOT NULL,
        PRIMARY KEY(operation, key)
      );
      CREATE TABLE IF NOT EXISTS ai_runs (
        id TEXT PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, fingerprint TEXT NOT NULL,
        topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
        state TEXT NOT NULL CHECK(state IN ('pending', 'complete', 'failed', 'interrupted')),
        context TEXT NOT NULL, user_message TEXT NOT NULL, result TEXT, created_at TEXT NOT NULL, finished_at TEXT
      );
      CREATE INDEX IF NOT EXISTS runs_topic_state ON ai_runs(topic_id, state);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      PRAGMA user_version = 1;
    `);
    if (seed && !this.db.prepare('SELECT value FROM settings WHERE key = ?').get('initialized')) {
      this.transaction(() => {
        const sample = sampleNotebook();
        this.db.prepare('INSERT INTO notebooks (id, data) VALUES (?, ?)').run(sample.notebook.id, JSON.stringify(sample.notebook));
        sample.topics.forEach(topic => this.insertTopic(topic));
        this.setSetting('selectedTopicId', sample.selectedTopicId);
        this.setSetting('initialized', '1');
      });
    }
  }

  close() { this.db.close(); }

  private transaction<T>(callback: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = callback(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  private setSetting(key: string, value: string) {
    this.db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
  }

  private insertTopic(topic: Topic) {
    this.db.prepare('INSERT INTO topics(id, notebook_id, parent_id, revision, data) VALUES (?, ?, ?, ?, ?)').run(topic.id, topic.notebookId, topic.parentId, topic.revision, JSON.stringify(topic));
    this.saveRevision(topic);
  }

  private saveRevision(topic: Topic) {
    this.db.prepare('INSERT INTO revisions(topic_id, revision, data) VALUES (?, ?, ?)').run(topic.id, topic.revision, JSON.stringify({ revision: topic.revision, blocks: topic.blocks, title: topic.title, status: topic.status, createdAt: topic.updatedAt }));
  }

  private touchNotebook(id: string, timestamp: string) {
    const notebook = this.getNotebook(id);
    notebook.updatedAt = timestamp;
    this.db.prepare('UPDATE notebooks SET data = ? WHERE id = ?').run(JSON.stringify(notebook), id);
  }

  getNotebook(id: string): Notebook {
    idSchema.parse(id);
    const row = this.db.prepare('SELECT data FROM notebooks WHERE id = ?').get(id) as Row | undefined;
    assert(row, 'NOT_FOUND', 'Notebook not found.', 404);
    return JSON.parse(row.data);
  }

  getTopic(id: string): Topic {
    idSchema.parse(id);
    const row = this.db.prepare('SELECT data FROM topics WHERE id = ?').get(id) as Row | undefined;
    assert(row, 'NOT_FOUND', 'Topic not found.', 404);
    return JSON.parse(row.data);
  }

  getMessages(topicId: string): Message[] {
    return (this.db.prepare('SELECT data FROM messages WHERE topic_id = ? ORDER BY rowid').all(topicId) as Row[]).map(row => JSON.parse(row.data));
  }

  workspace(aiConfigured = false): Workspace {
    const notebooks: Notebook[] = (this.db.prepare('SELECT data FROM notebooks ORDER BY rowid').all() as Row[]).map(row => JSON.parse(row.data));
    const topics: Topic[] = (this.db.prepare('SELECT data FROM topics ORDER BY rowid').all() as Row[]).map(row => JSON.parse(row.data));
    const messages: Message[] = (this.db.prepare('SELECT data FROM messages ORDER BY rowid').all() as Row[]).map(row => JSON.parse(row.data));
    const selected = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('selectedTopicId') as { value: string } | undefined;
    return { notebooks, topics, messages, selectedTopicId: topics.find(topic => topic.id === selected?.value)?.id || topics[0]?.id || null, aiConfigured, mode: 'local' };
  }

  createNotebook(value: { title: string; description?: string }): { notebook: Notebook; topic: Topic } {
    const input = createNotebookSchema.parse(value);
    return this.transaction(() => {
      const timestamp = now();
      const notebook: Notebook = { id: randomUUID(), title: input.title, description: input.description || '', isSample: false, createdAt: timestamp, updatedAt: timestamp };
      const topic: Topic = { id: randomUUID(), notebookId: notebook.id, parentId: null, title: input.title, description: '', status: 'exploring', blocks: [], revision: 1, anchor: null, inheritedContext: '[]', createdAt: timestamp, updatedAt: timestamp };
      this.db.prepare('INSERT INTO notebooks(id, data) VALUES (?, ?)').run(notebook.id, JSON.stringify(notebook));
      this.insertTopic(topic);
      this.setSetting('selectedTopicId', topic.id);
      return { notebook, topic };
    });
  }

  deleteNotebook(id: string) {
    return this.transaction(() => {
      this.getNotebook(id);
      this.db.prepare('DELETE FROM notebooks WHERE id = ?').run(id);
      const next = this.workspace().selectedTopicId;
      this.setSetting('selectedTopicId', next || '');
      return { ok: true as const };
    });
  }

  private assertAncestry(parent: Topic, notebookId: string) {
    const visited = new Set<string>();
    let current: Topic | null = parent;
    while (current) {
      assert(current.notebookId === notebookId, 'INVALID_PARENT', 'A branch must remain in its parent notebook.');
      assert(!visited.has(current.id), 'INVALID_PARENT', 'The topic hierarchy contains a cycle.');
      visited.add(current.id);
      current = current.parentId ? this.getTopic(current.parentId) : null;
    }
  }

  createTopic(value: CreateTopicInput): Topic {
    const input = createTopicSchema.parse(value);
    return this.transaction(() => {
      this.getNotebook(input.notebookId);
      const digest = fingerprint(input);
      const previous = this.db.prepare('SELECT fingerprint, result FROM idempotency WHERE operation = ? AND key = ?').get('create-topic', input.requestKey) as { fingerprint: string; result: string } | undefined;
      if (previous) {
        assert(previous.fingerprint === digest, 'IDEMPOTENCY_CONFLICT', 'This request key was already used for a different branch.', 409);
        return JSON.parse(previous.result);
      }
      const topic = this.createTopicRecord(input);
      this.db.prepare('INSERT INTO idempotency(operation, key, fingerprint, notebook_id, result) VALUES (?, ?, ?, ?, ?)').run('create-topic', input.requestKey, digest, input.notebookId, JSON.stringify(topic));
      return topic;
    });
  }

  /** Caller owns the transaction so a branch and its first question commit together. */
  private createTopicRecord(input: Omit<CreateTopicInput, 'requestKey'>): Topic {
    const parent = input.parentId ? this.getTopic(input.parentId) : null;
    if (parent) this.assertAncestry(parent, input.notebookId);
    if (input.anchor) {
      assert(parent && input.anchor.topicId === parent.id, 'INVALID_ANCHOR', 'The return anchor must belong to the parent topic.');
      if (input.anchor.blockId) {
        const block = parent.blocks.find(block => block.id === input.anchor!.blockId);
        assert(block, 'INVALID_ANCHOR', 'The selected passage no longer exists. Select it again.');
        assert(input.anchor.blockSnapshot === undefined || input.anchor.blockSnapshot === block.content, 'INVALID_ANCHOR', 'The selected passage changed. Select it again.');
        input.anchor.blockSnapshot = block.content;
      }
    }
    const inherited = parent ? [...JSON.parse(parent.inheritedContext), {
      topicId: parent.id, title: parent.title, revision: parent.revision,
      blocks: parent.blocks, messages: this.getMessages(parent.id).filter(message => message.state === 'complete').map(({ id, role, content }) => ({ id, role, content })),
    }] : [];
    const inheritedContext = JSON.stringify(inherited);
    assert(inheritedContext.length <= 2_000_000, 'CONTEXT_LIMIT', 'This learning path is too large to branch. Create a new root topic instead.');
    const timestamp = now();
    const topic: Topic = { id: randomUUID(), notebookId: input.notebookId, parentId: parent?.id || null, title: input.title, description: input.description || '', status: 'exploring', blocks: [], revision: 1, anchor: input.anchor || (parent ? { topicId: parent.id, quote: '', scrollTop: 0, draft: '' } : null), inheritedContext, createdAt: timestamp, updatedAt: timestamp };
    this.insertTopic(topic);
    this.touchNotebook(topic.notebookId, timestamp);
    this.setSetting('selectedTopicId', topic.id);
    return topic;
  }

  branchFromQuestion(value: BranchQuestionInput): BranchQuestionResult {
    const input = branchQuestionSchema.parse(value);
    return this.transaction(() => {
      const parent = this.getTopic(input.parentId);
      const digest = fingerprint(input);
      const previous = this.db.prepare('SELECT fingerprint, result FROM idempotency WHERE operation = ? AND key = ?').get('branch-question', input.requestKey) as { fingerprint: string; result: string } | undefined;
      if (previous) {
        assert(previous.fingerprint === digest, 'IDEMPOTENCY_CONFLICT', 'This request key was already used for a different question branch.', 409);
        return JSON.parse(previous.result);
      }
      if (input.sourceMessageId) {
        const source = this.getMessages(parent.id).find(message => message.id === input.sourceMessageId);
        assert(source?.role === 'user' && source.state === 'complete' && source.content === input.question, 'INVALID_SOURCE_MESSAGE', 'Choose an unchanged user question from the parent topic.');
      }
      const title = input.question.replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 160).replace(/[\uD800-\uDBFF]$/, '').trimEnd() || 'Follow-up question';
      const topic = this.createTopicRecord({ notebookId: parent.notebookId, parentId: parent.id, title, anchor: input.anchor });
      const question: Message = { id: randomUUID(), topicId: topic.id, role: 'user', content: input.question, state: 'complete', createdAt: now() };
      this.db.prepare('INSERT INTO messages(id, topic_id, data) VALUES (?, ?, ?)').run(question.id, topic.id, JSON.stringify(question));
      const result: BranchQuestionResult = { topic, question };
      this.db.prepare('INSERT INTO idempotency(operation, key, fingerprint, notebook_id, result) VALUES (?, ?, ?, ?, ?)').run('branch-question', input.requestKey, digest, topic.notebookId, JSON.stringify(result));
      return result;
    });
  }

  updateTopic(id: string, value: UpdateTopicInput): Topic {
    const input = updateTopicSchema.parse(value);
    return this.transaction(() => {
      const topic = this.getTopic(id);
      assert(topic.revision === input.expectedRevision, 'REVISION_CONFLICT', 'This topic changed after you opened it. Reload the latest version before saving your edit.', 409);
      const blocks = input.blocks?.map(block => {
        const original = topic.blocks.find(item => item.id === block.id);
        if (!original?.provenance) return block;
        const edited = original.content !== block.content || original.title !== block.title || original.type !== block.type || canonical(original.chart ?? null) !== canonical(block.chart ?? null);
        return { ...block, provenance: { ...original.provenance, ...(edited ? { edited: true } : {}) } };
      });
      if (blocks) for (const block of blocks) {
        if (!block.provenance) continue;
        const source = this.getTopic(block.provenance.topicId);
        assert(source.notebookId === topic.notebookId, 'INVALID_PROVENANCE', 'Saved explanations must come from this notebook.');
        if (block.provenance.messageId) {
          assert(this.getMessages(source.id).some(message => message.id === block.provenance!.messageId && message.role === 'assistant'), 'INVALID_PROVENANCE', 'The original explanation could not be found.');
        }
      }
      const updated: Topic = { ...topic, ...(input.title !== undefined ? { title: input.title } : {}), ...(input.status !== undefined ? { status: input.status } : {}), ...(blocks !== undefined ? { blocks } : {}), revision: topic.revision + 1, updatedAt: now() };
      this.db.prepare('UPDATE topics SET revision = ?, data = ? WHERE id = ? AND revision = ?').run(updated.revision, JSON.stringify(updated), id, topic.revision);
      this.saveRevision(updated);
      this.touchNotebook(topic.notebookId, updated.updatedAt);
      return updated;
    });
  }

  selectTopic(id: string) {
    this.getTopic(id);
    this.setSetting('selectedTopicId', id);
    return { ok: true as const };
  }

  history(id: string): { revision: number; blocks: NoteBlock[]; createdAt: string }[] {
    this.getTopic(id);
    return (this.db.prepare('SELECT data FROM revisions WHERE topic_id = ? ORDER BY revision DESC').all(id) as Row[]).map(row => JSON.parse(row.data));
  }

  beginRun(value: AIInput): PendingRun {
    const input = aiInputSchema.parse(value);
    return this.transaction(() => {
      const topic = this.getTopic(input.topicId);
      const digest = fingerprint(input);
      const previous = this.db.prepare('SELECT * FROM ai_runs WHERE request_key = ?').get(input.requestKey) as { id: string; fingerprint: string; state: string; context: string; result: string | null; user_message: string } | undefined;
      if (previous) {
        assert(previous.fingerprint === digest, 'IDEMPOTENCY_CONFLICT', 'This request key was already used for a different question.', 409);
        if (previous.state === 'complete' && previous.result) {
          const result: AIResult = JSON.parse(previous.result);
          return { id: previous.id, topicId: topic.id, context: previous.context, title: result.context.title, inherited: result.context.inherited, userMessage: result.userMessage, result };
        }
        throw new AppError(409, 'RUN_ALREADY_STARTED', 'This question was already submitted. Reload the discussion to check its result. An interrupted request is never automatically charged again.');
      }
      // A stale run is marked interrupted; its request key still cannot be charged twice.
      this.db.prepare("UPDATE ai_runs SET state = 'interrupted', finished_at = ? WHERE topic_id = ? AND state = 'pending' AND created_at < ?").run(now(), topic.id, new Date(Date.now() - 120_000).toISOString());
      assert(!this.db.prepare("SELECT id FROM ai_runs WHERE topic_id = ? AND state = 'pending'").get(topic.id), 'RUN_IN_PROGRESS', 'Wait for the current answer before asking another question in this topic.', 409);
      const discussion = this.getMessages(topic.id);
      const existingMessage = input.userMessageId ? discussion.find(message => message.id === input.userMessageId) : undefined;
      if (input.userMessageId) {
        assert(existingMessage?.role === 'user' && existingMessage.state === 'complete' && existingMessage.content === input.question, 'INVALID_USER_MESSAGE', 'Choose the matching saved question from this topic.');
        if (existingMessage.runId) {
          const priorRun = this.db.prepare('SELECT state FROM ai_runs WHERE id = ? AND topic_id = ?').get(existingMessage.runId, topic.id) as { state: string } | undefined;
          assert(priorRun?.state === 'failed' || priorRun?.state === 'interrupted', 'MESSAGE_ALREADY_USED', 'This saved question already has an answer or an active request.', 409);
        }
      }
      const runId = randomUUID();
      const userMessage: Message = existingMessage ? { ...existingMessage, runId } : { id: randomUUID(), topicId: topic.id, role: 'user', content: input.question, state: 'complete', createdAt: now(), runId };
      const manifest = {
        title: topic.title, topicId: topic.id, revision: topic.revision,
        ancestorSnapshots: JSON.parse(topic.inheritedContext),
        anchor: topic.anchor ? { topicId: topic.anchor.topicId, blockId: topic.anchor.blockId, quote: topic.anchor.quote } : null,
        notes: topic.blocks, discussion: discussion.filter(message => message.state === 'complete' && message.id !== userMessage.id).map(({ id, role, content }) => ({ id, role, content })),
      };
      const context = JSON.stringify(manifest);
      assert(context.length <= 60_000, 'CONTEXT_LIMIT', 'This discussion is too large for the current tutor context limit. Start a new root topic with a short summary.', 413);
      this.db.prepare('INSERT INTO ai_runs(id, request_key, fingerprint, topic_id, state, context, user_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(runId, input.requestKey, digest, topic.id, 'pending', context, JSON.stringify(userMessage), now());
      if (existingMessage) this.db.prepare('UPDATE messages SET data = ? WHERE id = ? AND topic_id = ?').run(JSON.stringify(userMessage), userMessage.id, topic.id);
      else this.db.prepare('INSERT INTO messages(id, topic_id, data) VALUES (?, ?, ?)').run(userMessage.id, topic.id, JSON.stringify(userMessage));
      return { id: runId, topicId: topic.id, context, title: topic.title, inherited: topic.parentId !== null, userMessage };
    });
  }

  finishRun(run: PendingRun, content: string): AIResult {
    return this.transaction(() => {
      const record = this.db.prepare('SELECT state FROM ai_runs WHERE id = ?').get(run.id) as { state: string } | undefined;
      assert(record?.state === 'pending', 'RUN_INTERRUPTED', 'This answer is no longer active.', 409);
      const message: Message = { id: randomUUID(), topicId: run.topicId, role: 'assistant', content, state: 'complete', createdAt: now(), runId: run.id };
      const result: AIResult = { message, userMessage: run.userMessage, context: { title: run.title, inherited: run.inherited } };
      this.db.prepare('INSERT INTO messages(id, topic_id, data) VALUES (?, ?, ?)').run(message.id, run.topicId, JSON.stringify(message));
      this.db.prepare("UPDATE ai_runs SET state = 'complete', result = ?, finished_at = ? WHERE id = ?").run(JSON.stringify(result), now(), run.id);
      return result;
    });
  }

  failRun(run: PendingRun, interrupted = false) {
    this.transaction(() => {
      const record = this.db.prepare('SELECT state FROM ai_runs WHERE id = ?').get(run.id) as { state: string } | undefined;
      if (record?.state !== 'pending') return;
      const state = interrupted ? 'interrupted' : 'failed';
      const message: Message = { id: randomUUID(), topicId: run.topicId, role: 'assistant', content: interrupted ? 'This answer was interrupted. No response was saved. You can ask again with a new request.' : 'The tutor could not complete this answer. Your question is saved; you can try again.', state, createdAt: now(), runId: run.id };
      this.db.prepare('INSERT INTO messages(id, topic_id, data) VALUES (?, ?, ?)').run(message.id, run.topicId, JSON.stringify(message));
      this.db.prepare('UPDATE ai_runs SET state = ?, finished_at = ? WHERE id = ?').run(state, now(), run.id);
    });
  }
}

const globals = globalThis as unknown as { offscriptStore?: OffscriptStore };
export function getStore() {
  globals.offscriptStore ||= new OffscriptStore(process.env.OFFSCRIPT_DB_PATH);
  return globals.offscriptStore;
}
