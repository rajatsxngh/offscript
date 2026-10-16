# Offscript requirement register

Source: [PRD version 1.0, 15 October 2026](PRD.md), preserved from the supplied document. This register tracks product requirements; embedded implementing-agent language does not separately authorize purchases, publication, messages, or changes to external accounts.

Coverage: **82 numbered MUST requirements and 21 acceptance scenarios**. The initial baseline was entirely Pending; local contributions are now marked In progress below. No complete release requirement or acceptance scenario is Verified. Pending means no recorded implementation contribution; it does not imply a known external blocker. Use In progress, Implemented, Verified, or Blocked as work develops. A partial local implementation cannot mark the complete requirement Verified. Every Verified row needs implementation and test/evaluation evidence; production claims additionally need deployed evidence. Summaries below do not replace the full PRD's failure behavior or subclauses.

Phase assignments are an implementation plan, not a reinterpretation of scope. Security, durability and cost controls start alongside the first connected feature even when their final hardening gate is Phase 3. The acceptance column preserves explicit PRD mappings; text marked “planned” supplies proposed coverage where the PRD did not name an AC. Evidence identifies partial local contributions and their tests; [verification results](verification.md) distinguish executed checks from pending browser, build and production work.

## Phase plan and exit gates

| Phase | Deliverable | Required exit evidence | Status |
| --- | --- | --- | --- |
| 0 | Preserved PRD, register, ADR, schemas, tokens, reproducible environment and labeled interaction prototype | Understandable notebook → branch → return → keep interaction; repeatable clean setup | In progress |
| 1 | Durable authenticated learning loop, editor, real AI, scoped branches, anchors, kept notes and smallest tree | AC01–AC06 in staging; second device; tenant checks for every implemented endpoint | Pending |
| 2 | Map, comparison, merge/undo, imports/citations, search, history, exports and snapshot shares | AC07–AC15; all core journeys use user-generated content | Pending |
| 3 | Quotas, cost control, monitoring/recovery, accessibility, responsive UI, privacy/deletion, backup, support/email and evaluations | AC16–AC19 plus full applicable acceptance suite, AI/performance/accessibility and learning-trial evidence | Pending |
| 4 | Owner-account production resources, domain/HTTPS, matching app/worker deployments and operational handoff | AC20; fresh-account production checks, restore/rollback drills and verified launch checklist | Pending |
| 5 (conditional) | Paid activation if explicitly selected | AC21 plus owner decisions and authorized live transaction; billing remains hidden/disabled otherwise | Pending |

## Numbered product requirements

| ID | Requirement summary | Phase | Acceptance / planned coverage | Status | Implementation and verification evidence |
| --- | --- | --- | --- | --- | --- |
| AUTH01 | Verified email registration, sign-in, recovery, sign-out and retained deep links | 1 | AC01 | Pending | — |
| AUTH02 | Recover expired sessions/links without losing drafts; recent auth for sensitive actions | 1 | AC02, AC13 (planned) | Pending | — |
| AUTH03 | Explicit, audited operator access with MFA and no default private-content browser | 3 | operator MFA/audit integration (planned) | Pending | — |
| AUTH04 | Profile, theme, export and account deletion with safe job cleanup | 3 | AC17 | Pending | — |
| NB01 | Notebook create, rename, duplicate, archive, trash, restore and permanent deletion | 1 | AC01 | In progress | [store](../src/server/db.ts); [server tests](../tests/server.test.ts): local create/permanent delete only; rename/duplicate/archive/trash/restore pending. |
| NB02 | Recent work, last topic and notebook metadata; multiple supported starting points | 1 | AC01 | In progress | [store](../src/server/db.ts); [workspace](../src/components/workspace-app.tsx); [server tests](../tests/server.test.ts): metadata, selected topic and blank entry; other entry modes pending. |
| NB03 | Cross-refresh, deployment and device durability with truthful save states | 1 | AC01 | In progress | [store](../src/server/db.ts); [server tests](../tests/server.test.ts): SQLite reopen durability; [workspace](../src/components/workspace-app.tsx) has acknowledged save state. Deployment/device persistence pending. |
| NB04 | Empty state and removable isolated sample; development fixtures labeled and prohibited in production | 1 | AC01 | In progress | [seed](../src/server/seed.ts); [workspace](../src/components/workspace-app.tsx); [server tests](../tests/server.test.ts): labeled removable sample, no silent provider substitute; public configuration gate pending. |
| NB05 | 30-day recoverable trash, descendant preview, and no new AI/sharing from trashed notebooks | 3 | AC17 | Pending | — |
| BR01 | Create child independently of AI from text, formula, diagram, message or topic; preserve selection | 1 | AC02 | In progress | [workspace](../src/components/workspace-app.tsx); [store](../src/server/db.ts); [server tests](../tests/server.test.ts): selected-block/topic branches persist independently of AI; remaining origin types pending. |
| BR02 | Unbounded model depth; 50-level stored and 12-level interactive tests; reject cycles | 1 | AC02 | In progress | [store](../src/server/db.ts); [server tests](../tests/server.test.ts): 60 stored child levels and ancestry validation; 12-level browser navigation pending. |
| BR03 | Return restores topic, surface, stable target, selection, scroll and unsent draft | 1 | AC02 | In progress | [workspace](../src/components/workspace-app.tsx); [anchors](../src/lib/anchors.ts): block/quote/scroll/draft return state; browser proof and full surface/message anchors pending. |
| BR04 | Stable block plus quote/context anchor; preserve excerpt and fail safely on ambiguity | 1 | AC02, AC03 | In progress | [anchors](../src/lib/anchors.ts); [learning tests](../tests/learning.test.ts): stable block/snapshot and ambiguity fallback; prefix/suffix reattachment pending. |
| BR05 | Persistent anchored quick discussions; atomic promotion without duplication or extra AI charge | 1 | AC04 | Pending | — |
| BR06 | Synchronized parents, children, links, path, rename, collapse, archive and user-selected status | 1 | AC02, AC19 (planned) | In progress | [workspace](../src/components/workspace-app.tsx); [map](../src/components/topic-map.tsx): shared records, parent path and user status; related links/archive/full synchronization pending browser proof. |
| BR07 | Sibling approaches retain isolated immutable context captured at fork | 1 | AC05 | In progress | [store](../src/server/db.ts); [server tests](../tests/server.test.ts): frozen ancestors exclude later edits, siblings, other notebooks and unsent return drafts; authenticated scope pending. |
| BR08 | Explicit validated reparenting; preserve fork history; dragging changes presentation only | 2 | graph mutation unit/integration (planned) | Pending | — |
| NOTE01 | Rich direct editor, required block types, undo/redo, selection, paste and print | 1 | AC06, AC19 (planned) | In progress | [workspace](../src/components/workspace-app.tsx): explicit block editing and print styles; full rich editor/undo/paste/block vocabulary pending. |
| NOTE02 | Versioned structured schema, stable top-level UUIDs and client/server validation | 0–1 | AC03 | In progress | [types](../src/lib/types.ts); [validation](../src/server/validation.ts); [server tests](../tests/server.test.ts): stable UUIDs and validated subset; versioned editor document/full schema pending. |
| NOTE03 | Editable Keep preview, selectable format and destination; explicit later AI applications | 1 | AC06 | In progress | [workspace](../src/components/workspace-app.tsx): editable Keep dialog and destination; structured format proposals and real-provider browser proof pending. |
| NOTE04 | Block provenance with immutable source references and user-edit markers | 1 | AC06 | In progress | [store](../src/server/db.ts); [server tests](../tests/server.test.ts): source message references survive omission/replacement and edits are marked server-side; full source revision/run provenance pending. |
| NOTE05 | Debounced acknowledged saves, durable drafts and expected-revision conflict handling | 1 | AC01, AC13 | In progress | [workspace](../src/components/workspace-app.tsx); [store](../src/server/db.ts); [server tests](../tests/server.test.ts): explicit acknowledged save, localStorage draft and revision rejection; debounce/IndexedDB/performance pending. |
| NOTE06 | Immutable revision history, restore as new revision and readable changes | 2 | revision restore integration (planned) | In progress | [store](../src/server/db.ts); [workspace](../src/components/workspace-app.tsx); [server tests](../tests/server.test.ts): immutable history and history view; restore-as-new/change preview pending. |
| NOTE07 | Editable formulas, chart values, diagram labels/edges, captions and alt text; repair fallback | 1 | AC06 | In progress | [chart](../src/components/normal-curve.tsx); [math](../src/lib/normal-distribution.ts); [learning tests](../tests/learning.test.ts): editable formula/chart subset; diagrams/images/alt/repair UI pending. |
| NOTE08 | Duplicate-concept suggestions and explicit semantic linking without inherited context changes | 2 | related-link isolation unit/integration (planned) | Pending | — |
| MAP01 | Same topic records as notebook; distinguish parent/related links and accessible legend | 2 | canonical-view integration (planned) | In progress | [map](../src/components/topic-map.tsx); [workspace](../src/components/workspace-app.tsx): canonical parent tree/map; related edges and full accessible equivalence pending. |
| MAP02 | Zoom, pan, fit, search, focus, collapse, auto-layout and persisted layout preferences | 2 | map persistence browser (planned) | In progress | [map](../src/components/topic-map.tsx): auto-layout, zoom/reset and scroll container; focus/fit/manual placement/persisted map groups pending. |
| MAP03 | Topic navigation cards with title, excerpt, status and child count; collapsed summaries | 2 | map navigation browser (planned) | In progress | [map](../src/components/topic-map.tsx): topic selection/title/status cards; excerpts/child counts/collapsed summaries pending. |
| MAP04 | Explicit labeled related-link creation, editing and removal; suggestions need acceptance | 2 | link mutation integration (planned) | Pending | — |
| MAP05 | Usable 500-topic map, progressive 1,000-topic fixture and accessible outline fallback | 2 | 500/1,000-topic performance (planned) | Pending | — |
| MAP06 | Preserve selection across views; navigation/layout never alters learning data or charges AI | 2 | view-switch no-charge browser (planned) | In progress | [workspace](../src/components/workspace-app.tsx); [map](../src/components/topic-map.tsx): notebook/map share selected ID; comparison and browser no-charge verification pending. |
| CMP01 | Two/three same-notebook topics with immutable source revisions and source links | 2 | AC07 | Pending | — |
| CMP02 | Editable criteria and distinct agreement, disagreement, uncertainty and conditional advice | 2 | AC07 | Pending | — |
| CMP03 | Responsive aligned comparison, editing and reopening without another generation charge | 2 | AC07 | Pending | — |
| CMP04 | Exact-source claim citations, stale-source indicator and preserved comparison history | 2 | AC07 | Pending | — |
| MERGE01 | Selected conclusions and explicit destination; only approved insertions/replacements | 2 | AC08 | Pending | — |
| MERGE02 | Editable exact-change preview with source, location, deselection, cancellation and conflicts | 2 | AC08 | Pending | — |
| MERGE03 | Transactional idempotent apply with expected revision, history and block provenance | 2 | AC08, AC09 | Pending | — |
| MERGE04 | Inverse-change undo preserves later edits and untouched source branches | 2 | AC09 | Pending | — |
| MERGE05 | Approved merged page enters future target context; existing child forks stay frozen | 2 | context snapshot unit/integration (planned) | Pending | — |
| SRC01 | Server-limited pasted text/Markdown, text PDFs and supported screenshots | 2 | AC10 | Pending | — |
| SRC02 | Private originals, hash, extraction, coordinates, status, attribution and located reader | 2 | AC10 | Pending | — |
| SRC03 | Durable import state and safe same-account exact-upload deduplication | 2 | AC10 | Pending | — |
| SRC04 | Useful rejection/recovery for encrypted, corrupt, oversized, unsupported or scanned PDFs | 2 | AC10 | Pending | — |
| SRC05 | Vision interpretations as editable proposals with uncertainty and original-image references | 2 | AC10 | Pending | — |
| SRC06 | Editable small outline proposal before topic creation; child lessons generated on demand | 2 | AC10 | Pending | — |
| SRC07 | Authorized notebook/explicit source retrieval; supplied-source citation membership and location | 2 | AC10 | Pending | — |
| SRC08 | Treat source instructions as untrusted; no arbitrary fetching/crawling or external authority | 2 | AC10 | Pending | — |
| FIND01 | Tenant-scoped notebook, topic, note and discussion search with filters and located matches | 2 | AC11 | In progress | [workspace](../src/components/workspace-app.tsx): local title/note search; discussion search, filters, located matches and authenticated retrieval pending. |
| FIND02 | Recent activity, user-selected Revisit and acknowledged resume with separate draft recovery | 2 | resume/revisit browser (planned) | In progress | [store](../src/server/db.ts); [workspace](../src/components/workspace-app.tsx); [server tests](../tests/server.test.ts): last selection and separate local draft recovery; Revisit list/recent activity pending. |
| EXPORT01 | Explicit PDF, Markdown/assets and versioned editable JSON export; chats default excluded | 2 | AC15 | In progress | [export](../src/server/export.ts); [server tests](../tests/server.test.ts): scoped Markdown/JSON excludes discussions/context/drafts; PDF/assets/full provenance package pending. |
| EXPORT02 | Durable large exports, scope authorization twice and private short-lived valid downloads | 2 | AC15 | Pending | — |
| SHARE01 | Previewed immutable selected-note snapshots; private material excluded unless explicitly selected | 2 | AC14 | Pending | — |
| SHARE02 | Hashed unguessable tokens and public snapshot-only resolver; noindex | 2 | AC14 | Pending | — |
| SHARE03 | Replace/revoke shares and assets within 60 seconds; explain downloaded-copy limitation | 2 | AC14 | Pending | — |
| SHARE04 | Report link and operator disable workflow; read-only access | 2 | AC14 | Pending | — |
| AI01 | Real production tutoring at learner level; examples and relevant visuals | 1 | AC01 + real-provider evaluation (planned) | In progress | [adapter](../src/server/ai.ts); [server tests](../tests/server.test.ts): optional real Responses adapter with mocked contract proof only; live model/evaluation pending. |
| AI02 | Distinguish sources, added explanation and uncertainty; deterministic numerical visuals | 1 | 40-task AI evaluation + deterministic plot units (planned) | In progress | [adapter](../src/server/ai.ts); [math](../src/lib/normal-distribution.ts); [learning tests](../tests/learning.test.ts): tutor instructions and deterministic chart; citation/source distinction and evaluation pending. |
| AI03 | Exclude unrelated siblings/notebooks; explicit comparison and additional-topic scope | 1 | AC05 | In progress | [store](../src/server/db.ts); [server tests](../tests/server.test.ts): synthetic manifest isolation and allowlisted anchor; comparison/explicit scope and user isolation pending. |
| AI04 | Server token budget, intact question/anchor and versioned history summaries with manifest | 1 | context budget/summary units (planned) | In progress | [store](../src/server/db.ts); [adapter](../src/server/ai.ts): bounded character input/output guard; token budgeting and versioned summarization pending. |
| AI05 | Immutable run context and inherited snapshots; guard note applications by base revision | 1 | frozen context/revision units (planned) | In progress | [store](../src/server/db.ts); [server tests](../tests/server.test.ts): immutable fork/run snapshots and revision guards; explicit parent refresh/proposal revisions pending. |
| AI06 | Persist run before provider call; lifecycle, partial checkpoints and no reopen regeneration | 1 | AC12 | In progress | [store](../src/server/db.ts); [adapter](../src/server/ai.ts); [server tests](../tests/server.test.ts): pre-request run and persisted final/failed states; durable worker/stream/checkpoints pending. |
| AI07 | Stop, upstream cancel, reattach existing run and honest cost; avoid ambiguous duplicate calls | 1 | AC12 | In progress | [adapter](../src/server/ai.ts); [store](../src/server/db.ts); [server tests](../tests/server.test.ts): abort signal and same-key replay protection; Stop/resume/cost accounting pending. |
| AI08 | Bounded transient retries, safe typed errors and non-AI functionality during outages | 1 | AC12, AC18 | In progress | [adapter](../src/server/ai.ts); [HTTP guard](../src/server/http.ts); [server tests](../tests/server.test.ts): bounded request, typed safe failures, explicit retry identity; worker recovery/transient backoff pending. |
| SEC01 | All user-facing PostgreSQL tables and private storage enforce RLS plus API ownership | 0–1 | AC11 | Pending | — |
| SEC02 | Server-only secrets; no client, logs or exports leakage; platform rotation | 1–3 | AC11 | In progress | [adapter](../src/server/ai.ts); [.env example](../.env.example): server-only provider settings; deployed secret rotation and bundle/log audit pending. |
| SEC03 | Safe rendering and upload parsing with schema/link/type allowlists and resource limits | 1–3 | AC11 | In progress | [validation](../src/server/validation.ts); [HTTP guard](../src/server/http.ts); [server tests](../tests/server.test.ts): strict block shapes and bounded request/provider bodies; uploads/diagrams pending. |
| SEC04 | Secure sessions/CSRF, rate limits, verified webhooks and cross-surface tenant isolation | 1–3 | AC05, AC11 | In progress | [HTTP guard](../src/server/http.ts); [server tests](../tests/server.test.ts): loopback/Host/Origin checks only; sessions/CSRF/rate limits/webhooks/tenant tests pending. |
| PRIV01 | Private defaults, clear selected-context provider disclosure and no unconsented own training | 1–3 | provider disclosure/config audit (planned) | Pending | — |
| PRIV02 | Content-free ordinary analytics/logs; exceptional debugging authorized and auditable | 1–3 | log/analytics content audit (planned) | Pending | — |
| PRIV03 | Implemented/published retention, immediate session/share revocation and deletion tombstones | 3 | AC17 | Pending | — |
| REL01 | Account-isolated IndexedDB drafts until acknowledgment; honest offline states and safe sign-out | 1–3 | AC01, AC13 | In progress | [workspace](../src/components/workspace-app.tsx): localStorage recovery drafts; required account-isolated IndexedDB, limited-storage warning and sign-out handling pending. |
| REL02 | Optimistic multi-tab/device concurrency preserves both conflicting versions | 1–3 | AC09, AC13 | In progress | [store](../src/server/db.ts); [workspace](../src/components/workspace-app.tsx); [server tests](../tests/server.test.ts): atomic stale-write rejection and recoverable draft UI; multi-tab/device browser scenario pending. |
| REL03 | Separate DB/assets backup, daily verification and isolated restore drill with RPO/RTO | 3 | AC17, AC20 | Pending | — |
| REL04 | AI outage resilience, health/queue monitoring, safe draining and container-independent state | 3 | AC18 | In progress | [adapter](../src/server/ai.ts); [store](../src/server/db.ts); [server tests](../tests/server.test.ts): provider failure retains question/notes in local DB; health/queues/draining/host durability pending. |
| USAGE01 | Configurable server quotas, visible usage and UTC resets; no charges for non-AI actions | 1–3 | AC04, AC16 | Pending | — |
| USAGE02 | Idempotent cost/action reservation, settlement and interrupted-run reconciliation | 1–3 | AC16 | Pending | — |
| USAGE03 | Owner-approved global ceilings, concurrency/token caps and emergency AI pause | 1–3 | AC16 | Pending | — |
| OPS01 | Isolated local/staging/production, reproducible migrations/builds and protected production | 0–4 | AC20 (planned) | In progress | [package scripts](../package.json); [.env example](../.env.example); [decisions](architecture.md): pinned local baseline; staging/production/migrations/branch protection pending. |
| OPS02 | Versioned service/worker infrastructure, health/maintenance settings and deliberate region/limits | 0–4 | AC18, AC20 (planned) | Pending | — |
| OPS03 | Compatible migrations and app/worker releases; backup and data-preserving rollback | 4 | AC18, AC20 (planned) | Pending | — |
| OPS04 | HTTPS, auth/email callbacks, cookies, verified sender and share-domain configuration | 4 | AC01, AC20 (planned) | Pending | — |

## Acceptance scenarios

A checked local demo is not equivalent to these end-to-end release gates. AC21 is conditional on paid activation; all other applicable scenarios are required before public release.

| ID | Scenario and required observation | Phase gate | Status | Evidence |
| --- | --- | --- | --- | --- |
| AC01 | Account and persistence Create a fresh verified user, start a notebook, ask a real question, edit a note, refresh, sign out, and sign in on another device. All acknowledged content and ownership remain correct. Covers AUTH01, NB01 to NB04, NOTE05, REL01. | 1 | Pending | — |
| AC02 | Deep branch and return Create three nested branches from different content types and return through each origin. Repeat with a 12-level path. Browser back, breadcrumb selection, and Return to where I was preserve drafts and context. Covers BR01 to BR04. | 1 | Pending | — |
| AC03 | Changed anchor Edit, duplicate, move, and delete the originating passage. Return reattaches only when unambiguous; otherwise it shows the preserved excerpt and a clear fallback. It never highlights an unrelated duplicate phrase. Covers BR04, NOTE02. | 1 | Pending | — |
| AC04 | Quick clarification Ask a local question, close and reopen it, then promote it to a topic. Verify that no messages disappear, no duplicate topic appears, and promotion does not trigger a second AI charge. Covers BR05, USAGE01. | 1 | Pending | — |
| AC05 | Branch isolation Put a unique synthetic fact in one sibling and a different fact in another. Inspect actual context manifests for a third branch. Neither fact appears unless explicitly attached. Repeat across two notebooks and two users. Covers BR07, AI03, SEC04. | 1 | Pending | — |
| AC06 | Saved explanation Keep an excerpt, edit its wording, choose a destination, and reopen it. Formula and diagram blocks remain editable. The original source and revision remain reachable. Covers NOTE03, NOTE04, NOTE07. | 1 | Pending | — |
| AC07 | Three approaches Compare three topic revisions with custom criteria. Verify claims against supplied sources. Change one source and confirm the saved comparison is marked out of date while retaining its original result. Covers CMP01 to CMP04. | 2 | Pending | — |
| AC08 | Selective merge Merge selected conclusions from two branches into the parent. Reissue the same apply request and verify one target revision and one merge event. Source branches remain unchanged. Covers MERGE01 to MERGE03. | 2 | Pending | — |
| AC09 | Conflict and undo Edit the target after preview, then attempt apply. It must reject the stale revision. After a valid merge, edit one inserted block and request undo. The app preserves later work and presents the conflict for review. Covers MERGE03, MERGE04, REL02. | 2 | Pending | — |
| AC10 | Source learning Import a text PDF and an image, inspect extraction, generate an explanation, and click every citation. Test a scanned, encrypted, oversized, and corrupt PDF. Unsupported content produces useful recovery instead of invented source claims. Covers SRC01 to SRC08. | 2 | Pending | — |
| AC11 | Tenant isolation With users A and B, attempt direct reads and mutations using each other's topic, source, run, job, export, and storage IDs. Repeat through search and shared routes. Every unauthorized path must fail without revealing private metadata. Covers SEC01 to SEC04, FIND01. | 2 | Pending | — |
| AC12 | Stream recovery Interrupt the network during a real generation, reconnect, and reopen the run. It resumes from persisted state or presents an interrupted result. There is no duplicate provider run caused by reconnect. Stop must cease further local application. Covers AI06 to AI08. | 2 | Pending | — |
| AC13 | Save and device conflicts Disconnect during an edit, close and reopen the tab, then reconnect while a second device has a newer revision. Both versions remain recoverable and Saved appears only after acknowledgment. Covers NOTE05, REL01, REL02. | 2 | Pending | — |
| AC14 | Sharing boundary Publish two selected note pages and inspect the response as an anonymous visitor. No raw chats, unselected topics, or original private files are available. Revoke the link and verify access fails within 60 seconds. Covers SHARE01 to SHARE04. | 2 | Pending | — |
| AC15 | Export portability Export notes containing formulas, charts, images, nested topics, and provenance in all three formats. Inspect the PDF, open Markdown assets, and validate JSON against the versioned schema. Covers EXPORT01, EXPORT02. | 2 | Pending | — |
| AC16 | Limits and costs Exhaust user and global allowances, issue duplicate requests, cancel a run, and simulate provider failure. New billable work is blocked correctly; existing notes remain accessible; cost reservations and actual charges reconcile. Covers USAGE01 to USAGE03. | 3 | Pending | — |
| AC17 | Deletion and retention Delete a source, notebook, and account in separate fixtures. Check search, jobs, shares, storage, and local caches. Restore a backup into isolation and verify deletion tombstones prevent re-exposing deleted content. Covers AUTH04, NB05, PRIV03, REL03. | 3 | Pending | — |
| AC18 | Failure and rollback Stop a worker during a job, return provider errors, expire a secret in staging, and deploy a deliberately unhealthy build. Observe safe recovery, alerts, and rollback without duplicate merges or corrupted notes. Covers AI08, REL04, operations requirements. | 3 | Pending | — |
| AC19 | Accessibility and device support Complete account creation, branching, return, note editing, comparison, merge, and export by keyboard and on supported mobile browsers. Check screen-reader navigation, zoom, contrast, and reduced motion. Covers Section 8 and Section 23. | 3 | Pending | — |
| AC20 | Deployment and recovery Deploy from a clean checkout using the documented procedure. Restore the database and object files into an isolated environment, then run the core learning and privacy tests. Confirm alerts reach the named operator. Covers Section 30 and REL03. | 4 | Pending | — |
| AC21 | Billing when enabled Validate checkout, cancellation, renewal, failed payment, duplicate and out-of-order webhook delivery, and downgrade. Reading and exports remain available as specified. This scenario is mandatory only before paid activation. | 5 (conditional) | Pending | — |

## Required material without standalone requirement IDs

These are identified by their existing PRD sections; no new IDs are attributed to the PRD.

| PRD location | Requirement / acceptance obligation | Phase | Status | Evidence |
| --- | --- | --- | --- | --- |
| §4 | One parent per topic; same-notebook acyclic ancestry; related links may cycle but never silently enter context; map/tree/notebook share canonical records; quick questions remain nonnodes until explicit promotion | 0–2 | Pending | — |
| §5–6 | Journeys A–F: recursive questions, quick clarification, revise/resume, compare/merge, source learning and selected snapshot sharing | 1–2 | Pending | — |
| §7 | Truthful landing/auth/home/workspace/map/comparison/settings/share/support/operations surfaces; stable deep links; auth preserves destination; browser history retains drafts; missing targets recover gracefully | 0–3 | Pending | — |
| §8 | Readable notebook design, all named editable blocks, safe editable diagram vocabulary and deterministic plots; responsive 320px+ layouts; WCAG 2.2 AA, keyboard flow, focus, labels, save announcements, reduced motion, text map alternative, 200% zoom and screen-reader branch/return | 0–3 | Pending | — |
| §16 | Immutable context manifest with IDs/revisions, selection reasons, truncation, model/prompt version and token allocation; understandable inspector; explicit ordered context assembly | 1 | Pending | — |
| §17 | Provider adapter operations for explain/clarify/summarize/propose notes/compare/propose merge/interpret image; streaming/cancel/usage/typed failures; versioned validated results and citation allowlist; at most one bounded repair | 1–2 | Pending | — |
| §18–20 | Modular domain separation; pinned runtime/dependencies; immutable revisions/completed messages, stable IDs/UTC/indexes; private sources, durable jobs and ledgers; transactional expected-revision writes; scoped idempotency with payload conflicts; deletion invalidates dependent records | 0–3 | Pending | — |
| §21 | Authenticated authorized validated rate-limited APIs; ordered resumable stream events and checkpoints; stable safe error envelope; worker lease/heartbeat/commit/ack; bounded retries and ambiguous-call interruption | 1–3 | Pending | — |
| §22 | Accurate owner-approved privacy/terms and audience choices before public signup; no unsupported certification/compliance assertions | 3–4 | Pending | — |
| §23 | Sign-out offers unsynced draft save/download; expiry allows same-account recovery only; documented load profile and performance targets; current/previous desktop browser majors and current iOS Safari/Android Chrome | 1–3 | Pending | — |
| §24 | Measure real token/vision/service/email/storage/egress/monitoring/backup costs at low/expected/high usage; distinguish action units and incurred costs; paid feature lifecycle and owner pricing decisions only if enabled | 3–5 | Pending | — |
| §25 | Content-free pseudonymous product events and preferences; defined session; observed learner trials (10–15 proposed) and evidence of learning-loop completion/recovery/confusion | 3 | Pending | — |
| §28 | At least 40 versioned evaluation tasks (12 math, 8 programming, 8 nontechnical, 6 conflicting comparisons, 6 source/isolation); human clarity/correctness/relevance/visual/uncertainty rubric; no critical unresolved errors; deterministic/integration/browser/real-provider tests and coverage matrix | 1–4 | Pending | — |
| §30 | Monitoring and named alert owner; incident runbooks and emergency pause; full service inventory, setup/migration/deploy/restore/rollback guidance, coverage/evaluation/device evidence, cost model, support, walkthroughs and credential rotation handoff | 3–4 | Pending | — |
| §31 | Milestone-specific owner inputs: repo/provider accounts, budget, domain, sender/support, operators, policies/audience, optional pricing and representative materials; ADRs for material changes | 0–5 | Pending | — |

## First implementation slice

The selected milestone is a loopback-only Next.js 16 / React 19 TypeScript application with canonical server-side SQLite storage. There is no account authentication in this milestone. It establishes a locally durable learning-loop foundation, not a public beta or a completed Phase 1.

1. Establish the workspace, domain/block validation, paper-and-green design tokens, configuration inventory and reproducible commands.
2. Render a removable labeled Statistics sample from the same topic records used by note, tree and lightweight map. Sample notes never stand in for a new AI response.
3. Let the learner edit stable-ID blocks, create anchored children, follow nested branches, return while preserving the draft and reading position, and keep a selected explanation with provenance.
4. Persist immutable revisions, expected-revision writes, idempotent topic/generation requests and captured fork context in SQLite. Browser storage is only draft/view recovery; acknowledged content is canonical on the server.
5. Provide a real, initially non-streaming Responses API adapter only when both `OPENAI_API_KEY` and `OPENAI_MODEL` are configured. Missing configuration produces a truthful unavailable state; no simulated answer is substituted. Provider execution is unverified until tested with configured credentials.
6. Include a deterministic editable normal-distribution chart, local search/history and Markdown/JSON exports. Every capability remains narrower than its complete PRD requirement until that requirement's remaining behavior is implemented and proven.

See [architecture decisions](architecture.md) for local-only guardrails and deviations and [implementation plan](implementation-plan.md) for subsequent integration gates. Full streaming, durable workers, authenticated multi-device storage, RLS, rich editor/map coverage, imports, comparisons, merges, public shares, PDF export and deployment remain later milestones. No complete numbered requirement is marked Verified by this initial register.

## Highest-value invariants and tests

| Invariant | First proof |
| --- | --- |
| Topic parent is owned, in the same notebook and acyclic; deep nesting stays possible | Unit/property tests for self-parent, descendant reparent, foreign notebook and 50-level ancestry; database integration for atomic graph mutations |
| Siblings cannot leak context | Synthetic unique facts in sibling/notebook/user fixtures; inspect actual immutable manifests; related links and view switches never broaden scope |
| Return never selects an unrelated duplicate phrase | Exact stable block match, moved block, duplicate quote, changed prefix/suffix and removed block fixtures; ambiguous cases show original excerpt |
| Saved means server acknowledgment | Interrupted-save and second-device stale-revision test; recover both versions; account-isolated IndexedDB retains draft until acknowledgment |
| Branch creation survives provider failure | Create branch first, fail first run, then retry existing branch; verify one topic and preserved return/context |
| Keep is explicit and provenance survives edits | Edit preview, choose target, apply with base revision, revise wording and follow immutable source |
| Quick-question promotion cannot double-charge or duplicate history | Repeated identical promotion request returns one topic and transferred messages; changed payload reusing key conflicts |
| Generations cannot repeat on reconnect | Persist run before provider; stream reconnect uses same run/event sequence; unknown provider outcome is interrupted, never blindly retried |
| Merge is selective, revision-guarded, atomic and reversible | Same-key duplicate apply, stale preview, source revision changes, post-merge block edits and inverse conflict preview |
| Sharing and exports cannot inherit private scope | Cross-user direct IDs/search/jobs/storage checks; anonymous snapshot contains only selected immutable content; revocation test includes assets |
| No UI view or layout action consumes AI allowance | Topic/map/tree/navigation/collapse tests assert unchanged run and ledger counts |

## External inputs and release limits

The PRD proposes Supabase, Render and an OpenAI adapter, but accounts, model/region selection, budget, domain, sender/support and operator ownership remain unconfirmed in this initial register. Prepare configuration and setup instructions before requesting missing values. Continue independent implementation while these are pending. No external deployment, paid service purchase, public signup, message sending or billing activation is established by the attachment itself.
