export type LearningStatus = 'exploring' | 'understood' | 'revisit';
export type BlockType = 'paragraph' | 'heading' | 'definition' | 'example' | 'formula' | 'callout' | 'chart' | 'code';
export interface NoteBlock {
  id: string;
  type: BlockType;
  content: string;
  title?: string;
  provenance?: { messageId?: string; topicId: string; excerpt: string; createdAt: string; author: 'sample' | 'ai' | 'user'; edited?: boolean };
  chart?: { mean: number; deviation: number; shadeMin: number; shadeMax: number };
}
export interface Anchor {
  topicId: string;
  blockId?: string;
  blockSnapshot?: string;
  quote: string;
  scrollTop: number;
  draft: string;
}
export interface Topic {
  id: string;
  notebookId: string;
  parentId: string | null;
  title: string;
  description: string;
  status: LearningStatus;
  blocks: NoteBlock[];
  revision: number;
  anchor: Anchor | null;
  inheritedContext: string;
  createdAt: string;
  updatedAt: string;
}
export interface Notebook { id: string; title: string; description: string; isSample: boolean; createdAt: string; updatedAt: string; }
export interface Message { id: string; topicId: string; role: 'user' | 'assistant'; content: string; state: 'complete' | 'failed' | 'interrupted'; createdAt: string; runId?: string; }
export interface Workspace {
  notebooks: Notebook[];
  topics: Topic[];
  messages: Message[];
  selectedTopicId: string | null;
  aiConfigured: boolean;
  mode: 'local';
}
export interface ApiError { error: { code: string; message: string; retryable: boolean; requestId: string }; }
export interface CreateTopicInput { notebookId: string; parentId?: string | null; title: string; description?: string; anchor?: Anchor | null; requestKey: string; }
export interface BranchQuestionInput { parentId: string; question: string; requestKey: string; sourceMessageId?: string; anchor?: Anchor; }
export interface BranchQuestionResult { topic: Topic; question: Message; }
export interface AIInput { topicId: string; question: string; requestKey: string; userMessageId?: string; }
export interface UpdateTopicInput { title?: string; status?: LearningStatus; blocks?: NoteBlock[]; expectedRevision: number; }

// API contract for the first local learning loop. Responses are never fixtures except explicitly seeded sample content.
// GET /api/workspace -> Workspace
// POST /api/notebooks { title, description? } -> { notebook: Notebook, topic: Topic }
// DELETE /api/notebooks/:id -> { ok: true } (local milestone: permanent deletion)
// POST /api/topics CreateTopicInput -> { topic: Topic } (idempotent)
// POST /api/topics/branch BranchQuestionInput -> BranchQuestionResult (atomic, idempotent; does not call AI)
// PATCH /api/topics/:id UpdateTopicInput -> { topic: Topic } (409 preserves current server version)
// POST /api/view { topicId } -> { ok: true }
// POST /api/ai AIInput -> { message: Message, userMessage: Message, context: { title: string; inherited: boolean } }
// userMessageId reuses an exact saved user question; only unbound or failed/interrupted runs can be bound to a fresh request.
// GET /api/topics/:id/history -> { revisions: { revision: number; blocks: NoteBlock[]; createdAt: string }[] }
// GET /api/export?notebookId=...&format=json|markdown -> download (saved notes, no discussions)
