# Verification record — local workspace

Recorded 15 October 2026. This is a loopback-only, single-learner SQLite milestone. It does not pass the complete public-release requirements or AC01–AC21. Status is tracked in the [requirement register](requirements.md).

## Current AI connection and question-branch iteration

The local interface now has an [OpenAI connection form](../src/components/ai-connection.tsx), [server-side connection settings](../src/server/ai-config.ts), and [atomic question branching](../src/app/api/topics/branch/route.ts). Each node uses its saved discussion and frozen ancestor context. The composer offers **Ask in new node**; an existing user question offers **Explore as new node**. Both create a child and its initial question together, then request an answer when AI is configured. The seeded question is reused by the first request and explicit failed/interrupted retries.

Connection setup validates key/model access with a metadata GET, then saves an owner-readable/writable (`0600`) plaintext `.data/ai-connection.json` file outside Git, notes and exports. No generation is requested by validation, and settings responses do not expose the saved key. The editable default is `gpt-5.4-mini`; local settings take effect without a server restart, with environment configuration as fallback. The form also supports continuing with an existing connection. These are implemented behaviors; live provider success is not inferred from the tests.

| Check | Current status | Observed evidence and limits |
| --- | --- | --- |
| `npm test` | Passed: 38/38 | Existing 24 tests plus seven connection-settings and seven branch/reuse tests |
| `npm run typecheck` | Passed, exit 0 | Separate TypeScript check passed; final build also included TypeScript verification |
| `npm run build` | Passed, exit 0 | Final compilation and TypeScript checks passed, with no dynamic-path warning after runtime-file bundler annotations |
| Local optimized startup | Passed | Optimized application running at `http://127.0.0.1:3000` in explicit local-preview mode |
| `node scripts/smoke-ai.mjs` | Passed, exit 0 | Safe public AI settings, cross-origin 403, empty-key 400, atomic seeded branch/replay, changed-payload 409, promotion and context checks; temporary fixture cleaned up |
| Browser question-to-node flow | Passed at checked size | At 516 × 614, typing a question and choosing **Ask in new node** created a connected child with the question saved |
| Browser reload and promotion | Passed | The child and saved question survived reload; **Explore as new node** created a third node with the correct parent link and seeded question |
| Resulting map | Passed at checked size | Closing the popup and choosing Fit all topics displayed all three connected nodes at 516 × 614 |
| Real credential/model access | Not tested | No actual key has been configured; metadata checks use mocked provider responses in tests |
| Live AI answer | Not tested | No real generation or charge was made as part of this verification |

The [question-node screenshot](screenshots/question-node-preview.png) shows the synthetic browser fixture before promotion. The temporary fixture was removed successfully through the API. Statistics was restored with its five topics, Z-scores was opened, and the empty Connect AI form was left open for the user; see the [connection-form screenshot](screenshots/connect-ai-preview.png). No real API key was entered and no live answer was requested during these checks.

Generation remains non-streaming with bounded inputs and a 60-second timeout. No full accessibility, async-save race UI or release-acceptance result is claimed. Disk exhaustion caused repeated iCloud source-file eviction during local setup. The unused duplicate `.cloud-deps.nosync` dependency tree was removed to recover 429 MB; `.runtime.nosync/node_modules` was retained. After clearing the corrupted generated cache, `.next` now links to `.runtime.nosync/next` to avoid build-cache offloading. No source files were moved. Keep the repository downloaded or use a non-cloud folder.

## Previous map and topic-thread iteration — observed evidence

The user changed the primary presentation to a mind map with clickable topic threads. The [workspace](../src/components/workspace-app.tsx), [map](../src/components/topic-map.tsx) and [thread overlay](../src/components/topic-thread.tsx) keep the pan/zoom map mounted behind continuous topic prose, discussion and a composer. These observations predate the AI connection/question-branch iteration and are not a substitute for its pending checks.

| Check | Current status | Observed evidence and limits |
| --- | --- | --- |
| `npm test` | Passed: 24/24 | Existing server/anchor/math regression suite; it does not exercise the new overlay in a browser |
| `npm run typecheck` | Passed, exit 0 | Separate final TypeScript check completed after the UI changes |
| `npm run build` | Passed, exit 0 | Final optimized build completed, including TypeScript checks |
| Responsive map layout | Passed at checked sizes | CSS viewports 516 × 614 and 1280 × 800: compact two-column map and wide two-sided map were readable |
| Topic and parent navigation | Passed | Z-scores node opened the correct popup; Back to Normal distribution opened its parent thread |
| Close/Escape and map position | Passed | After zooming, closing the thread and Escape preserved the exact `.thought-map-world` transform; rechecked after correcting focus-induced recentering |
| Draft close/reopen recovery | Passed | Separate temporary unsent question, editor Content draft and title draft each survived close/reopen; every QA draft was cleared/canceled and canonical sample content remained unchanged |
| Nested dialog Escape | Passed | Escape closed History only; the underlying thread remained open |
| Browser Back/Forward | Passed for observed sequence | Back restored the thread and Forward restored the map |
| Map hash reload | Passed | Hard reload at `#map` restored the map without opening a popup; the user preview was left on the map |
| Further interaction coverage | Pending | Full WCAG/keyboard audit, async-save race UI scenario, a newly persisted save through this UI, direct thread-link reload and broader device/browser coverage |

Screenshots: [compact map after clean reload](screenshots/map-workspace-preview.jpg), [compact topic thread](screenshots/topic-thread-preview.jpg), [desktop map](screenshots/map-workspace-desktop.jpg), and [desktop topic thread](screenshots/topic-thread-desktop.jpg). The draft checks did not submit a new persisted save or an AI request. Earlier notebook-page checks below remain historical evidence and do not extend this iteration's browser coverage.

## Automated evidence

| Check | Result | Scope of evidence |
| --- | --- | --- |
| `npm run typecheck` | Passed, exit 0 | Separate check passed; the final build also verified TypeScript |
| `npm run build` | Passed, exit 0 | Current AI/branch iteration compiled without the earlier dynamic-path warning |
| `npm test` | Passed: 38 tests, 0 failures | 14 server, 10 learning/anchor/math, seven connection-settings and seven branch tests; isolated storage and mocked provider calls |
| `node scripts/smoke-ai.mjs` | Passed, exit 0 | Live local settings/branch API checks; synthetic fixture removed and no real provider generation |
| Requirement/document integrity | Passed | All 82 MUST IDs and AC01–AC21 retained uniquely; internal documentation links resolved |

The [14 server tests](../tests/server.test.ts) prove local SQLite reopening, immutable revisions and stale-write rejection, idempotent branches, frozen ancestor context without sibling/other-notebook/unsent-draft leakage, immutable kept provenance, 60-level storage, invalid-schema atomic rejection, removable sample seeding, export exclusions, loopback/Origin guards, bounded safe JSON errors, missing-AI configuration, mocked provider request replay and persisted failures.

The [10 learning tests](../tests/learning.test.ts) prove stable-block returns, deleted/edited/ambiguous/overlapping phrase fallbacks, conservative handling when the selected duplicate disappears, topic-level return behavior and deterministic normal-distribution density/probabilities/input validation.

The [seven connection tests](../tests/ai-config.test.ts) cover public status/environment fallback without secret disclosure, metadata-only validation, private atomic persistence, sanitized validation failures preserving the previous connection, invalid-input/timeout handling, malformed-file fallback and local-origin route protection.

The [seven branch tests](../tests/branch.test.ts) cover full-question preservation with a bounded title, idempotent child/message creation, frozen ancestor isolation, exact parent-question promotion validation, rollback after message-write failure, first-answer reuse without a duplicate user message and explicit failed/interrupted retries. Invalid cross-topic or changed-content message bindings are rejected.

Provider tests replace `fetch`; their example text is a test stub. They do not establish working external credentials, provider billing, real model quality or production AI behavior.

## Previous presentation checks — historical evidence

| Check | Status | Evidence and remaining scope |
| --- | --- | --- |
| `npm run build` | Passed | Optimized application build completed; this is not a public deployment |
| Local startup | Passed | Application started at `http://127.0.0.1:3000` for the previous presentation |
| `npm run test:smoke` | Passed | Live API: 12-deep branches, idempotent replay, frozen context, HTTP 409 stale-write rejection, saved history/resume and notes-only exports; temporary fixture cleaned up |
| Desktop core interaction | Passed | Browser: create notebook → save text note → branch from its block → Return to where I was; canonical note and branch remained visible |
| Topic map | Passed for basic navigation | Five canonical sample topics rendered; Fit all topics and clicking the root returned to its notebook page |
| Other desktop interactions | Pending | Search/history/export UI and browser draft/conflict scenarios still need dedicated verification |
| Narrow viewport | Passed for reading layout | At 320 × 740, the notebook heading, reading column and navigation controls fit; document scroll width was 320 px. Full mobile editing and navigation remain unverified |
| Browser accessibility | Pending | Keyboard/focus/labels and selected core flow; this is not a complete WCAG audit |

The [live smoke script](../scripts/smoke.mjs) uses the local server and synthetic temporary data; its 12-level check proves API storage, not 12-level interactive browser navigation. The temporary browser notebook was also removed after testing. The desktop viewport was restored, and the [previous notebook screenshot](screenshots/notebook-desktop.jpg) captures that earlier presentation. No current map/thread browser result, real-provider, authenticated-device, full accessibility or release-acceptance result is inferred from these historical checks.

## Scope limits

- Persistence is on this machine. Accounts, email, PostgreSQL/RLS, another signed-in device and public deployment are not implemented.
- Editor saves are explicit. Recovery uses localStorage, not the PRD's account-isolated IndexedDB/autosave contract. Full rich editing, diagram/image/table support and revision restore are pending.
- New AI answers require a local UI connection or environment API key; the model defaults to `gpt-5.4-mini` and is editable. Real metadata access and generation are unverified. The current non-streaming adapter has a 60-second timeout; durable worker streaming, Stop/reattach, token summaries, usage ledgers and spend ceilings are pending.
- The map is a lightweight parent-topic view. Related links, complete map interaction and large-graph/accessibility performance remain unverified.
- Markdown/JSON export covers local saved notes. Browser printing is a convenience, not the required complete PDF/asset export pipeline.
- Saved follow-up promotion into a child is covered by local store tests, live API checks and browser creation/reload/promotion checks. The full PRD quick-question workflow remains pending. Comparisons/selective merge, imports/citations, public snapshot sharing, trash/account deletion, backups/restore and production operations remain pending.

No release-level requirement is marked Verified. Source/test links on In progress rows document only their implemented local subset.

## Premium interface design pass — 15 October 2026

The shell, map, topic thread, connection form and chat presentation now use warm ivory, graphite and copper, an SF-based sans-serif type stack and a custom open-loop/branch logo. The shell adds a single sidebar navigation scroll region, responsive drawer focus/inert handling, an export disclosure with outside-click/Escape dismissal and a fixed modal header above one scrolling content region. Existing data and AI behavior remain within the local milestone described above.

| Check | Status | Observed evidence and limits |
| --- | --- | --- |
| `npm test` | Passed: 38/38 | Passed during the redesign before the final CSS adjustments; this is not visual or complete accessibility coverage |
| `npm run typecheck` | Passed | Completed during the redesign; final production build also checked TypeScript |
| Production build | Passed, exit 0 | Final build completed after all map-framing, mobile-header, sticky-footer and visibility adjustments; all routes built |
| Restored local startup | Passed | The optimized Next.js 16.4.1 application restarted successfully at `http://127.0.0.1:3000`; Ready reported in 159 ms |
| Default map framing | Passed at 516 × 614 | All five sample nodes fit within the map with margins |
| Search and thread controls | Passed at 516 × 614 | Searching for Z-scores returned the correct result and opened its thread; the composer and branch controls were visible |
| Export Escape | Passed | Escape closed the export disclosure and restored focus to Export |
| Mobile drawer focus and containment | Passed at 390 × 844 | Initial focus landed on Close navigation; the map background was inert; Shift+Tab wrapped to Workspace settings; Escape restored Open navigation |
| Mobile modal actions and return focus | Passed at 390 × 844 | New topic actions were fully visible; Escape returned focus to the New topic trigger |
| Mobile thread and return focus | Passed at 390 × 844 | Title, notes and composer fit; opening focused Close thread, and Escape restored the Z-scores node; document scroll width was 390 px |
| Reading-position recovery | Passed for observed sequence | After scrolling to the top and closing/reopening, the title remained at 122 px; the earlier offset was a saved reading position |
| Desktop map layout | Passed at 1280 × 720 | The screenshot fully showed the sidebar and all five nodes; an earlier 1280 × 800 check inspected DOM layout only |
| Additional thread inspection | Observed at actual 984 × 554 | A subsequent viewport override was affected by user zoom; this is not a 1280-pixel thread screenshot |
| Final screenshots | Captured | Desktop map at 1280 × 720, mobile thread at 390 × 844 and normal preview thread at 516 × 614; links below |

Screenshots: [premium desktop map](screenshots/premium-map-preview.png), [mobile topic thread](screenshots/premium-mobile-thread.png), and [normal preview topic thread](screenshots/premium-thread-preview.png). The viewport was reset and the restored preview was left showing the map.

The preview restart was temporarily blocked by disk exhaustion and iCloud offloading the SQLite database and its WAL/SHM files. After the user freed space, the original files were hydrated successfully. Read-only `PRAGMA quick_check` returned `ok`, with one map and five topics, both before and after moving the data directory to `.runtime.nosync/data` and linking `.data` to it. SHA-256 hashes matched for every file across the move; the original database was preserved, and the `.data` symlink is gitignored. The application then restarted successfully. This resolves the observed local incident without establishing a general backup/restore workflow.

No API key was entered, and no live credential validation or AI generation was performed during this pass. Earlier interaction evidence remains recorded above; full WCAG, broad browser/device coverage and release acceptance remain open.

## Lumen/D interface and node dragging — 15 October 2026

The current interface uses the Lumen/D glass treatment, a docked desktop thread, Conversation as the default tab and a separate Notes tab. Individual node positions can be rearranged on the map. This pass supersedes the earlier visual presentation; the local-storage, provider and release-scope limits above still apply.

| Check | Status | Observed evidence and limits |
| --- | --- | --- |
| `npm test` | Passed: 48/48 | Final run recorded in `/tmp/offscript-lumen-tests.log` |
| `npm run typecheck` | Passed | Current iteration checked successfully |
| Production build | Passed, exit 0 | Final build after the Notes hint change compiled successfully, checked TypeScript and built all routes; browser QA used the preceding functional build on local port 3000 |
| Node dragging | Passed in desktop browser | Moving Z-scores moved its connectors, did not accidentally open its thread, and survived reload |
| Desktop map and thread | Passed | The map remained usable with the docked thread open |
| Conversation and Notes | Passed | Conversation opened by default; switching tabs preserved an unsent composer draft |
| Export and library | Passed | Escape closed Export alone; library focus and new-map creation worked |
| Question-to-node flow | Passed with isolated test map | Ask in new node created a connected child containing the exact user question |
| Notes editing and provenance | Passed with isolated test map | The child's Notes draft survived tab switches and saved; branching from a note created a grandchild, and Back returned to parent Notes and highlighted the original block |
| Mobile layout | Passed at actual 390 × 844 | Map and Export were accessible with no horizontal overflow; the thread opened as a full-screen modal with an inert background |
| Mobile keyboard and focus | Passed at actual 390 × 844 | Library Shift+Tab wrapped and Escape restored the map selector; arrow keys switched to Notes; thread Escape restored the Z-scores node |
| Keyboard node movement | Passed at actual 390 × 844 | Shift+Right moved the node and announced the change; Reset arrangement restored the baseline |

Screenshots: [Lumen desktop workspace](screenshots/lumen-desktop.png) and [Lumen mobile workspace](screenshots/lumen-mobile.png). The temporary test map was removed using an exact ID, title and topic-ID guard; the original Statistics map retains its five nodes. After QA, the Notes connected-ideas hint was clarified to direct the learner to Conversation and Ask in new node; the final build includes that copy change.

No AI key was configured and no live provider call was made; these checks establish local interaction behavior only, not complete accessibility or release acceptance.

## Lumen reference refinement — 16 October 2026

This pass strengthens the blue selection glow, ancestor edges and connection ports; adds a node-to-thread tether; and refines the layered glass conversation, parent header, message cards, formula typography and compact composer. Selection, panel arrival and tether reveal use short animations.

| Check | Status | Observed evidence and limits |
| --- | --- | --- |
| Tests and final build | Passed | `npm test`: 48/48 during this pass, recorded in `/tmp/offscript-lumen-polish-tests.log`; the final production build includes formula-copy, focus and solid tether-stroke fixes, passed TypeScript and built all routes; the production preview restarted successfully |
| Desktop layout | Passed | Checked at 1470 × 900 and actual 1130 × 692 with 130% browser zoom |
| Tether alignment and movement | Passed | Start aligned to the selected node edge within 0.05 px; it followed a 20 px keyboard move and the reverse move, restoring the original position |
| Selected blue treatment | Passed in final browser view | Selected border computed as `rgb(56, 132, 255)` and tether as `rgb(75, 145, 250)`; a solid stroke fixes the horizontal SVG gradient's missing line |
| Topic switching and close focus | Passed | Z-scores → Variance highlighted two ancestor edges and retargeted the tether; closing restored focus to Variance |
| Message cards and branch flow | Passed with labeled sample fixture | User and assistant cards used explicit sample text without an API call; the redesigned footer created a child, and mobile parent return and Followed from here links worked |
| Compact layout | Passed | Actual 390 × 844 and normal 319 × 614 views had no horizontal overflow; the thread background was inert and the tether hidden |
| Reduced motion | Code reviewed | Styles disable the visual motion; the OS/browser preference was not emulated in this pass |
| Canonical formula copy and anchors | Code reviewed | Formula-contained copy writes original text and formula branching uses the canonical quote; actual clipboard behavior was not browser-tested |

The guarded cleanup removed all four temporary fixture nodes; the original Statistics map retains five nodes. Final screenshots: [refined desktop](screenshots/lumen-refined-desktop.jpg) and [refined mobile](screenshots/lumen-refined-mobile.jpg). The desktop capture includes unused surrounding bounds at 130% browser zoom; the application DOM had no horizontal overflow. The mobile capture was refreshed at the normal 319 × 614 viewport after reset. AI remains unconfigured, with no live provider generation claimed. Full accessibility and broader release acceptance remain open.

## Draggable chat panel — 16 October 2026

The desktop chat can now detach from its right-hand dock, retain a per-map position and remain connected to the selected node. The current Statistics map contains six user topics, including “hey”; no topics or messages were created or deleted during this pass.

| Check | Status | Observed evidence and limits |
| --- | --- | --- |
| Unit tests | Passed: 64/64 | `/tmp/offscript-draggable-chat-tests.log`; includes stored-position validation, viewport clamping and tether geometry in four directions, clipping and overlap |
| Final production build | Passed | Includes floating-surface opacity, print layout and docking focus fixes; TypeScript and all routes built; preview restarted on port 3000 |
| Mouse dragging | Passed | At actual 837 × 614, dragging the header moved the panel by −270/+22 px; subsequent dragging moved it to the left viewport limit; later final-build mouse dragging also passed |
| Persistence and draft continuity | Passed | Panel coordinates and an unsent test draft survived dragging and reload; the original empty draft was restored without sending |
| Docking and keyboard | Passed | Dock button returned the panel to the right; Shift+Left moved it 20 px; keyboard activation of Dock retained focus on the drag handle in the final build |
| Topic switch and tether routing | Passed | Z-scores → Variance retained panel coordinates and retargeted the line from the panel's right edge to the node's left edge |
| Responsive layout | Passed | At actual 300 × 649 and 516 × 614, chat used the modal layout with an inert background; 300 px document width had no horizontal overflow; returning to desktop restored the floating position |
| Review | Passed for targeted scope | Pointer capture/cancellation, map changes, reduced-motion handling, resize behavior and observer cleanup reviewed; this is not a complete accessibility audit |

The [draggable chat screenshot](screenshots/draggable-chat.jpg) shows the floating panel and its connection to Variance at an actual 984 × 615 viewport. The browser's 130% zoom leaves unused surrounding screenshot bounds. The viewport override was reset after QA. No API credentials were entered and no live AI generation was performed.

## Offset logo identity — 16 October 2026

Applied the user's selected concept C as shared SVG artwork in the header, library, loading state, settings emblem and assistant avatar, with matching standalone assets and browser icon. Production build and TypeScript passed. Browser checks at actual 837 × 614 confirmed the full header lockup, library wordmark, two-piece blue settings emblem and updated icon metadata. At actual 300 × 649, the header used the symbol alone without horizontal overflow or overlap with the map selector; the library retained the full wordmark. The viewport was reset afterward. No data changed and no new behavior tests were needed for this presentation-only change. [Desktop proof](screenshots/offset-brand-desktop.jpg).
