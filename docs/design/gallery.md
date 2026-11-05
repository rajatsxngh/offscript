# Offscript Gallery

Gallery is the sole product UI, confirmed on 5 November 2026. Its selection does not establish usability acceptance: the product owner reports poor usability and reluctance to use the current app, with the reasons still unknown. See [the decision record](decision-gallery.md). This concept began as an alternate branch for comparison with Lumen. The approved visual reference is [gallery-reference.png](gallery-reference.png).

## Experience

An open, warm-white canvas presents ideas as numbered editorial blocks. Large dark titles, gray summaries and fine directional connectors replace Lumen's glass cards. The root's chart is part of its canvas block. Edges use the actual saved branch excerpt when available, otherwise a neutral “Explore further” label; they do not invent semantic relationships.

Automatic framing keeps text readable at a minimum 64% zoom. Fit explicitly shows the whole map, and manual navigation takes priority over automatic framing. Labels that would collide with a topic are hidden.

The selected topic opens a cobalt conversation card in the lower center-right of the canvas. It keeps the map interactive, can be dragged, and remains tethered to the selected topic. Chat stays in screen coordinates so text and controls remain readable during map zoom. The card can be reset to its starting position. Compact screens use the existing full-screen modal.

The Offset logo remains the identity. The header adds the Gallery label, map title and idea count, search and a prominent New thought action. Conversation, Notes, AI configuration, branching, editing, exports, keyboard access and stored drafts continue using their existing handlers.

## Historical comparison setup (retired)

- Lumen: `main`, original checkout, `http://127.0.0.1:3000`.
- Gallery: `codex/gallery-ui`, managed worktree, `http://127.0.0.1:3001`.
- Gallery starts with a consistent SQLite backup of Lumen's six topics. The database and browser storage are independent. Later edits are not synchronized.
- No credentials were copied. Connect AI separately in Gallery if needed.
- The baseline Lumen commit is `7070cbb`; the original checkout and preview are preserved.

The setup above describes the earlier evaluation only. The main checkout at `/Users/rajatsingh/Documents/ChatGPT/offscript` now contains Gallery and uses port 3001. Run `OFFSCRIPT_LOCAL_PREVIEW=1 npm start` there after building. The former Gallery worktree remains as a historical copy; its data and connection files were safely migrated to the main checkout, which owns active writes. It is not a separate UI direction. Lumen is no longer an active preview.

## Historical implementation checks

- [x] Preserve and branch the current app; copy data using SQLite backup.
- [x] Replace map presentation and layout while retaining interaction handlers.
- [x] Add Gallery shell and cobalt conversation styling.
- [x] Run the integrated production build and test suite.
- [x] Verify desktop/mobile navigation, dragging, drafts and branching in the browser.
- [x] During comparison, leave both previews runnable and document comparison instructions. This phase ended with the Gallery selection on 5 November 2026.

See the [verification record](../verification.md) and [desktop screenshot](../screenshots/gallery-desktop.jpg).
