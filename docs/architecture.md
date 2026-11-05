# Offscript architecture and decision log

Status: initial implementation decisions, 15 October 2026. Source: [PRD](PRD.md). Coverage: [requirement register](requirements.md). This document records the first local milestone and the path to the required public product; it does not assert production readiness or live-provider verification.

## Current milestone

Build a functional local learning notebook: canonical topic records feed an editable note page, tree and map; selected content can open a nested topic; a stored anchor returns to its origin; saved explanations retain provenance. A clearly labeled, removable Statistics notebook supplies illustrative content. New AI answers use the real provider only when configured.

The application runs on `127.0.0.1`. There is no account authentication, tenant boundary or public deployment in this milestone. Its local data file is not a cloud service, a backup or a cross-device sync mechanism. Keep this mode on a single trusted machine and do not expose its server through a tunnel, public interface or shared hosting. The production-mode local preview requires `OFFSCRIPT_LOCAL_PREVIEW=1`; that switch is not production security.

## Components and ownership of data

| Component | Decision | Responsibility |
| --- | --- | --- |
| Web/server | Next.js 16 with React 19 and TypeScript | Same-origin UI/API, validation, local mode gating and real-provider requests |
| Shared types | `src/lib/types.ts` | Explicit notebook/topic/block/anchor/message and response shapes |
| Validation | Server schemas with Zod | Reject unsupported or oversized inputs and unknown block shapes |
| Canonical local data | Node's built-in SQLite module, configured by `OFFSCRIPT_DB_PATH` | Notebooks, topics, immutable revisions, messages, request identity and acknowledged view state |
| Editor | Custom controlled block editor | Direct editing of the first supported block subset and stable block identifiers |
| Visualization | Lightweight topic map and deterministic chart components | Canonical topic navigation and numerically computed normal distribution |
| Local recovery | Browser draft/view state | Unsaved recovery and presentation preferences; never authoritative saved notes |
| AI | Server-side Responses API adapter | Real optional generation, scoped context and typed failure; no sample-answer substitution |

Dependency versions are pinned in `package.json` and its lockfile. The selected runtime is Node 22.13+ within the Node 22 line, including built-in SQLite support. Follow the repository's actual setup commands and tests; installed dependency presence and build results are separate verification evidence.

### Core consistency rules

- A topic has at most one parent, and a parent belongs to the same notebook. Validate ancestry and reject cycles. Tree/map placement is never an alternative content database.
- A top-level block has a stable ID. Edits create immutable revisions and advance a topic's current revision only if the submitted expected revision matches. Conflicts preserve the user's recoverable draft.
- A child captures inherited parent context at creation. Later parent/sibling edits do not silently broaden the child's context. Related topics are not conversation ancestry.
- Store topic creation and its anchor/context together. Creating the topic must not depend on a successful initial AI answer.
- Keep source records and a provenance excerpt when inserting an explanation. Editing a kept block must preserve provenance and mark the edit.
- Return uses the stable original block and preserved quote. Missing or changed targets show the stored excerpt and a fallback; never attach to a different duplicate phrase just because it matches.
- Scope idempotency keys to an operation and persist the original result. An identical repeat returns that result; changed payload under the same key conflicts.
- A provider request cannot be assumed failed merely because the client disconnected. Avoid automatic repeat billable calls after an ambiguous outcome.

## ADR 001 — Local SQLite before hosted PostgreSQL

**Problem.** The workspace needs an immediately usable, durable foundation without inventing an authenticated account or requiring provider provisioning before local development.

**Decision.** Use server-side SQLite for the first loopback-only milestone, behind explicit server/data boundaries. The server owns acknowledged content; browser storage supports drafts and view recovery only.

**Alternatives.** Browser-only storage cannot establish durable server writes. Provisioning Supabase first would provide the intended PostgreSQL/auth foundation but depends on external accounts and credentials that are not part of this milestone.

**Consequences.** Local refresh/restart persistence and revision conflict behavior can be tested now. AUTH01–AUTH04, SEC01/SEC04 tenant isolation, NB03 cross-device/deployment durability, REL03 backups and OPS production gates remain open. SQLite must never be marketed as multi-user production storage. A later migration introduces PostgreSQL, owner-scoped records, Supabase Auth/RLS, private object storage and real environment separation, with a deliberate local data export/import path.

## ADR 002 — Explicit block editor before full Tiptap

**Problem.** The first learning loop needs genuinely editable notes, stable block anchors and deterministic formulas/charts while the full rich editor and licensing decisions are still open.

**Decision.** Implement a small validated block editor with direct controls. The initial type contract includes paragraphs, headings, definitions, examples, formulas, callouts, charts and code. Use stable block IDs and schema validation now so future editing does not require flattened screenshots.

**Alternatives.** Tiptap is the PRD's recommended full editor; adopt it or an equivalent when implementing complete rich selection/paste/history and required block coverage. Avoid installing optional commercial extensions without validating licensing.

**Consequences.** This is partial NOTE01/NOTE02/NOTE07 work. Tables, image/caption/alt editing, safe editable diagrams, all required content roles, robust rich clipboard behavior and full keyboard/undo affordances still need implementation and acceptance evidence. The normal-distribution visual uses deterministic numerical code and editable parameters; it does not establish the complete PRD visual vocabulary.

## ADR 003 — Lightweight map over canonical topics

**Problem.** Learners need to see the branch structure immediately without building a second store of topic content.

**Decision.** Render a lightweight map from the same topics as the notebook/tree. Selecting a topic changes navigation; layout never changes ancestry. The tree remains an accessible structural alternative.

**Alternatives.** React Flow is the recommended later implementation for interactive graph primitives, not a replacement for domain invariants.

**Consequences.** MAP01–MAP06 remain incomplete until edge types, related links, persistent positions/groups, focus/search/zoom/pan, keyboard equivalence and 500/1,000-topic performance evidence exist. No view action may initiate AI work or change context.

## ADR 004 — Real non-streaming provider adapter as an interim step

**Problem.** The app needs a truthful provider path, while durable asynchronous execution and resumable streams require a separate worker/run architecture.

**Decision.** Use a server-only Responses API call when both `OPENAI_API_KEY` and `OPENAI_MODEL` are configured. Keep model selection explicit, use application-managed context and return safe errors. Missing keys disable generation. Seeded sample notes are labeled sample content and are never used as a substitute response.

**Consequences.** No external provider call is verified by configuration code or a mocked test. Non-streaming request execution is partial AI01 work and does not satisfy AI06–AI08. Next add durable run records/events, checkpoints, worker leases, reattachment, Stop/upstream cancellation, bounded safe retries, usage reservation/settlement and model evaluation before shared use. Do not enable uncapped public generation.

## ADR 005 — Explicit ChatGPT plan or API-key connection in Gallery

**Decision.** Add OpenAI's documented local-client OAuth flow with an app-owned registration, PKCE, browser-bound state, signed identity verification and private rotating token storage. Preserve the existing API-key file. A separate provider preference controls each new request; failures never silently switch billing sources. ChatGPT's model catalog supplies its model choices. No ChatGPT history or Codex authentication files are imported.

**Execution.** ChatGPT uses `store:false`, `stream:true` and only supported request fields. A bounded SSE adapter requires `response.completed` before committing an answer; late errors and incomplete streams remain failed runs. The client continues to receive a completed JSON response. This does not implement durable resumable UI streaming. Normal API origin checks remain strict; only the exact OAuth callback accepts cross-site navigation with loopback and transaction verification.

**Scope.** One connected ChatGPT account for this personal local installation, plus a separately retained API connection. No public multi-user deployment or automatic paid fallback. Identity confirmation is distinct from plan permission and model/inference eligibility.

## Intended public architecture (future shared service)

The PRD proposes a Next.js web service and separate Node worker, Supabase PostgreSQL/Auth/private Storage/Queues, a real text/vision provider adapter and separate production email and monitoring. Render is the proposed web/worker host. These remain proposed until owner accounts, region, limits and configuration are chosen.

The web server authenticates, authorizes, validates and creates durable operations. PostgreSQL stores canonical content, revisions, context snapshots, jobs, usage, shares and audit records. Workers lease jobs and commit side effects idempotently. Object storage holds private source files and derived/export assets. A share resolver exposes only an explicitly selected immutable published snapshot. Secrets never enter the client or ordinary logs.

## Production gates

| Gate | Evidence required before public signup |
| --- | --- |
| Identity and isolation | Verified production email auth, secure sessions/CSRF, owner paths, RLS/storage policies, direct API/search/job/share/export cross-user failures |
| Durable learning | Real staged branch/return/keep loop with second-device persistence and honest conflict recovery; AC01–AC06 |
| Full workflow | Required rich content, maps, comparisons, selective atomic merge/undo, imports/citations, history/search, all exports and snapshot sharing; AC07–AC15 |
| AI lifecycle and spend | Durable resumable/cancelable runs, reservations/settlement/global ceilings and provider-specific real tests; AC12/AC16 |
| Privacy and resilience | Account/notebook/source deletion, tombstones, asset/database backups, isolated restore, monitoring, operator/runbooks and rollback; AC17/AC18/AC20 |
| Usability and quality | Keyboard/mobile/screen-reader checks, performance fixtures, observed learning trials and the 40-task AI evaluation set; AC19 and PRD §23/25/28 |
| Ownership | Owner-controlled accounts, operator/contact, domain, sender, policies, budget and final handoff; paid controls remain disabled unless separately selected |

No complete requirement is marked Verified by these decisions alone. Evidence belongs in the register and can be attached only after the corresponding behavior is tested.
