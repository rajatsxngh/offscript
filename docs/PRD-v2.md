# Offscript Product Requirements

**Version:** 2.0 working draft

**Date:** 5 November 2026

**Product owner:** Rajat Singh

**Audience:** Product, design and engineering

Offscript is a visual learning workspace where each concept has a place on a map, its own AI conversation and editable notes. A learner can turn a follow-up question into a connected topic, explore it, and return without losing the original context.

This PRD consolidates the founder’s decisions and the existing prototype into a buildable product direction. The immediate priority is to understand the founder’s usability concerns through actual use and direct feedback, improve the experience based on that evidence, then validate the complete learning experience and establish the requirements for independent users. Gallery is the confirmed visual direction; its current usability has not been accepted. The current prototype is not a public multi-user service.

**Document status:** Confirmed product decisions are distinguished from proposed targets and unresolved launch choices. The original PRD remains preserved. This revision supersedes its notebook-first presentation wherever that conflicts with the founder’s later map-first direction. It does not silently remove its broader public-release commitments.

## 1 Product direction

### The problem

Learning rarely follows a straight line. An explanation introduces an unfamiliar term; investigating that term produces another question. A chronological chat mixes these paths together. Learners lose their place, repeat context and reconstruct useful explanations in separate notes or screenshots.

Offscript should preserve both the explanation and the path that led to it. The product hypothesis is that spatial organization, scoped conversations and reliable return navigation will make exploratory learning easier to resume. Better learning outcomes have not yet been demonstrated.

### Product principles

- **Keep curiosity connected.** A branch has an understandable origin and a reliable route back.
- **Make each concept a place.** A node represents a topic with a conversation and saved notes; individual chat messages are not automatically nodes.
- **Preserve the learner’s work.** Drafts, acknowledged saves, branch origins and useful explanations must survive normal navigation and recovery.
- **Keep AI context understandable.** Users should know what material a question uses and which connection will answer it.
- **Make the canvas feel deliberate.** Typography, spacing, selection, connectors and motion must support reading and navigation.
- **Let the learner decide what to keep.** AI answers remain discussion until the learner explicitly saves an insight as a note.

### Confirmed decisions

| Decision | Product consequence |
| --- | --- |
| The main experience is a mind map | Do not use Jupyter or Colab cells as the primary interface |
| Clicking a node opens its thread on the canvas | The map remains visible and preserves orientation |
| Nodes and the chat panel are draggable | Spatial arrangement is independent of topic ancestry |
| The panel stays connected to the selected node | Selection, thread content and tether must update together |
| Follow-up questions can become child nodes | Branching is a first-class action in the conversation |
| ChatGPT and API-key options must coexist | The user explicitly chooses the active connection |
| Gallery is the sole product UI, confirmed 5 November 2026 | Retire Lumen from active product development; preserve its Git and data history; improve Gallery’s usability before further visual polish |
| Logo concept C was selected | Continue the existing Offset identity rather than reopen logo exploration |

## 2 Users and core learning journey

### Initial audience

The initial audience is independent adult learners, university students and professionals studying unfamiliar concepts. Early evaluation should include statistics, programming concepts and a nontechnical subject. Programming support means explaining concepts and displaying examples; executing code is outside the current scope.

**Primary job:** When I encounter something I do not understand, help me investigate it, keep the explanation that makes sense, and return to the original idea without rebuilding my context.

**Secondary jobs:** Revisit an earlier explanation, organize related ideas, compare approaches and take useful notes elsewhere. Topic statuses express the learner’s own assessment, not measured mastery.

### Core journey

1. The learner opens or creates a map, such as Statistics.
2. They select Z-scores. Its conversation opens in a panel visibly connected to that node.
3. They ask “What does a z-score tell me?” and receive an explanation in that topic’s discussion.
4. They enter “What does z = 2 mean?” and choose **Ask in new node**.
5. Offscript creates one connected child containing that exact question and opens its conversation. The child uses the parent context captured at branching time.
6. The learner moves the node or chat panel to make reading comfortable; the connection remains correct.
7. They choose **Keep this insight**, edit the explanation if necessary and save it to the chosen topic.
8. They return to Z-scores with the previous reading position and unsent draft intact.
9. On a later visit, they find and reopen the saved explanation.

The same branching flow must work for an existing user message through **Explore as new node**. Creating a branch must not require a working AI connection; its saved question remains available if generation fails.

### Core user stories

| ID | User story |
| --- | --- |
| V2-US01 | As a learner, I want a map of related concepts so I can see where I am and what I have explored |
| V2-US02 | As a learner, I want to open a concept’s own discussion so unrelated questions do not mix together |
| V2-US03 | As a learner, I want to move nodes and the chat panel so I can arrange a comfortable reading space |
| V2-US04 | As a learner, I want to branch a follow-up so I can investigate it without derailing the parent discussion |
| V2-US05 | As a learner, I want to return to the source passage so I can continue where I stopped |
| V2-US06 | As a learner, I want to edit and keep useful explanations so my map becomes a reusable learning resource |
| V2-US07 | As a learner, I want to choose my AI connection and model so I understand which allowance or billing applies |
| V2-US08 | As a learner, I want my work preserved when AI fails so I can retry without losing or duplicating it |
| V2-US09 | As a returning learner, I want search, history and export so I can recover and reuse my work |
| V2-US10 | As an independent user, I want a private workspace so other users cannot access my notes or credentials |

## 3 Scope and priorities

### Delivery levels

**Core evaluation** first investigates Gallery’s usability through actual use and direct feedback, then addresses the identified friction and covers the complete map → conversation → branch → keep → return loop, real-provider validation and broader usability evaluation. This work has priority over further decorative polish. It is the next milestone, not a declaration that the original public-release scope is complete.

**Public release** includes the core experience plus independent accounts, durable cross-device storage, privacy, operating controls and the broader commitments retained from the original PRD. A smaller external pilot is a possible phasing change requiring the product owner’s decision.

**Later exploration** includes additional capabilities without an approved delivery commitment. Claude belongs here until a supported integration and distribution model are selected.

### Current evidence

| Area | Current state | Remaining work |
| --- | --- | --- |
| Gallery usability | Product owner reports poor usability and reluctance to use the current app on 5 November 2026; underlying reasons are not yet identified | Understand the friction through actual use and direct feedback before selecting changes |
| Map and movable thread | Implemented locally in Gallery, the confirmed UI; Lumen is retired | Gallery usability, broader accessibility and performance evidence |
| Node conversations and branching | Implemented locally with saved questions and scoped context | Recorded evidence does not confirm a successful live-provider conversation |
| ChatGPT and OpenAI API choices | Implemented in Gallery | Complete live authorization and verify successful generation, renewal and failure recovery |
| Notes, history and search | Implemented with a bounded structured-note vocabulary | Full editing and recovery experience required for public release |
| Export | Markdown and JSON saved-note export; thread printing | Dedicated rich PDF export and attachment portability remain incomplete |
| Accounts and storage | One trusted local learner with SQLite | Independent user identity, ownership checks, cloud persistence and cross-device access |
| Comparison, merge, imports and sharing | Broader original requirements | Not completed in the current prototype |
| Claude | Not implemented | Provider support, authorization, billing and distribution feasibility |

The Gallery verification recorded on 16 October 2026 reported: 104 tests, type checking, production build, local endpoint smoke checks and inspection of the connection UI passed. Live account connection and inference were still pending. These are historical results, not a fresh release certification for this PRD. The product owner selected Gallery on 5 November 2026; that decision does not establish that the outstanding validation has passed.

### Founder feedback — 5 November 2026

The product owner described the current usability as poor and said they did not feel like using the app themselves. The underlying reasons have not yet been identified. Gallery remains the selected visual direction; usability acceptance is pending.

**Highest next priority:** Understand the friction through actual use and direct founder feedback before prescribing changes. Record what the founder experiences, what they identify as a problem and what remains unknown. Evaluate any resulting changes in the working app and record whether the founder feels willing to use it before investing in more decorative polish. No specific cause, remedy or broader usability study result is established by this feedback.

### Scope boundaries

The current evaluation does not include code execution, arbitrary automated web research, importing an entire ChatGPT or Claude history, real-time collaboration, native mobile apps, handwriting recognition, voice tutoring or assessed mastery. No AI generation may be replaced with canned content and presented as a real response.

Comparison, selective merge, source imports and snapshot sharing remain public-release requirements inherited from version 1. They may be moved to a later release only through an explicit scope decision; their absence from the prototype is not approval to drop them.

## 4 Functional requirements

### Product concepts and invariants

A **map** is a collection of related topics; the current implementation calls this a notebook internally. A **node** is a topic on that map. A **conversation** is the ordered discussion belonging to one topic. A **thread panel** is the interface for viewing that topic’s conversation and notes. A **branch** creates a child topic with a saved origin and a snapshot of relevant ancestor context. A **kept insight** is an editable note linked to its source explanation.

Each topic has at most one parent. Parent and child belong to the same map, and ancestry is acyclic. Moving a node never changes its parent, inherited context or messages; visual connector or layout changes must not implicitly alter AI context. Changing AI connections never moves or deletes conversation history. A map must not maintain contradictory copies of the same topic in separate note, chat and canvas stores.

### Core evaluation requirements

**V2-F01 Map creation and navigation.** Create and rename maps and topics, open a selected topic, pan, zoom, fit the map and search topics or saved notes. Navigation alone must never call the AI provider. Empty maps provide a clear first action; sample content is labeled.

**V2-F02 Node arrangement.** Drag nodes with accurate pointer behavior at different zoom levels. Support keyboard movement and an explicit reset arrangement action. Restored positions must remain usable after viewport changes. Browser-local layout persistence is acceptable for local evaluation; account-owned persistence is required for cross-device release.

**V2-F03 Connected thread panel.** Open a topic’s Conversation and Notes without removing the canvas. Drag the panel independently using a clear handle. Keep the connector attached to the selected node as either object moves. Switching topics changes the content, selection and tether as one interaction. Compact screens use a readable full-height or modal presentation.

**V2-F04 Conversation continuity.** Save the user’s question and completed assistant response to the selected topic. Keep chronological history within that topic. Show sending, waiting, completed, failed and interrupted states accurately. Prevent duplicate submission while a request is pending for the same topic.

**V2-F05 Question branching.** Offer **Ask in new node** for a drafted question and **Explore as new node** for a saved user question. Create the child and its initial question atomically. Retrying the creation request must not create a second child. Do not truncate the saved question to its display title. Titles remain editable.

**V2-F06 Passage branching and return.** Record the source topic, stable note-block identity, original excerpt and navigation state when a branch begins from a passage. Return to that origin where possible. If the source changed or disappeared, show the original excerpt and explain the mismatch rather than highlighting a different occurrence.

**V2-F07 Context boundaries.** Use the selected topic’s own notes and discussion plus the ancestor context captured at the fork. Exclude siblings and unrelated maps unless the learner explicitly attaches them through a future supported action. Later edits to the parent must not silently rewrite the child’s frozen starting context. Show a concise explanation of inherited context.

**V2-F08 Keep and edit insights.** Let the learner select a useful explanation, edit it, choose a destination topic and save it with source-message provenance. Keeping an insight must not delete the original discussion. Repeated clicks must not create accidental duplicate notes.

**V2-F09 Notes and learning status.** Provide readable headings, prose, definitions, examples, formulas and code samples. Distinguish saved content from unsaved drafts and surface save conflicts. Preserve revision history. Learning statuses remain user-controlled. The current normal-distribution chart is a specific supported chart, not evidence of a general plotting engine.

**V2-F10 Connection choice.** Keep ChatGPT and OpenAI API connections separately configured in Gallery. Show the active connection near the composer and in settings. Each new request uses the explicit choice; switching retains history. Never change from plan usage to separately billed API usage automatically.

**V2-F11 Failure recovery.** Preserve a submitted question when authorization, network, model access or usage limits prevent an answer. Provide a clear recovery action. An explicit retry may start a new run while reusing the saved question; it must not duplicate the branch or silently rerun a previously completed request.

**V2-F12 Resume and portability.** Reopen acknowledged notes and messages after refresh. Preserve local drafts and arrangement within the supported local browser. Export saved notes as Markdown and structured JSON with topic relationships and available provenance; clearly exclude private discussion and credentials from these exports. Keep the existing browser print action distinct from a complete PDF export feature.

### Public release requirements retained from version 1

**V2-F13 Independent workspaces.** Provide Offscript accounts, secure sessions, recovery and account deletion. Every map, topic, message, source, run and export has an owner and server-enforced access rules. Cross-device sign-in restores acknowledged work. Selecting an AI provider is not sufficient to satisfy this requirement.

**V2-F14 Map lifecycle and recovery.** Add archive, trash and restore with a documented retention policy. Destructive actions identify their scope and require clear confirmation. The current permanent-delete action does not satisfy recoverable trash.

**V2-F15 Source material.** Support the approved pasted text, text PDF and image import flows, bounded processing and understandable failure states. Preserve source identity and locators so citations can be inspected. Treat imported text as untrusted content. Never imply that the current app can search arbitrary websites or ingest all provider history.

**V2-F16 Comparison.** Compare two or three selected branches using editable criteria. Keep sources and branch origins visible. Save the compared source revisions and mark the comparison out of date when those sources change. Clearly label AI synthesis; the learner can revise it. An incomplete or unavailable branch must be identified rather than filled with invented content.

**V2-F17 Selective merge.** Let the learner choose conclusions to merge, preview the destination changes and apply them atomically. Repeating the same apply operation creates one change; a stale destination revision rejects the operation. Preserve provenance and provide an undo that preserves later unrelated edits. Do not overwrite newer destination edits or merge entire discussions implicitly.

**V2-F18 Sharing and export.** Publish only an explicitly selected read-only snapshot through a revocable link. Later private edits must not leak into an already published snapshot. Complete the original rich PDF, Markdown and structured export requirements, including supported attachments, with clear content inclusion rules.

**V2-F19 Durable AI interaction.** Provide visible response streaming, Stop, reload/reattach behavior and durable run state before public release. The current server consumes ChatGPT events internally and returns the finished answer; it does not yet provide this full user-visible lifecycle. Persist partial/interrupted status honestly and reconcile completion exactly once.

**V2-F20 Usage and operations.** Add per-user usage accounting, applicable quotas, rate limits and configurable spending ceilings before public generation. Provide deployment, monitoring, backup/restore and rollback procedures with named owners. Plan eligibility and provider limits must be surfaced without promising unlimited usage.

## 5 Design and interaction requirements

### Visual direction

Offscript should feel calm, precise and distinctive. The reference to Apple and Perplexity describes the desired care, readability and restraint; Offscript should maintain its own identity. Avoid generic dashboard chrome, decorative controls without behavior and a notebook-cell aesthetic.

| Element | Selected Gallery baseline and acceptance status |
| --- | --- |
| Canvas | Warm white with numbered editorial topic blocks |
| Selected state | Cobalt emphasis linking the selected concept and conversation |
| Conversation panel | Solid cobalt conversation card in the selected baseline |
| Identity | Selected Offset mark |
| Status | Sole product UI, selected 5 November 2026; current usability is not accepted |

Gallery is the canonical experience. Its selection establishes the design direction; further changes should follow observed use and direct feedback. Lumen is retired from the active product; its design records and Git history remain historical evidence. The two local databases began from a snapshot and evolved independently, so their history must be preserved without assuming that they are synchronized or silently merging them. Keep the existing Gallery origin on port 3001 during consolidation to retain browser-local drafts and OAuth continuity. See [the Gallery decision record](design/decision-gallery.md).

### Interaction details

- Give selection an unmistakable but restrained treatment across the node, relevant connector and thread. Do not rely on color alone.
- Maintain smooth node dragging, panel dragging and map panning without accidental text selection or unintended clicks. Text inside the panel remains selectable.
- Make hover, focus, pressed, loading, disabled, error and empty states coherent across the interface.
- Use brief purposeful motion for opening a thread, creating a branch and changing focus. Honor reduced-motion preferences and avoid continuous decorative animation.
- Use branch excerpts or neutral connector labels. Do not invent an intellectual relationship merely to make the map look richer.
- Keep formulas, long questions and code samples readable. Long content should scroll within the intended region rather than push controls offscreen.
- Preserve visible focus, meaningful accessible names, keyboard equivalents and an accessible tree or list alternative to spatial navigation. WCAG 2.2 AA is a proposed public-release target requiring verification.
- At narrow widths, prioritize a readable conversation and a clear return to the map. Dragging must not be the only way to navigate or use the product.

### Gallery usability evaluation

Begin with the founder using Gallery for a real learning session and describing the experience. Observe the core ask → branch → keep → return loop, record the environment and preserve the founder’s feedback in their own terms. Distinguish observed behavior, user-reported friction and unresolved questions; do not infer a cause from the overall dissatisfaction. Select improvements after the friction is understood, then evaluate those changes through use and ask whether the founder feels willing to use the app for learning.

Continue with additional learners using documented maps, viewports, devices, browsers and models. Record completion, mistakes, time to the first real answer, successful returns and perceived responsiveness. Report findings without treating a metric as an explanation for the founder’s feedback. The Gallery choice is settled; the quality of its learning experience still requires evidence.

## 6 AI connections and account privacy

### Identity and model access are separate

An **Offscript account** determines who owns the workspace. A **provider connection** determines which model can answer a request and which allowance or billing applies. A future identity flow may reuse a provider’s verified identity, but the application must still create its own account, session and ownership boundary.

The current local app has no independent multi-user account system. It supports one ChatGPT registration for the local installation and a separate OpenAI API connection. Claude sign-in is not implemented. Availability of a personal subscription does not itself establish permission or entitlement for a future hosted Offscript product.

### What may be stored

| Information | Requirement |
| --- | --- |
| ChatGPT or Claude password | Never request, receive or store it in Offscript; login takes place with the provider |
| Verified provider account identity and email | Store only what is needed to associate the connection with its owner and show an understandable account label |
| Access and refresh tokens | Treat as secrets; protect server-side, scope to the correct user and connection, rotate and revoke appropriately |
| Retained identity token | Protect as sensitive account data; use only for its supported authentication purpose |
| User-supplied API key | Treat as a secret and never return the saved value to the browser |
| Notes and conversations | Store separately from credentials, with clear ownership and deletion behavior |
| Logs and analytics | Exclude passwords, tokens, API keys and raw learning content by default |

In the current prototype, credentials use private local files outside the notes database, Git and exports. File permissions restrict access, but the files are plaintext and are not an encrypted credential vault. A hosted product requires encryption at rest, controlled key management, per-user isolation and audited access to secrets before accepting external users.

### Authorization and billing behavior

Use only supported provider-managed authorization. Validate the sign-in transaction, identity, granted permissions and intended client before making a new connection active. Do not read another app’s stored credentials or ask users to paste provider session cookies. Cancelled or failed sign-ins must not replace a working connection.

Load the signed-in account’s available models and present clear choices. Distinguish identity verification, permission to use a plan and successful inference; none is proof of the next. Explain relevant provider usage limits and expose a usage-management action where supported.

Preserve API-key access alongside ChatGPT. Switching applies to future requests and must not secretly resend an in-flight request. Record the provider/model used for each public-release run so history remains understandable. Disconnect must stop active work for that connection, clear usable local secrets and report when remote revocation could not be confirmed.

The tutor must use only the selected context, admit uncertainty, distinguish examples from facts and avoid claiming access to unavailable tools or sources. It must not claim that a note was saved until a real save is acknowledged. Text inside notes, sources and prior messages is data rather than authority to override application instructions.

### Claude and hosted distribution

As checked on 5 November 2026, OpenAI documents eligible ChatGPT plan usage for open-source and locally hosted applications. Paid or remotely hosted applications are directed to a separate interest process. Identity sign-in and permission to use a plan are distinct grants, and this connection does not expose existing ChatGPT conversations. These documents do not establish blanket authorization for a hosted commercial Offscript service. [OpenAI integration overview](https://developers.openai.com/siwc/token-sharing-open-source), [registration and sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in).

Claude is an evaluated future option, not a completed login button or promised launch capability. Anthropic directs products built for others toward Claude Console or supported cloud API authentication, with third-party subscription exceptions at its discretion. Do not promise that an ordinary Claude subscription will power Offscript. Before adding it, confirm the supported authentication route, distribution model, eligibility and usage/billing contract. Apply the same context, isolation, failure and explicit-choice requirements as other connections. [Anthropic account and third-party authentication guidance](https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account).

Before public deployment, revalidate the supported ChatGPT integration for the chosen hosted or local model. Do not ship the current loopback callback and single-user credential store as a multi-user website.

## 7 Reliability and acceptance criteria

### Required acceptance scenarios

| ID | Scenario and pass condition |
| --- | --- |
| V2-AC01 | Open a map and select a topic; the correct thread appears while the map remains oriented, with no AI request caused by navigation |
| V2-AC02 | Move the node and its panel at different zoom levels; the tether stays attached and neither action changes ancestry or messages |
| V2-AC03 | Submit a drafted follow-up as a child, then repeat the same creation request; exactly one child and one initial question exist |
| V2-AC04 | Promote an existing user question; the parent retains its discussion and the child starts with the exact saved question |
| V2-AC05 | Populate sibling and unrelated-map content with test markers; neither appears in the child’s AI request, while the frozen ancestor context does |
| V2-AC06 | Explore at least three nested branches and return; draft and reading position survive, and a changed anchor is handled without a false match |
| V2-AC07 | Keep and edit an explanation; the selected topic receives one saved note with provenance and the original message remains available |
| V2-AC08 | Reload after an acknowledged save; notes and messages remain. Pending or unsaved work is labeled accurately |
| V2-AC09 | Configure both AI connections and switch explicitly; new requests use the selected one, history remains and ChatGPT failure never triggers API billing |
| V2-AC10 | Cancel sign-in, reject a forged or replayed callback, expire a session and disconnect during a request; secrets stay protected and no interrupted answer is marked completed |
| V2-AC11 | Fail the provider after partial output; retain the question, show a recoverable failure and avoid duplicate branches or automatic retries that spend usage |
| V2-AC12 | Before public release, user B attempts user A’s IDs through every content, run, search, export, share and file route; unauthorized access is denied server-side |
| V2-AC13 | Before public release, restore from a tested backup and recover across refresh/redeployment; verify the documented recovery objective and run-state reconciliation |
| V2-AC14 | Complete a keyboard-only and narrow-screen learning loop, including focus restoration, moving or replacing spatial interactions and readable error states |
| V2-AC15 | Before public release, import a supported source and inspect its citation. Compare branches, edit a source and verify an out-of-date label. Preview and repeat a merge apply: one change results; a stale destination rejects. Undo preserves later unrelated edits. Export and revoke a shared snapshot successfully |
| V2-AC16 | Observe the founder using Gallery for a learning session with a topic and question they choose; record their direct feedback, observed friction and unresolved questions before selecting changes |
| V2-AC17 | Evaluate any resulting changes through the core ask → branch → keep → return loop in the working app; record completion, failures and direct feedback, keeping confirmed findings separate from unknown causes |
| V2-AC18 | Record whether the founder explicitly feels willing to use the revised app for learning. Address identified blocking friction before further decorative polish; Gallery’s visual selection alone does not satisfy this gate |

A passing unit test or attractive screen is not sufficient for a scenario that spans UI, server behavior, persistence and permissions. Use isolated test data and mocked providers for deterministic failure tests, then perform explicit live-provider checks with an authorized account. The last recorded test count does not establish current production readiness.

### Proposed performance targets

These are targets to validate, not measured claims. Retain the original p95 targets of cached navigation within 200 ms, ordinary read/save responses within 750 ms and visible save acknowledgment within two seconds. Measure on a documented device/browser/network profile with representative content. Use separate 500-topic and 1,000-topic fixtures and report limitations rather than generalize small-map results. Measure provider latency separately from application interaction latency.

The local UI must acknowledge interaction promptly during generation. Slow AI work must not freeze map movement, typing or navigation. Establish production availability, recovery-time and recovery-point objectives before public launch; none is claimed by the local preview.

### Learning and product validation

The immediate founder review follows V2-AC16–18 through actual use and direct feedback. Gallery’s visual selection does not satisfy that review. Record the result as pending until the working tasks and willingness-to-use feedback have been observed; this individual review is separate from the later learner study.

For an initial study of 10–15 recruited learners, retain these proposed thresholds from the earlier plan:

- At least 70% complete branch → explanation → keep/edit → return without moderator assistance.
- At least 80% can locate a saved explanation the next day.
- At least half report less need to reconstruct notes in another tool.

Track time to the first useful saved insight, successful returns, question failures, duplicate or lost-work incidents and next-day revisits. Count an activation when a learner completes the core loop with a real answer and a kept insight, not merely when they sign in. Do not equate message volume, branch count or a self-reported status with understanding. These thresholds are directional for a small study, not statistically established learning outcomes.

Analytics for a public product should record minimal events such as map created, topic opened, question completed/failed, branch created, insight kept and return completed. Do not include question or answer bodies by default. Document consent, retention and deletion before enabling shared telemetry.

## 8 Release plan and open decisions

### Milestones and exit gates

| Milestone | Exit gate |
| --- | --- |
| M1 Understand and improve Gallery usability | Complete V2-AC16–18: understand the friction through actual use and direct feedback, evaluate the resulting changes in the core learning loop, and record the founder’s explicit willingness to use the app; resolve identified blocking friction before further decorative polish |
| M2 Complete local usability and reliability evaluation | Observe the broader learning loop, live-provider recovery, accessibility and Gallery usability; resolve critical interaction, data-loss and credential issues; verify that consolidation preserves drafts, the OAuth origin and both workspaces’ data and Git history |
| M3 Define external-user delivery | Decide local distribution, hosted service or both; approve the identity/provider approach, release scope, operating budget and data responsibilities |
| M4 Implement public-release requirements | Meet the approved scope, including retained original commitments unless explicitly rephased; prove user isolation, recovery, usage controls and supported provider access |
| M5 Controlled public release | Complete end-to-end acceptance and learning evaluation; establish support, monitoring, backup, rollback and incident ownership; publish only after the release review |

Usability iteration and local validation precede external launch. No calendar commitments are assigned because staffing, distribution, budget and final scope remain open. A smaller pilot may be sensible, but it must be named and evaluated as a pilot rather than completion of the original public PRD.

### Decisions requiring product-owner resolution

1. Is the product distributed locally, hosted on the web, or offered in both forms?
2. Does the first external milestone keep all original public-release features, or explicitly defer comparison, merge, imports or sharing?
3. What owns an Offscript account and how does a user recover access independently of an AI connection?
4. Which providers, account plans and supported authorization methods are included for the selected distribution?
5. Do users supply their own allowance/key only, or will Offscript offer a metered allowance and paid offering?
6. Are multiple provider accounts on one installation needed before external testing?
7. Who owns hosting, domain, privacy/retention decisions, support, operational response and the spending budget?

### Risks and responses

| Risk | Required response |
| --- | --- |
| Gallery’s visual selection is mistaken for usability acceptance | Understand the founder’s concerns through actual use and direct feedback; evaluate evidence-based changes and record willingness to use the app before further decorative polish |
| The map becomes cluttered as a topic expands | Validate progressive disclosure, search, focus and readable fit behavior with large fixtures |
| Consolidation loses drafts, provider continuity or independent workspace data | Retain Gallery’s port 3001 origin, preserve both data histories and Git history, and verify continuity without silently merging databases |
| A polished prototype is mistaken for launch readiness | Track implemented, observed, unverified and release-required work separately |
| Provider authorization or entitlement differs by distribution | Confirm official support before promising availability; retain explicit API choice without silent fallback |
| Lost context, drafts or duplicated branches erode trust | Test atomic creation, provenance, anchors, persistence and recovery under failures |
| Tokens or private learning material reach another user | Require per-user ownership, protected secret storage, permission tests and safe telemetry before hosting |

### Implementation guidance

The existing Next.js/React local app, relational topic model and separate provider adapters are the starting point. Preserve one canonical topic identity across map, notes and conversation. Treat hosted storage/authentication, background execution and deployment choices as architecture decisions to validate rather than settled product facts. The original Supabase and Render suggestions are not commitments made by this revision.

Maintain a requirement register linking each V2-F and V2-AC item to implementation and current test evidence. The V2 prefix distinguishes these IDs from version 1; older acceptance IDs and their test evidence must not be silently reassigned. Record approved scope changes and design decisions. Changes to the app, public deployment or external issue tracking are not performed by creating this PRD.

### Basis and source record

This draft is based on the founder’s conversation, including the confirmed Gallery choice and subsequent usability feedback on 5 November 2026, the original Offscript PRD and requirement register, the Lumen/Gallery/Offset design records, and the current local implementation documentation reviewed on 5 November 2026. The founder clarified that the specific reasons for their dissatisfaction should not be assumed. Lumen records and earlier comparison plans document the path to this decision, not an active alternative. No credential files or private database content were inspected to prepare it.

- Original specification: `docs/PRD.md` and `docs/Offscript_PRD.docx`, version 1.0 dated 15 October 2026.
- Product and engineering status: `docs/requirements.md`, `docs/architecture.md`, and each branch’s `README.md` and `docs/verification.md`.
- Current visual decision: `docs/design/decision-gallery.md`; implementation direction: `docs/design/gallery.md` and `docs/design/brand/offset.md`. Historical Lumen evidence remains in `docs/design/lumen.md` and Git history.
- Provider authorization references, checked 5 November 2026: [OpenAI integration overview](https://developers.openai.com/siwc/token-sharing-open-source), [registration and sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), and [Anthropic account and third-party authentication guidance](https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account). Recheck applicable provider terms and eligibility before release.
