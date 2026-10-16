Offscript Product Requirements Document

Version 1.0 | 15 October 2026 | Product owner Rajat Singh

Build specification for a fully deployed public web application

Offscript is a visual AI notebook for people who learn by asking questions inside other questions. A learner can explore a difficult term, follow further explanations, return to the exact place they left, compare approaches, and keep selected conclusions as editable notes. The notebook, discussion tree, and topic map stay connected throughout that process.

The first release must work for real users with their own accounts and content on a public HTTPS URL. It includes production AI calls, durable storage, access controls, deployment automation, monitoring, recovery procedures, and a verified learning workflow. A clickable prototype or a local demonstration is an intermediate milestone.

This document combines product requirements with enough engineering detail for a coding agent or development team to implement the application. Requirements marked MUST belong to the public release. Recommended technical choices and numerical targets are implementation defaults, not decisions previously approved by the product owner. Proposed changes must preserve the acceptance criteria and be recorded in the decision log.

The product name and the core learning experience are settled. The launch domain, provider accounts, operating budget, and any paid offering require owner input before their corresponding launch step. They do not prevent design and implementation from beginning.

Contents

Use this outline or the document navigation pane to find the relevant requirements. The implementation handoff starts in Section 29.

1 Product definition and delivery contract	3

2 Problem and intended users	3

3 Release scope and priority	4

4 Product concepts and invariants	5

5 Main learning journeys	7

6 Comparison and source journeys	8

7 Application structure and navigation	8

8 Visual design and accessibility	9

9 Accounts and notebook management	10

10 Branching and return behavior	11

11 Notebook editing and saved explanations	12

12 Topic map and tree	13

13 Comparison and selective merging	13

14 Sources and imports	14

15 Search export and sharing	15

16 AI tutor and context behavior	16

17 AI response contracts and runtime	16

18 Technical architecture	18

19 Core data model	19

20 Supporting records and consistency	20

21 API and background job contracts	21

22 Security privacy and retention	22

23 Reliability performance and device support	23

24 Usage controls costs and optional billing	24

25 Analytics and learning validation	25

26 Acceptance scenarios for the learning experience	26

27 Acceptance scenarios for production readiness	27

28 AI evaluation and test strategy	28

29 Implementation phases and exit gates	29

30 Deployment operations and handoff	30

31 Owner inputs decisions and risks	31

32 Instructions for the implementing agent	32

33 Source references	33

1 Product definition and delivery contract

Product promise

Follow your curiosity. Keep your place.

Offscript combines an AI tutor, an editable visual notebook, and connected topic navigation. Its central job is to preserve the path from a question to an explanation that made sense. Learners should finish a session with useful notes already attached to the right concepts, without reconstructing the lesson from screenshots and scattered chat messages.

What completion means

A new person can visit the production URL, create an account, verify their email, and start learning without help from the developer.

They can ask real AI questions, create nested topic branches, return to the original reading position, keep editable explanations, compare two or three branches, and merge selected conclusions.

Their work survives refresh, sign out, application redeployment, and use on another signed-in device. Saving and recovery states are visible.

They can search their work, import supported material, export it, share a selected snapshot, revoke that share, and delete their account.

A second user cannot access the first user's private notes, sources, AI runs, search results, exports, or files.

Production has a documented owner, budget controls, error reporting, tested backups, a rollback path, and a repeatable deployment procedure.

Requirements and changes

MUST means the feature and its failure behavior are release requirements. SHOULD is the recommended behavior unless an alternative is recorded with its consequences. Later means intentionally outside the first public release. A feature is complete only when its UI, server behavior, persistence, permission checks, and relevant tests work together.

The executing agent must preserve this document in the repository, maintain a requirement status register, and link each completed requirement to code and test evidence. It must report remaining limitations honestly. Screens with canned responses, hardcoded user data, unconnected controls, or browser-only storage must not be presented as completed production features.

2 Problem and intended users

Observed problem

The founder's learning process repeatedly moves between a main lesson and clarification questions. Each clarification can introduce another unfamiliar concept. A chronological chat mixes these paths together, making it difficult to resume the original lesson or find the explanation that helped. The founder currently compensates by taking screenshots and assembling separate visual notes.

The product hypothesis is that preserving context, navigation, and useful explanations in one workspace will reduce that reconstruction effort. This is a hypothesis to test with learners, not a claim that Offscript has already improved learning outcomes.

Initial audience

The first release targets adult independent learners, university students, and professionals studying unfamiliar concepts. The initial validation group should include people learning statistics, programming, and one nontechnical subject. English is the launch interface language. The editor must preserve Unicode content; polished multilingual tutoring and right-to-left layouts are later work.

Primary user job: When an explanation contains something I do not understand, let me investigate it without losing my place, and help me keep the explanation that finally makes sense.

Secondary jobs: Compare alternative explanations or methods; revise a topic later; bring notes from source material into a coherent notebook; share selected notes without exposing private discussions.

Product principles

Preserve the learning path. Every branch has a visible origin and a reliable way back.

Organize with little effort. Suggest topic titles and note structure, while keeping users in control of important changes.

Make notes readable. Use clear hierarchy, diagrams, formulas, and worked examples with consistent visual meaning.

Keep work editable and portable. Explanations are structured content with provenance, not flattened screenshots.

Make AI context understandable. Users can inspect which topic, earlier discussion, and sources are being used.

Treat understanding as personal. A learner's status is self-reported; an AI response does not establish mastery.

Existing tools already offer visual notes, canvases, linked concepts, and branching conversations. Obsidian Canvas, for example, supports visual arrangement of notes and other content [S1]. Offscript's differentiation must be validated through the complete learning experience and ease of use. It must not claim to be the first or only app with these individual features.

3 Release scope and priority

Public release scope

Area | Required release behavior

Accounts | Verified email sign-in, sessions, recovery, settings, account deletion

Notebooks | Create, rename, archive, trash, restore, search, resume

Learning | Real streamed AI responses with relevant branch context

Branches | Selection anchors, nested topics, breadcrumbs, precise return

Notes | Editable rich content, formulas, diagrams, provenance, history

Views | Notebook, expandable topic tree, topic map over the same data

Comparison | Two or three branches, editable criteria, cited synthesis

Merge | Select conclusions, preview changes, apply atomically, undo safely

Sources | Paste text, upload text PDFs and images, inspect source references

Sharing | Explicit published snapshots with revocable read-only links

Portability | PDF, Markdown, and structured JSON export with attachments

Operations | Deployment, monitoring, limits, backups, privacy controls, support



The default launch model is a free, metered public beta. Usage accounting and spending limits are mandatory. Paid subscriptions are a separate activation gate; they must not delay a usable free launch unless the owner chooses a paid launch.

Later capabilities

Native iOS and Android applications; advanced pen and handwriting recognition; a fully freeform drawing canvas; real-time collaborative editing; comments and classroom administration; public notebook discovery; spaced repetition and assessed mastery; voice tutoring; browser extensions; web crawling and arbitrary URL ingestion; live web research; automatic cross-notebook memory; multiple AI providers exposed to users; importing complete histories from every chat provider.

The notebook aesthetic, diagram editing, nested branches, comparison, and selective merging are required now. They must not be postponed under the label of visual polish.

Scope discipline

Build one coherent product before adding the later capabilities. Avoid separate note, chat, and graph databases with duplicated topic content. Use a relational database with explicit relationships; a dedicated graph database is not required for this release. Avoid model training and autonomous multi-agent orchestration in the first version. Existing AI services can supply explanations while Offscript owns context, editing, navigation, and persistence.

4 Product concepts and invariants

Concept | Definition

Notebook | One learning project containing topics, sources, and saved notes

Topic | A concept or approach with a discussion, a note page, and connections

Branch | A child topic created from an existing topic or selected passage

Anchor | A reference to the precise passage, formula, block, or message that prompted a branch

Quick question | A small clarification attached to an anchor without adding a map node

Saved explanation | User-approved content inserted into a topic page with its source retained

Comparison | A versioned examination of two or three selected topics

Merge | A reviewed content change that brings selected conclusions into a target topic

Related link | A user-created semantic connection that does not change the parent relationship

Learning status | Exploring, Clear for now, or Revisit, selected by the learner



Invariants

Each topic has at most one parent topic. The parent hierarchy must remain acyclic and within one notebook. A notebook may contain several root topics. Related links may cross branches and may form cycles; they never become conversation ancestry automatically.

A map node represents a topic, not an individual message. A topic can contain many conversational turns and many note blocks. Quick questions do not become nodes unless the user chooses Explore as topic. That promotion retains the question, answer, anchor, and return location.

The notebook, tree, and map are views of the same topic records. Renaming a topic updates every view. Map coordinates, collapsed groups, and viewport state are presentation preferences; they must not be used as the source of topic content or ancestry.

Figure 1  Learning branches and selected notes

Creating or viewing a related link does not grant permission to include that topic in AI context. Comparing branches explicitly grants scope for that comparison. Merging adds selected content and provenance; it does not flatten or erase the source discussions.

5 Main learning journeys

Journey A Learn through nested questions

The learner creates a notebook called Statistics and asks for an explanation of a normal distribution.

Offscript creates the root topic, streams a readable explanation, and presents a structured starting note page with examples and an accurately labeled diagram.

The learner selects standard deviation and chooses Explore as topic. The original view remains preserved, and a child topic opens with the selected passage available to the tutor.

The learner asks further questions, then branches again into variance. The path remains visible as Statistics, Normal distribution, Standard deviation, Variance.

When an explanation helps, the learner chooses Keep this, edits the proposed note, and selects the topic where it belongs.

Return to where I was restores the original topic, selected passage, reading position, and draft question. The learner can return one level at a time or choose any ancestor.

The learner reopens the notebook the next day and resumes at the last acknowledged position with all saved content present.

Success evidence: Complete this flow through at least three nested branches, then refresh and reopen on a second device. No branch, note, provenance link, or acknowledged save is missing. The return target still works when the page has been edited, or explicitly shows the preserved original excerpt if it cannot be reattached.

Journey B Ask a small clarification

The learner selects a phrase and chooses Ask here. A compact discussion opens beside the selected text on a large screen or as a sheet on a phone. They can close it, keep an answer, or promote it into a topic. Closing it preserves its history and does not change the main discussion or create a graph node.

Journey C Revise and resume

The learner searches for an explanation they remember, opens the saved note, follows its source back to the original discussion, and adds a personal example. They mark the topic Revisit. On another device the same revision and learning status appear. Search finds both the revised note and its topic without exposing another user's content.

6 Comparison and source journeys

Journey D Explore three approaches and merge

The learner starts with a parent question such as How can I model this classification problem. They create sibling topics for logistic regression, a decision tree, and nearest neighbors. Each discussion develops independently from the context available when it was created.

The learner selects the three topics, chooses comparison criteria, and opens Compare. Offscript shows the selected branch snapshots, a structured comparison, common ground, differences, tradeoffs, and unresolved questions. Each synthesized conclusion links to the supporting messages or saved notes. The learner can edit the comparison and select conclusions from different branches.

They choose Bring into main topic. Offscript previews the exact content to be inserted or replaced and the target location. Applying the merge creates one new target revision and records the selected source revisions. The original branches remain available. Undo removes the applied changes without erasing unrelated later edits; if this cannot be done cleanly, the app presents a reverse-change preview.

Success evidence: Compare three branches, merge selected items from two, leave the third unmerged, and reopen all views. The target includes exactly the approved conclusions. A repeat network request does not duplicate content. Later edits to a source mark the comparison as out of date without rewriting the saved result.

Journey E Learn from source material

The learner pastes text or uploads a supported PDF or screenshot. Offscript shows processing progress and a source preview. It proposes an outline that the user can edit before creating topics. An explanation based on that material includes links to the source page or passage. The learner can distinguish source text, AI interpretation, and personal notes.

Journey F Share selected learning

The learner selects note pages and previews a read-only published snapshot. Raw chats, private source files, and unselected branches are excluded by default. The recipient can read the snapshot without an account. The owner can replace it with a newer snapshot or revoke access. Sharing never exposes a live private notebook through a guessed identifier.

7 Application structure and navigation

Required screens

Public landing page with a truthful product description, sign-in, support, privacy information, and terms.

Authentication screens for registration, email verification, sign-in, recovery, and expired-link handling.

Home with notebook cards, recent work, search, and a clear Create notebook action.

Learning workspace with notebook navigation, topic content, contextual discussion, sources, and view controls.

Topic map with focus, zoom, collapse, search, and a synchronized outline alternative.

Comparison workspace and merge preview with source links and selection controls.

Settings for profile, appearance, data export, account deletion, and usage; billing appears only when enabled.

Published snapshot reader, support form, and a restricted operations interface.

Suggested route structure

Route | Purpose

/ | Public introduction

/auth | Sign-in and related flows

/app | Notebook home

/app/n/:notebookId/t/:topicId | Topic workspace

/app/n/:notebookId/map | Notebook map

/app/compare/:comparisonId | Saved comparison

/app/settings | Account and usage

/s/:shareToken | Published snapshot

/ops | Restricted operational tools



Routes are recommendations; permanent topic and source identifiers are mandatory. Deep links must restore the requested view after authentication. Browser back and forward must navigate topics predictably without discarding unsent drafts. An unavailable or deleted target must show an explanation and a route back to the notebook.

The default workspace emphasizes the note page. Discussion opens alongside it when needed. The map is always available but does not force the user to manage an infinite canvas before learning. Onboarding should demonstrate one branch and one return using an explicitly labeled sample notebook that can be deleted.

8 Visual design and accessibility

Design direction

Offscript should feel like a carefully organized personal notebook. Use generous reading space, clear type, quiet paper tones, restrained highlighting, and purposeful diagrams. Avoid decorative handwriting as the main body typeface. Distinguish an example, a definition, a formula, and a personal observation through consistent layout and labels.

Starting design tokens are recommendations: warm background #F7F5F0, paper #FFFFFF, primary ink #202522, muted ink #5A635D, and deep green accent #245B4A. Use amber, blue, and rose sparingly for distinct content roles. Verify actual contrast in both light and dark themes. Dark mode must preserve these meanings rather than simply invert colors.

Body text should normally be 16 to 18 CSS pixels with comfortable line spacing and a reading measure around 65 to 80 characters. UI labels should remain readable on a phone. Use a clear sans serif for controls and optionally a restrained serif for notebook titles. Use licensed fonts and local fallbacks.

Content components

Required blocks include paragraphs, headings, lists, definitions, worked examples, formulas, tables, code, images with captions, diagram blocks, source references, personal annotations, and saved explanations. Components must support editing, moving, duplicating, and deletion. Color must never be the only way a block's meaning is conveyed.

Diagrams must be rendered from a validated diagram specification or safe drawing primitives. Users must be able to edit labels and connections. Statistical charts require labeled axes, units, and numerical calculations from deterministic code. AI-generated decorative images must not substitute for mathematically accurate figures.

The initial visual vocabulary includes concept maps, flowcharts, line and bar charts, histograms, and a normal distribution plot with configurable parameters and shaded ranges. Users can inspect and edit the values behind a plot. Other requested visual types may use a clear textual fallback until supported; the app must not display an inaccurate substitute.

Responsive behavior

At wide widths, show a collapsible topic sidebar, the note page, and an optional discussion panel. On tablets, allow two panels. On phones, show one primary surface at a time with a breadcrumb, accessible back action, and bottom sheet for quick questions. Preserve drafts and position when switching surfaces. Support widths from 320 CSS pixels upward without page-wide horizontal scrolling; large tables and maps may scroll inside their own containers.

Accessibility requirements

Target WCAG 2.2 AA [S2]. All core tasks must work with a keyboard. Provide visible focus, meaningful labels, announcements for saved and failed states, reduced-motion support, diagram text descriptions, and an accessible outline equivalent to the map. Touch targets should generally be at least 44 by 44 CSS pixels. Check zoom at 200 percent and screen-reader operation of a complete branch and return flow.

9 Accounts and notebook management

AUTH01 MUST Support email and password registration with verification, sign-in, password reset, and sign-out. Preserve a deep-link destination through authentication. Email delivery must use a configured production sender. Google sign-in is optional for the initial release; if displayed, it must work with production callback URLs.

After verification, offer a short optional prompt for learning goal and preferred explanation depth. Users can skip it and start immediately. Onboarding must not require a tutorial tour, a payment method, or a completed profile before the first lesson.

AUTH02 MUST Handle expired sessions and links without losing an unsent question or local note draft. Sensitive actions require a recent authenticated session. Never merge accounts solely because two unverified email strings match.

AUTH03 MUST Separate ordinary users from operators. Operator access is explicitly assigned, audited, and protected by MFA. Operators do not receive a default interface for browsing private learning content.

AUTH04 MUST Provide profile settings, theme, data export, and account deletion. Explain deletion scope and completion state. Cancel or safely detach in-progress jobs when an account is deleted.

NB01 MUST Create, rename, duplicate, archive, move to trash, restore, and permanently delete notebooks. Notebook duplication creates new identifiers and retains only content the requester is allowed to copy. Published links and usage history are not duplicated.

NB02 MUST Display recent notebooks and a last visited topic. Record notebook title, description, timestamps, owner, and status. A new notebook can start from a topic prompt, blank page, pasted material, or a supported upload.

NB03 MUST Preserve the notebook across refresh, redeployment, and a second authenticated device. Show saving, saved, offline draft, conflict, and failed states where applicable. Saved means the server acknowledged the revision, not merely that the browser queued it.

NB04 MUST Provide an empty state and a removable example notebook. Demonstration content must be labeled and isolated from the user's own notebooks. A missing provider key in development may enable a labeled fixture mode; production must fail configuration checks instead of silently serving fixtures.

NB05 MUST Implement trash with 30-day recovery for notebooks and topics unless the user requests immediate permanent deletion. Show descendants affected before deleting a topic. A notebook in trash cannot be shared or used for new AI runs until restored.

10 Branching and return behavior

BR01 MUST Create a child topic from selected text, a formula, a diagram, an AI message, or a topic-level action. The app suggests an editable title and retains a snapshot of the selected content. Topic creation succeeds independently of AI generation; a failed first answer leaves a usable branch with Retry.

BR02 MUST Support nested branches without an artificial depth restriction in the product model. Test at least 50 levels of stored ancestry and 12 levels of interactive navigation. Long breadcrumbs collapse visually while keeping every ancestor accessible. Detect cycles and excessive request sizes server-side.

BR03 MUST Store a return location containing topic ID, surface, stable block or message ID, text selection when available, scroll offset, and unsent draft reference. Restore after the content has loaded. A temporary highlight shows the return target without moving keyboard focus unexpectedly.

BR04 MUST Use stable block identifiers plus a text quote and prefix/suffix fallback. If edits make the exact anchor unavailable, show the preserved excerpt and a message that the original passage moved or was removed. Never silently attach to a different occurrence of the same phrase.

BR05 MUST Support Ask here as a persistent quick discussion anchored to the passage. Explore as topic promotes it atomically, transferring its history and anchor without duplicate messages or an extra AI charge.

BR06 MUST Show parent, children, related topics, and the path back. Rename, collapse, archive, and learning-status changes must appear consistently in notebook, tree, map, and search results. Status changes are user actions, not inferred mastery.

BR07 MUST Let users create sibling approaches from the same question. Their inherited context is captured at creation. New information in one sibling is not included in another sibling's AI context unless the learner explicitly compares, merges, or attaches it.

BR08 MUST Keep topic movement explicit. Reparenting validates ownership and cycles, preserves the original fork snapshot for history, and offers an explicit refresh of inherited context. Merely dragging a node on the map changes layout only.

11 Notebook editing and saved explanations

NOTE01 MUST Provide a rich editor with the components in Section 8, undo and redo, selection actions, keyboard editing, paste handling, and readable print output. The interface must not require Markdown syntax. Markdown remains an export format.

NOTE02 MUST Store schema-versioned structured content. Each top-level block has a stable UUID. Tiptap uses an explicit document schema, which supports this design [S3]. Implement custom content blocks rather than relying on paid extensions without an approved license. Validate editor content on both client and server.

NOTE03 MUST Keep this creates a preview from a selected AI answer or excerpt. The learner chooses exact content, a concise explanation, a worked example, or a visual summary. They can edit and choose a target topic. Initial topic generation may create its first draft page automatically; subsequent AI changes to an existing page require explicit application.

NOTE04 MUST Attach provenance to generated or captured blocks: source message or document IDs, source revision, selected excerpt, AI run when applicable, author type, and creation time. Show a compact From discussion or From source link. Editing the wording preserves provenance and marks the block as user edited.

NOTE05 MUST Save after a short debounce, with a target of server acknowledgment within two seconds after typing stops under the performance test conditions. Keep a durable local draft until acknowledgment. The server applies a write only to the expected revision; conflicts must preserve both versions.

NOTE06 MUST Offer revision history, restore as a new revision, and a readable change preview for AI proposals and merges. Restoring an old revision does not delete newer history. Do not overwrite later edits merely to undo a previous operation.

NOTE07 MUST Allow users to edit formula input, chart parameters, diagram labels and connections, captions, and alternative text. Rendering failures preserve the editable source and show a repair state. Textual explanations and accurate deterministic plots must remain available when a visual cannot be rendered.

NOTE08 MUST Suggest duplicate concepts when creating a topic, but leave linking or duplication to the user. Existing related topics can be linked without changing either topic's history or automatically importing their context.

12 Topic map and tree

MAP01 MUST Render the same topic records used by the notebook. Parent edges have a distinct appearance from labeled related edges. The tree represents only parent relationships. A legend and accessible text labels explain edge types.

MAP02 MUST Provide zoom, pan, fit to selection, search, focus on the current topic, and collapse or expand descendants. Auto-layout creates a readable starting arrangement. Manual positions and collapsed groups persist. React Flow supplies interactive graph primitives; persistence and domain rules belong to Offscript [S4].

MAP03 MUST Selecting a node opens its topic. Each node shows a title, a short excerpt, learning status, and a child count where useful. Avoid displaying every message or every note block as a node. Large branches can collapse to a summary card.

MAP04 MUST Create and edit related links with labels such as explains, example of, alternative to, or related to. Users may remove these links without deleting a topic. Automated link suggestions remain proposals until accepted.

MAP05 MUST Keep the map usable with 500 topics and provide progressive loading or collapsed rendering for the 1,000-topic performance fixture. Do not mount every note editor inside map cards. The outline must remain usable if graph rendering fails or is inaccessible.

MAP06 MUST Preserve the selected topic when moving between notebook, map, and comparison. View changes must not generate AI calls, mutate content, or consume usage allowances. Map layout updates must not invalidate note edits or conversation context.

The initial product provides a connected topic graph with explicit relationships. It does not promise automatic extraction of a universal knowledge graph or proof that every connection is semantically correct. Cross-notebook semantic discovery is later work.

13 Comparison and selective merging

CMP01 MUST Compare two or three selected topics in the same notebook. Capture immutable source revisions at the time comparison begins. Show topic titles, the common question when one exists, criteria, relevant saved notes, and links to the source discussions.

CMP02 MUST Let the learner choose or edit criteria. Useful defaults include intuition, assumptions, steps, strengths, limitations, and when to use the approach. The AI must separate shared conclusions, differing claims, unresolved questions, and conditional recommendations. It must not manufacture agreement or force a winner.

CMP03 MUST Present the comparison in columns on large screens and aligned cards or tabs on phones. Selecting a criterion must allow comparison across all selected topics. The generated comparison remains editable and can be reopened without another generation charge.

CMP04 MUST Link synthesized claims to the exact source items supplied to the comparison. If the source does not support a claim, label it as an additional AI explanation or omit it. Show an Out of date indicator when source revisions change. Refresh creates a new comparison revision and preserves the old one.

MERGE01 MUST Select individual conclusions and a target topic. The default destination is their common parent when one exists; otherwise require an explicit target. A merge can insert new blocks or propose replacements. It cannot modify unrelated topics or merge whole chat histories implicitly.

MERGE02 MUST Show a preview containing selected source items, proposed wording, insertion or replacement locations, and existing content that would change. Allow editing, deselection, and cancellation before application. An unresolved conflict remains visible in the target if the learner chooses to preserve both claims.

MERGE03 MUST Apply the merge in one database transaction with an expected target revision and an idempotency key. Store the before and after revisions and a mapping from each inserted block to its sources. If the target changed during review, reject the stale apply and regenerate the preview against the current target.

MERGE04 MUST Support undo as a new inverse change. If affected blocks were edited later, show the conflicting reverse changes for review rather than restoring an entire old page. The original branches remain intact after merge and undo.

MERGE05 MUST Merged content becomes available to future questions in the target topic through its current approved page. Existing child topics keep their inherited ancestor snapshot until the user explicitly refreshes that inherited context. Explain this behavior in the context inspector.

14 Sources and imports

SRC01 MUST Accept pasted plain text and Markdown, text-based PDFs, and PNG, JPEG, or WebP screenshots. Default limits are 100,000 characters for pasted text, 20 MB and 50 pages per PDF, and 10 MB per image. Enforce limits on the server and show them before upload. These are configurable product limits, not provider guarantees.

SRC02 MUST Store the original source privately, a content hash, extracted text, page or image coordinates when available, and processing status. The source reader can open the relevant page or image and highlight the referenced excerpt. Preserve a title and optional user-supplied attribution.

SRC03 MUST Process imports as durable jobs with queued, processing, ready, partial, failed, and canceled states. The learner can leave and return. Deduplicate exact uploads within the same account where safe; do not reveal whether another user owns the same file.

SRC04 MUST Detect encrypted, corrupt, unsupported, oversized, and primarily scanned PDFs. Text PDFs are required for launch. If reliable extraction is unavailable for a scanned PDF, clearly request selected pages as images or pasted text. Do not silently produce an empty notebook or claim to have read omitted pages.

SRC05 MUST Support image-based explanation through a vision-capable model. Present extracted text and interpretations as editable proposals. Ambiguous handwriting, equations, or labels require an uncertainty indicator and user correction. Image references must retain their connection to the original image.

SRC06 MUST Propose a topic outline with editable titles and scope before creating a large set of topics. The default is one root and a small proposed outline, not hundreds of automatically opened discussions. Creating the outline does not generate full lessons for every child until requested.

SRC07 MUST Retrieve only source chunks that belong to the current user and are attached to the active notebook or explicitly selected scope. Source citations must reference retrieved content actually supplied to the model. Clicking a citation opens the matching source location. A missing or removed source displays its status instead of a fabricated replacement.

SRC08 MUST Treat source text, documents, and images as untrusted learning material. Instructions embedded in them cannot change system behavior, reveal unrelated notes, run code, send messages, or authorize external actions. Arbitrary URL fetching and web crawling are outside the first release.

15 Search export and sharing

FIND01 MUST Search the user's notebooks, topic titles, saved notes, and discussions. Support filters for notebook, content type, and learning status. Results show the matching excerpt and open the relevant block or message. The initial implementation may use PostgreSQL full-text search; semantic search can be added when measured retrieval needs justify it.

FIND02 MUST Provide recent activity and a Revisit list using user-selected learning status. Resume should restore the last acknowledged location; an unfinished local draft is offered separately and must not replace a newer server revision without review.

EXPORT01 MUST Export selected topics or a notebook as a readable PDF, Markdown with relative asset links, and a structured JSON package with schema version, topic relationships, provenance, and assets. Export scope is explicit. Raw discussions are optional and off by default. Formula and diagram content must remain legible in PDF; JSON must retain editable definitions.

EXPORT02 MUST Run large exports as durable jobs and provide a private, short-lived download. Verify the selected scope at job creation and again before delivery. Test that exported JSON can be parsed and validated and that every asset reference resolves. Full interactive restoration from an export is later work unless added explicitly.

SHARE01 MUST Publish an immutable snapshot of selected notes after a preview. The snapshot excludes private chats, unselected topics, and original source files by default. Source names and excerpts are included only when selected in the preview. If the owner edits the notebook, the existing snapshot stays unchanged until republished.

SHARE02 MUST Use an unguessable share token stored as a hash. Resolve it through a server endpoint that returns only the published snapshot. Public clients must never receive credentials that can query private notebook tables. Mark shared pages noindex by default.

SHARE03 MUST Allow revocation and replacement. New access after revocation must fail within 60 seconds, including asset access; use equally short asset URLs and appropriate cache controls. The sharing UI must explain that revocation cannot remove copies someone has already downloaded.

SHARE04 MUST Provide a report link and an operator workflow to disable an abusive public snapshot. Public sharing does not grant editing rights or automatically create a collaboration workspace.

16 AI tutor and context behavior

Teaching contract

AI01 MUST Use real provider calls in production. Teach in plain language appropriate to the user's stated level. Prefer a short explanation, a concrete example, and a relevant visual when the concept benefits from one. Users can request more detail, another example, an analogy, or a diagram without losing the topic.

AI02 MUST Separate factual source-based statements, additional explanation, and uncertainty. Never invent a citation, claim to have inspected unavailable material, or imply a current web lookup occurred when web access is not enabled. Numerical plots and derived table values use deterministic calculations. The AI should acknowledge when a question requires fresher evidence than the app has.

Context assembly

For every run, the server builds and records an immutable context manifest in this order: product and safety instructions; user learning preferences; current question and selection anchor; the active topic's current approved note revision; recent local discussion; relevant inherited ancestor excerpts captured at the fork; relevant authorized source chunks; explicitly attached additional topics.

The manifest identifies records and revisions, selection reasons, truncation, model ID, prompt version, and approximate token allocation. It must not contain another user's content. The inspector presents understandable summaries such as Current topic, Earlier discussion, Parent context, and Selected sources; ordinary users do not need raw prompt machinery to ask a question.

AI03 MUST Exclude unrelated siblings and unrelated notebooks by default. Comparison is a separate operation with the selected branch snapshots included explicitly. Related map edges do not silently broaden context.

AI04 MUST Bound context by a server-controlled token budget, initially 24,000 input tokens and up to 4,000 output tokens for an ordinary generation. Select a compatible model and adjust budgets through configuration. Keep the current question and anchor intact. Compress older local history into a versioned summary with references to original messages; retrieve those originals when needed. Flag omitted or summarized material in the manifest.

AI05 MUST Freeze context when a run begins. A later note edit cannot silently change that run's meaning. Applying a resulting note proposal checks its base revision. Users can refresh inherited parent context explicitly; this creates a new snapshot and does not rewrite the historical one.

17 AI response contracts and runtime

Response structure

Use a provider adapter with separate operations for explain, clarify, summarize selection, propose notes, compare topics, propose merge, and interpret image. The adapter must support streaming, cancellation, usage reporting, typed failures, and server-side credentials. The recommended first adapter uses the OpenAI Responses API with application-managed conversation state and structured outputs where appropriate [S5, S6].

The application owns its conversation and topic records. Do not use a single provider conversation for the entire notebook. Do not depend on provider retention as the only copy of a user's discussion. Model IDs and prompt versions must be configuration and release data, not scattered constants.

Every structured result carries a schema version, operation type, content blocks, citation references, uncertainty notes, and any proposed mutations. A server-generated allowlist resolves citation IDs. The model does not create trusted database identifiers, HTML scripts, share tokens, or executable application code.

Suggested logical contract:

{

  "schema_version": 1,

  "operation": "propose_notes",

  "blocks": [

    {"type": "definition", "content": "Editable explanation"}

  ],

  "citations": [{"source_ref": "input_ref_1"}],

  "uncertainties": [],

  "proposed_changes": []

}

The example defines shape, not the complete production schema. The implementation must specify and test every permitted block type. Structured output reduces formatting failures but does not establish factual correctness [S5]. Reject invalid references, unsafe markup, oversized content, and unsupported node types. Permit one bounded repair attempt; then show a recoverable error with the original response preserved as a draft where safe.

Run lifecycle

AI06 MUST Persist a run before making a provider request. Track queued, running, streaming, completed, canceled, failed, and interrupted states. Persist completed content and periodic partial checkpoints. Distinguish an incomplete answer from a completed one. Reopening a run never regenerates it automatically.

AI07 MUST Provide a Stop action that attempts upstream cancellation and immediately stops applying further content locally. Record any provider cost already incurred. A dropped connection can reattach to the existing run; it must not start a second billable generation. A crashed worker does not blindly repeat a provider call with an unknown outcome.

AI08 MUST Retry transient failures with bounded backoff and a request identity. Never retry permission failures or invalid user input as if they were transient. Global AI outages must leave existing notes, search, editing, and export available. Show useful errors without provider secrets or raw stack traces.

18 Technical architecture

Recommended baseline

Use a modular TypeScript application with a Next.js web server, React interface, Tiptap editor, and React Flow map. Keep domain logic independent of UI components. Use Supabase for PostgreSQL, authentication, private object storage, and a durable queue. Use a separate Node worker for AI runs, imports, comparisons, exports, and deletion jobs.

Deploy the Next.js server and worker as separate Render services from the same repository and release revision. Render supports a server deployment for a full Next.js application and a separate background-worker service [S7, S8]. This is a proposed deployment baseline; an equivalent host is acceptable if streaming, background jobs, persistence, and the operational acceptance tests remain satisfied.

Supabase Queues provides a PostgreSQL-backed queue [S9]. Treat job execution as retryable and potentially duplicated after failures regardless of delivery terminology. Protect side effects with application-level idempotency, leases, unique constraints, and transactions.

Component | Responsibility

Web client | Editor, navigation, map, local drafts, accessible interactions

Web server | Authentication, authorization, validation, API, stream relay

Worker | AI orchestration, import processing, exports, recovery tasks

PostgreSQL | Canonical topics, revisions, jobs, usage, permissions

Object storage | Original sources, attachments, exports, published assets

AI provider | Text and vision generation through a server adapter

Email service | Verification, recovery, operational support delivery

Monitoring | Errors, latency, queue health, cost, synthetic checks



Use production SMTP through a provider such as Resend, and an error service such as Sentry or an equivalent. Product analytics may be implemented with first-party events initially. Stripe is recommended only when paid subscriptions are enabled. No secret is embedded in browser code.

Figure 2  Application services and persistent state

Repository contract

Suggested layout: apps/web, apps/worker, packages/domain, packages/editor-schema, packages/ai, packages/ui, supabase/migrations, tests/e2e, tests/evals, and docs. Include a lockfile, runtime versions, environment example, seed data, deployment manifest, database policies, architecture decisions, and the current PRD. Choose supported dependency versions at implementation kickoff and pin them; verify commercial licensing for every optional extension.

19 Core data model

Application record IDs are opaque UUIDs; provider IDs and share tokens use their own formats. Store timestamps in UTC. User-facing data carries an owner or notebook ownership path, creation and update times, and deletion state where relevant. Use foreign keys and transaction-level checks rather than trusting identifiers supplied by the browser.

Record | Essential fields

profiles | user_id, display_name, preferences, role, deletion_state

notebooks | id, owner_id, title, description, status, version

topics | id, notebook_id, parent_topic_id, title, status, current_page_revision_id, version

topic_links | id, notebook_id, from_topic_id, to_topic_id, relation_label

anchors | id, topic_id, origin_type, origin_id, origin_revision, block_id, selection_quote, prefix, suffix, offsets, snapshot

thread_contexts | id, topic_id, parent_snapshot_id, inherited_refs, summary_refs, version

discussions | id, topic_id, kind, anchor_id, promoted_topic_id

messages | id, discussion_id, role, content, sequence, run_id, completion_state

topic_revisions | id, topic_id, revision_number, schema_version, editor_json, created_by, change_reason

provenance_links | block_id, topic_revision_id, source_type, source_id, source_revision, excerpt

view_states | user_id, notebook_id, device_id, selected_topic, return_stack, viewport, collapsed_ids



Page revisions are immutable. Each editor_json document includes stable block IDs. Read the current page through the pointer on the topic; historical provenance points to immutable revisions. Message content is immutable once completed. Regenerating or editing a question creates a new message version or a new discussion branch with an explicit link to the earlier version.

Do not put full notebook content into map node data or view_states. The client resolves content from canonical topic records. Keep layout positions separate from learning hierarchy. Store unsent drafts per user, device, and topic, and make recovery explicit when several drafts exist.

Indexes must cover owner and notebook filters, topic ancestry, message sequence, revision lookup, updated time, and search vectors. Validate that related links stay within the notebook and that a parent assignment cannot introduce a cycle. Use a transaction or database function for multi-record graph mutations.

20 Supporting records and consistency

Record | Essential fields

sources | id, notebook_id, storage_key, content_hash, media_type, status, metadata

source_chunks | id, source_id, text, page_number, coordinates, search_vector

ai_runs | id, user_id, operation, context_manifest, model_id, prompt_version, status, usage, request_key

jobs | id, user_id, type, payload_ref, state, attempts, lease_until, error_code

comparisons | id, notebook_id, topic_revision_refs, criteria, result, version, status

merge_proposals | id, comparison_id, target_topic_id, base_revision, selected_refs, proposed_patch, state

merge_events | id, proposal_id, before_revision, after_revision, inverse_patch, applied_by, request_key

share_snapshots | id, owner_id, token_hash, content_snapshot, asset_refs, published_at, revoked_at

usage_ledger | id, user_id, run_id, reserved_cost, actual_cost, action_units, state

subscriptions | user_id, provider_customer_id, subscription_id, entitlement_state, period_end

audit_events | id, actor_id, action, target_type, target_id, result, request_id



Subscription records may remain unused while billing is disabled. Jobs and usage reservations must be durable and linked to a single logical operation. The queue payload should contain record references rather than copies of private source documents.

Write semantics

Each note write supplies the expected revision. A transaction verifies access and that revision, inserts the new immutable revision, and updates the topic pointer. A conflict returns the latest revision reference without overwriting the submitted local draft. A merge additionally records its event and provenance in the same transaction.

Use an idempotency key scoped to user and operation for topic creation, generation, import, export, merge, and payment-related actions. Persist the request hash and result. Reusing a key with a different payload returns a conflict. Repeating the same request returns the original result and does not charge or insert twice.

Maintain soft deletion for recoverable content. Permanent deletion invalidates relevant jobs, retrieval entries, share links, and storage objects. Preserve only minimal non-content operational or billing records where the approved retention policy requires them. Source removal must update provenance to show Source removed without inventing a replacement.

21 API and background job contracts

The following logical endpoints define behavior; route names may change if the repository documents an equivalent typed contract. All private endpoints authenticate the request, verify ownership, validate input, and apply rate limits. Request bodies cannot choose a different owner_id.

Operation | Suggested endpoint | Required behavior

Notebook CRUD | /api/notebooks | Owned records, pagination, version checks

Topic creation | /api/topics | Atomic topic, anchor, context snapshot

Page update | /api/topics/:id/page | Expected revision, immutable next revision

Branch creation | /api/topics/:id/branches | Source anchor and fork snapshot

AI operation | /api/ai/runs | Idempotent creation and usage reservation

Stream and status | /api/ai/runs/:id | Reattach to the same run

Stop run | /api/ai/runs/:id/cancel | Cancel state and upstream attempt

Source upload | /api/sources | Private upload authorization and processing

Comparison | /api/comparisons | Versioned two or three topic snapshot

Merge preview | /api/merge-proposals | No live page mutation

Merge apply | /api/merge-proposals/:id/apply | Revision guard and atomic commit

Export and share | /api/exports and /api/shares | Explicit scope and private job results

Search | /api/search | Authorization before retrieval and ranking

Account deletion | /api/account/deletion | Recent authentication and durable cleanup



Streaming and errors

Use an authenticated event stream or an equivalent resumable transport. Events include run.created, run.started, content.delta, content.checkpoint, run.completed, run.failed, and run.canceled. Every event has a run ID and increasing event ID. A reconnect supplies the last event ID. If old deltas have expired, the server supplies a persisted checkpoint and current state.

Use a consistent error envelope containing a stable code, safe message, request ID, retryable flag, and optional field errors. Required cases include UNAUTHENTICATED, NOT_FOUND, REVISION_CONFLICT, LIMIT_REACHED, PROVIDER_UNAVAILABLE, SOURCE_UNREADABLE, SCHEMA_INVALID, and RUN_INTERRUPTED. Never expose a private record's existence through a different response to an unauthorized requester.

Job execution

Workers acquire a lease, heartbeat while processing, and acknowledge only after a result has committed. Retry safe operations with bounded exponential backoff; cap attempts and move exhausted jobs to an operator-visible failed state. Recheck authorization and deletion before sensitive side effects. For a provider call with an ambiguous outcome, recover the existing result when possible or mark interrupted and ask the user to retry explicitly. Reconcile expired usage reservations without hiding actual provider cost.

22 Security privacy and retention

Access control

SEC01 MUST Enable PostgreSQL row-level security for all user-facing tables and policies for private storage. Supabase documents database and storage authorization through RLS [S10, S11]. API authorization remains mandatory even when RLS is present. Operators, migrations, and workers use separately scoped credentials.

SEC02 MUST Keep provider keys, database service credentials, SMTP credentials, webhook secrets, and signing keys server-side. Never place them in public environment variables, logs, exported notebooks, or browser bundles. Rotate credentials through the deployment platform.

SEC03 MUST Sanitize rendered text and diagrams; allowlist links and block types. Do not execute AI-provided JavaScript or HTML. Check upload signatures and file limits, isolate parsing, apply resource and time limits, and serve attachments with safe content types. Arbitrary remote fetching is disabled in v1.

SEC04 MUST Protect sessions with secure cookie settings and appropriate CSRF protection for cookie-authenticated mutations. Rate-limit authentication and expensive operations. Verify webhook signatures and deduplicate event IDs when integrations are enabled. Validate cross-user isolation across direct API calls, search, downloads, queued jobs, and shared snapshots.

Data handling

PRIV01 MUST Make notebooks private by default. Explain which AI provider receives selected context and sources. Offscript must not use private learning content for its own model training without separate consent. Configure provider storage controls deliberately; store:false must not be advertised as a guarantee of zero provider retention [S12].

PRIV02 MUST Keep raw prompts, note bodies, source text, and screenshots out of ordinary analytics and error logs. Record IDs, status, latency, token counts, and error codes. Any temporary content-level debugging must be explicitly authorized, time-limited, and auditable.

PRIV03 MUST Proposed retention defaults are 30 days for recoverable trash, 30 days for operational metadata logs, and 14 days for rotating backups. Account deletion revokes sessions and shares immediately and removes active content within seven days. Deleted content expires from backups through rotation; restore procedures must reapply deletion tombstones. The published policy must match the implemented providers and retention configuration.

The initial audience is adults. Publish accurate privacy and terms pages describing ownership, AI limitations, supported use, sharing, deletion, and support. Final wording, launch jurisdictions, and any age or consent requirements are owner decisions before public signup opens. This PRD does not assert regulatory certification or legal compliance.

23 Reliability performance and device support

Persistence and recovery

REL01 MUST Preserve local drafts in IndexedDB until the server acknowledges them. Namespace local state by account and clear private caches at sign-out. If storage is unavailable, show that draft recovery is limited. Offline mode may read recently cached material and capture drafts; AI generation and cloud confirmation require connectivity. Never show a local draft as synced.

Before an explicit sign-out with unsynced work, offer to reconnect and save or download a local recovery copy. Explain that signing out clears the device cache. Session expiry preserves the same account's draft for recovery after reauthentication; it must never display that draft to a different signed-in account.

REL02 MUST Use optimistic concurrency for multiple tabs and devices. A stale write presents both versions or a recoverable copy. Real-time collaboration is not promised. A conflict must never discard an explanation silently.

REL03 MUST Back up the database and object storage separately. Supabase database backups do not include stored file objects [S13]. Proposed launch recovery objectives are no more than 24 hours of data loss in a disaster and restoration within eight hours. Test restoring notes, relationships, source files, and private access into an isolated environment. Verify backups daily and conduct a restore drill before launch.

REL04 MUST Keep reading and editing available during an AI outage. Use health checks, queue monitoring, bounded retries, and visible job status. Deployment shutdown must drain or safely interrupt active work. Service configuration and persistent state must survive container replacement.

Performance targets

Targets below are release criteria to measure, not current performance claims. Use a documented test profile with 100 authenticated sessions, 20 ordinary API requests per second for 15 minutes, up to 10 concurrent AI runs, and notebooks containing 500 topics. Use a separate 1,000-topic graph fixture.

Measure | Launch target

Cached topic navigation | Visible response within 200 ms at p95

Ordinary read and save API | Server response within 750 ms at p95

Autosave acknowledgment | Within 2 seconds after typing pauses at p95

AI first useful content | Within 8 seconds at p95 when no queue wait applies

Ordinary AI completion | Within 45 seconds at p95 on the selected evaluation set

Run timeout | Visible recovery after 90 seconds unless a longer job is declared

Map interaction | Smooth pan and zoom; no sustained input blocking over 100 ms

Availability objective | 99.5 percent monthly for core app access during public beta



Record queue wait separately from provider latency. If an AI target cannot be met, resolve the model, context, or UX issue before claiming it passed. Test current and previous major Chrome, Edge, Firefox, and Safari versions, plus current iOS Safari and Android Chrome. Installability is progressive enhancement; browser behavior varies [S14].

24 Usage controls costs and optional billing

USAGE01 MUST Launch with server-enforced quotas and a visible usage page. Proposed free-beta defaults: 10 notebooks, 500 topics per notebook, 500 MB of private files, 20 user-initiated AI actions per day, two source imports per day, and two simultaneous AI runs per user. Reset daily limits at 00:00 UTC and display the next reset in the user's local time. All limits are configuration values.

An AI action is one user-initiated explanation, image interpretation, comparison, summary, or note-generation request. Internal schema repair and summarization do not consume a second visible action but do count toward operating cost. Reading, editing, navigation, reopening saved comparisons, and applying an already generated merge do not consume AI actions.

USAGE02 MUST Reserve an upper bound on expected cost and an action unit before calling a provider. Settle actual usage on completion and reconcile interrupted runs. A provider failure must not count as a successful user action. Costs already incurred still appear in the operator ledger. Duplicate requests cannot reserve or charge twice.

USAGE03 MUST Configure owner-approved daily and monthly global spending ceilings, output token caps, maximum job concurrency, and an emergency AI pause. Stop accepting new billable operations when the remaining reserved budget is insufficient. Continue to allow users to read, edit, and export existing work. Do not rely only on delayed provider budget alerts.

Cost planning

Before launch, estimate cost using actual selected provider rates and measured usage: AI input and output tokens, vision processing, hosting, database capacity, stored files, egress, email, monitoring, and backups. Report expected cost per completed learning session, active user, and month at low, expected, and high usage. This PRD intentionally does not invent a fixed hosting price or a model price.

Paid activation gate

Billing is disabled by default. If the owner enables subscriptions, implement real hosted checkout, customer portal, authenticated customer mapping, signature-verified webhooks, idempotent event processing, invoice and entitlement reconciliation, failed-payment handling, cancellation, and downgrade behavior. Stripe documents webhook signature verification and delivery behavior [S15]. Never grant entitlement based solely on a browser redirect.

Price, included usage, renewal wording, refunds, taxes, and grace periods are owner decisions. A downgrade preserves reading and export access and explains which creation limits apply. Validate the entire lifecycle in test mode and one owner-authorized live transaction before paid signup opens. Hide unfinished paid controls.

25 Analytics and learning validation

Product success measures

The primary success measure is a completed learning loop: a user creates a branch, receives an explanation, keeps or edits useful content, and returns to the original topic within a session. This demonstrates product use, not proven educational mastery.

Proposed early validation targets are that at least 70 percent of 10 to 15 recruited learners can complete the core loop without moderator intervention, at least 80 percent can find a saved explanation the following day, and at least half report less need to reconstruct notes outside the app. Treat these as experiment thresholds to revise after observing real use.

Track activation, time to first kept explanation, successful return rate, comparison completion, merge application and undo, next-day revisit, weekly returning learners, save conflicts, failed generations, and support reports. Avoid optimizing raw message volume or branch count at the expense of clarity.

Event contract

Event | Minimal properties

notebook_created | notebook_id, entry_method

branch_created | topic_id, parent_id, depth, source_kind

quick_question_promoted | discussion_id, new_topic_id

return_completed | topic_id, exact_anchor_found, fallback_used

explanation_kept | topic_id, format, edited_before_save

comparison_completed | comparison_id, branch_count

merge_applied or merge_undone | merge_id, selected_item_count

save_failed or save_conflict | revision_id, error_code

ai_run_finished | operation, duration, status, tokens, estimated_cost

export_completed | scope_count, format



Events must exclude note text, questions, filenames containing private information, and source excerpts. Use pseudonymous user IDs and a documented session definition. Proposed session boundary: 30 minutes of inactivity. Product analytics preferences must be respected; essential security and reliability logs remain separate and minimal.

Conduct observed sessions with the founder's actual style of learning as one input, then test different learning styles. Compare the time and effort required to recover an explanation against the participant's existing workflow. Keep evidence of confusion, abandonment, and unwanted automatic organization, not only positive feedback.

26 Acceptance scenarios for the learning experience

Each scenario is a release test with recorded results. Automated tests cover deterministic behavior; humans evaluate teaching quality and visual clarity. The identifiers below map to the requirement families in this PRD.

AC01 Account and persistence Create a fresh verified user, start a notebook, ask a real question, edit a note, refresh, sign out, and sign in on another device. All acknowledged content and ownership remain correct. Covers AUTH01, NB01 to NB04, NOTE05, REL01.

AC02 Deep branch and return Create three nested branches from different content types and return through each origin. Repeat with a 12-level path. Browser back, breadcrumb selection, and Return to where I was preserve drafts and context. Covers BR01 to BR04.

AC03 Changed anchor Edit, duplicate, move, and delete the originating passage. Return reattaches only when unambiguous; otherwise it shows the preserved excerpt and a clear fallback. It never highlights an unrelated duplicate phrase. Covers BR04, NOTE02.

AC04 Quick clarification Ask a local question, close and reopen it, then promote it to a topic. Verify that no messages disappear, no duplicate topic appears, and promotion does not trigger a second AI charge. Covers BR05, USAGE01.

AC05 Branch isolation Put a unique synthetic fact in one sibling and a different fact in another. Inspect actual context manifests for a third branch. Neither fact appears unless explicitly attached. Repeat across two notebooks and two users. Covers BR07, AI03, SEC04.

AC06 Saved explanation Keep an excerpt, edit its wording, choose a destination, and reopen it. Formula and diagram blocks remain editable. The original source and revision remain reachable. Covers NOTE03, NOTE04, NOTE07.

AC07 Three approaches Compare three topic revisions with custom criteria. Verify claims against supplied sources. Change one source and confirm the saved comparison is marked out of date while retaining its original result. Covers CMP01 to CMP04.

AC08 Selective merge Merge selected conclusions from two branches into the parent. Reissue the same apply request and verify one target revision and one merge event. Source branches remain unchanged. Covers MERGE01 to MERGE03.

AC09 Conflict and undo Edit the target after preview, then attempt apply. It must reject the stale revision. After a valid merge, edit one inserted block and request undo. The app preserves later work and presents the conflict for review. Covers MERGE03, MERGE04, REL02.

AC10 Source learning Import a text PDF and an image, inspect extraction, generate an explanation, and click every citation. Test a scanned, encrypted, oversized, and corrupt PDF. Unsupported content produces useful recovery instead of invented source claims. Covers SRC01 to SRC08.

27 Acceptance scenarios for production readiness

AC11 Tenant isolation With users A and B, attempt direct reads and mutations using each other's topic, source, run, job, export, and storage IDs. Repeat through search and shared routes. Every unauthorized path must fail without revealing private metadata. Covers SEC01 to SEC04, FIND01.

AC12 Stream recovery Interrupt the network during a real generation, reconnect, and reopen the run. It resumes from persisted state or presents an interrupted result. There is no duplicate provider run caused by reconnect. Stop must cease further local application. Covers AI06 to AI08.

AC13 Save and device conflicts Disconnect during an edit, close and reopen the tab, then reconnect while a second device has a newer revision. Both versions remain recoverable and Saved appears only after acknowledgment. Covers NOTE05, REL01, REL02.

AC14 Sharing boundary Publish two selected note pages and inspect the response as an anonymous visitor. No raw chats, unselected topics, or original private files are available. Revoke the link and verify access fails within 60 seconds. Covers SHARE01 to SHARE04.

AC15 Export portability Export notes containing formulas, charts, images, nested topics, and provenance in all three formats. Inspect the PDF, open Markdown assets, and validate JSON against the versioned schema. Covers EXPORT01, EXPORT02.

AC16 Limits and costs Exhaust user and global allowances, issue duplicate requests, cancel a run, and simulate provider failure. New billable work is blocked correctly; existing notes remain accessible; cost reservations and actual charges reconcile. Covers USAGE01 to USAGE03.

AC17 Deletion and retention Delete a source, notebook, and account in separate fixtures. Check search, jobs, shares, storage, and local caches. Restore a backup into isolation and verify deletion tombstones prevent re-exposing deleted content. Covers AUTH04, NB05, PRIV03, REL03.

AC18 Failure and rollback Stop a worker during a job, return provider errors, expire a secret in staging, and deploy a deliberately unhealthy build. Observe safe recovery, alerts, and rollback without duplicate merges or corrupted notes. Covers AI08, REL04, operations requirements.

AC19 Accessibility and device support Complete account creation, branching, return, note editing, comparison, merge, and export by keyboard and on supported mobile browsers. Check screen-reader navigation, zoom, contrast, and reduced motion. Covers Section 8 and Section 23.

AC20 Deployment and recovery Deploy from a clean checkout using the documented procedure. Restore the database and object files into an isolated environment, then run the core learning and privacy tests. Confirm alerts reach the named operator. Covers Section 30 and REL03.

AC21 Billing when enabled Validate checkout, cancellation, renewal, failed payment, duplicate and out-of-order webhook delivery, and downgrade. Reading and exports remain available as specified. This scenario is mandatory only before paid activation.

28 AI evaluation and test strategy

Evaluation set

Maintain a versioned set of at least 40 learning tasks before public launch: 12 statistics or mathematics tasks, eight programming tasks, eight everyday or nontechnical explanations, six comparisons with conflicting claims, and six source or context-isolation tasks. Include a question about distribution tails, a variance clarification, alternative classification methods, an ambiguous screenshot, a misleading source instruction, and a missing citation target.

Use synthetic or permissioned materials. Record expected concepts, acceptable variation, numerical answers where applicable, source requirements, and critical failure conditions. Human reviewers rate clarity, correctness, relevance, visual usefulness, and appropriate uncertainty on a five-point rubric. A proposed launch threshold is an average of at least four on each dimension, with no unresolved critical factual, citation, or privacy failures in the evaluation set.

Run the complete set when changing model or major prompt versions. A fast representative subset can run on ordinary builds. Deterministic checks validate schema, citation membership, source authorization, graph invariants, and arithmetic. Human review evaluates whether the explanation is understandable and whether a comparison fairly represents its sources.

Automated coverage

Use unit tests for context selection, anchor matching, revision checks, cycle prevention, quota reservations, and inverse merge patches. Use integration tests against an isolated real database for RLS, storage rules, transactions, queue retries, deletion, and sharing. Use browser tests for the critical learning flow, persistence, comparison, and export. Use contract fixtures for provider errors and a smaller real-provider smoke suite in staging.

CI mocks do not establish that production AI works. The launch evidence must include real calls to the selected provider and successful production email delivery. Do not run destructive tests against real users or private production notebooks.

Release gate

Every MUST requirement has implementation and evidence references in a coverage matrix. All acceptance scenarios applicable to the enabled release must pass. There must be no unresolved critical or high-severity security issue, no reproducible loss of an acknowledged note, no incorrect sharing boundary, and no unimplemented core control displayed as working. The owner can accept documented lower-severity defects with a remediation date; core learning and privacy failures block release.

29 Implementation phases and exit gates

Phase 0 Establish the project

Create the repository, preserve the PRD, define schemas and design tokens, set up local and staging environments, and write the architecture decision record. Prepare an environment inventory and owner input list. Produce a small interaction prototype to validate notebook, branch, return, and keep actions. Exit only when the interaction is understandable and the technical baseline is reproducible.

Phase 1 Complete one durable learning loop

Implement authentication, notebook and topic storage, the editor, real AI generation, branch context, return anchors, and kept explanations. Add the smallest useful tree and a seeded statistics example. Exit when AC01 to AC06 pass in staging, including a second device and tenant-isolation checks for implemented endpoints.

Phase 2 Complete the product workflow

Implement map navigation, comparison, selective merge and undo, imports, source citations, search, revision history, export, and snapshot sharing. Apply the intended notebook design throughout. Exit when AC07 to AC15 pass, and every core journey works with user-generated content.

Phase 3 Harden the public release

Complete quota accounting, cost caps, monitoring, error recovery, accessibility, responsive layouts, retention, deletion, backups, support, and production email. Run AI evaluations, performance tests, and the remaining operational acceptance scenarios. Perform observed learning trials and fix blocking confusion.

Phase 4 Deploy and verify

Provision production resources in owner-controlled accounts, configure the domain and HTTPS, apply migrations, deploy matching app and worker versions, and verify the application with fresh test accounts. Conduct the restore and rollback drills. Open public signup only after the launch checklist passes. Deliver the production URL and operational handoff.

Phase 5 Activate paid access if selected

Complete the billing requirements and AC21 before enabling purchases. Validate cost assumptions against real usage. Decide prices and plan limits with the owner. A functioning free public beta can already satisfy the first-release delivery contract.

Phases are implementation order, not permission to declare the earlier prototype finished. The owner has asked for the complete deployed application. The executing agent should continue through all applicable phases and report genuine external dependencies when they arise.

30 Deployment operations and handoff

Deployment requirements

OPS01 MUST Maintain separate local, staging, and production environments with separate credentials and data. Use reproducible migrations, versioned builds, automated checks, and a protected production branch. Preview environments must not expose production content or secrets.

OPS02 MUST Supply infrastructure configuration for the web service, worker, environment variables, health checks, and scheduled maintenance. Store secrets in provider secret settings. Configure connection pooling and resource limits deliberately. Keep the database and application region reasonably close; record the actual region and rationale.

OPS03 MUST Use backward-compatible database changes for routine deployment. Back up before risky migrations. Deploy a release compatible with both currently running and next worker versions. Roll back application code safely; do not blindly reverse a migration that would delete new user data.

OPS04 MUST Configure HTTPS, production callback and email URLs, cookie scope, sender verification, and the share domain. The selected Offscript brand does not establish domain or trademark availability. Domain purchase and final brand clearance remain owner tasks before public promotion.

Monitoring and incident response

Monitor core route availability, authentication failures, save failures and conflicts, AI error rate, first-content latency, queue age, worker heartbeats, import and export failures, storage capacity, and reserved and actual AI spend. Alerts must reach a named operator through a configured channel.

Provide runbooks for AI outage, database outage, worker backlog, invalid credentials, broken deployment, unintended public sharing, escalating cost, and backup restoration. Each runbook names detection, immediate containment, recovery, user communication, and verification. An emergency toggle can pause new AI work and new shares while preserving access to existing private notes.

Required final handoff

Production URL, staging URL, repository, release commit, and deployed service inventory.

README with local setup, environment variable names, test commands, migrations, and deployment steps.

Database schema and RLS policies, object storage rules, queue setup, and retention configuration.

Requirement coverage matrix, acceptance results, real-provider evaluation results, device checks, and accessibility findings.

Verified database and asset restore procedure, rollback instructions, monitoring links, and alert ownership.

Monthly cost model, active limits, provider account ownership, support contact, and outstanding issues with severity.

Admin and ordinary-user walkthroughs, sample notebook, and instructions for rotating credentials.

No passwords or secret values belong in the handoff document or repository. The owner must be able to operate the deployed app without depending on a developer's personal account.

31 Owner inputs decisions and risks

Inputs needed at implementation milestones

Input | Needed by | Default or action

Repository owner and access | Project setup | Owner-controlled private repository initially

Hosting and database accounts | Staging setup | Render and Supabase are proposed

AI provider account and key | Real learning loop | OpenAI adapter proposed; select model through evaluations

Operating budget and ceilings | Shared beta | Owner sets daily and monthly spend limits

Domain and DNS access | Production setup | Choose an available domain for Offscript

Email sender and support inbox | Authentication testing | Configure production SMTP and a monitored contact

Operator and incident channel | Public launch | Name an accountable operator and backup

Policies and launch audience | Public signup | Adult English-language independent learners proposed

Price and payment account | Paid activation only | Free metered beta until explicitly changed

Sample learning material | Experience validation | Founder provides representative notes or lessons



Credentials should be supplied through supported secret mechanisms. The developer should prepare configuration and exact setup instructions before requesting missing values. Do not repeatedly request an input already supplied or block independent work while waiting for a later-stage dependency.

Decisions that remain open

The final domain, logo, detailed typography, model choice, hosting plan, data region, budget, and pricing are open. The preferred initial surfaces are a responsive web app and an optional installable experience. These platform defaults may change if the owner makes a new decision. Advanced handwriting, collaboration, and native apps remain later scope.

Main risks and responses

Risk | Required response

Map becomes another source of clutter | Topic-level nodes, quick questions, collapse and focus

AI mixes independent learning paths | Explicit scope manifests and branch-isolation tests

Merge loses nuance or personal edits | Selection, source links, revision guards, safe undo

Attractive notes are hard to edit | Structured blocks and direct manipulation

Incorrect explanations look authoritative | Source distinctions, evaluations, uncertainty and correction

Usage costs grow unexpectedly | Reservations, quotas, caps, measured per-session cost

Users lose trust after a save failure | Honest save states, local recovery, conflicts and backups

Feature expansion delays deployment | Release gates and an explicit later-work list



Record material product or architecture changes as an ADR with the problem, decision, alternatives, consequences, and affected requirements. Ask the owner about unresolved choices that change scope, ongoing cost, or public commitments. Routine implementation choices can proceed with documented reasoning.

32 Instructions for the implementing agent

Build Offscript according to this PRD as a complete production application. Start by inspecting the repository and any existing instructions, then create an implementation plan mapped to requirement IDs. Preserve the selected name, the visual notebook approach, recursive branches, precise return navigation, and comparison with selective merging.

Implement through durable vertical slices, integrating frontend, server, database, AI, authorization, and tests together. Keep a requirement ledger with Not started, In progress, Implemented, Verified, and Blocked states. Attach evidence before marking a requirement Verified. A missing credential must identify the exact dependent step, while independent implementation continues.

Make ordinary engineering decisions using the defaults in this PRD and record meaningful deviations. Validate current provider APIs, package versions, licensing, and hosting constraints when implementing. Do not copy illustrative schemas or route examples as if they were complete production contracts.

Use real AI and persistent storage in staging and production. Fixture mode is for labeled development and deterministic tests. Do not substitute a static demo, browser-only persistence, a marketing site, or a collection of unconnected screens for the requested application.

Before declaring completion, run all applicable acceptance scenarios, verify the public deployment with fresh accounts, test recovery, and provide the final handoff in Section 30. Report unresolved issues and their practical impact. The final product must be usable by people other than its creator without access to development tools.

33 Source references

Technical references were checked on 15 October 2026. These sources support platform capabilities and constraints; product requirements, limits, success targets, and architectural choices are Offscript design decisions. Recheck current APIs and commercial terms during implementation.

[S1] Obsidian Canvas. Visual notes and connected canvas capabilities. https://obsidian.md/canvas

[S2] W3C Web Content Accessibility Guidelines 2.2. Accessibility target for the interface. https://www.w3.org/TR/WCAG22/

[S3] Tiptap schema documentation. Structured editor content and allowed nodes. https://tiptap.dev/docs/editor/core-concepts/schema

[S4] React Flow documentation. Interactive graph primitives and library licensing. https://reactflow.dev/

[S5] OpenAI Structured model outputs. Schema-constrained output and validation behavior. https://developers.openai.com/api/docs/guides/structured-outputs

[S6] OpenAI Conversation state. Application-managed context and conversation options. https://developers.openai.com/api/docs/guides/conversation-state

[S7] Render Deploy a Next.js App. Full server deployment rather than static export. https://render.com/docs/deploy-nextjs-app

[S8] Render Background Workers. Separate services for asynchronous tasks. https://render.com/docs/background-workers

[S9] Supabase Queues. Durable PostgreSQL queue and visibility-window semantics. https://supabase.com/docs/guides/queues

[S10] Supabase Row Level Security. Database authorization policies. https://supabase.com/docs/guides/database/postgres/row-level-security

[S11] Supabase Storage Access Control. Private file authorization. https://supabase.com/docs/guides/storage/security/access-control

[S12] OpenAI Data controls. Provider storage and retention considerations. https://developers.openai.com/api/docs/guides/your-data

[S13] Supabase Database overview. Database backups exclude Storage API objects. https://supabase.com/docs/guides/database/overview

[S14] MDN Making PWAs installable. Browser and platform differences in installation. https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable

[S15] Stripe Webhooks. Signature verification and event delivery behavior. https://docs.stripe.com/webhooks