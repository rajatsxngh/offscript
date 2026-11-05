# Gallery UI decision

**Date:** 5 November 2026

**Status:** Visual direction confirmed by the product owner; usability acceptance pending

Gallery is Offscript’s canonical and sole product UI. Its warm canvas, numbered topic blocks, cobalt conversation card and selected Offset identity are the starting point for improvement. Lumen is retired from active product development; it is no longer an alternative awaiting a visual comparison.

Preserve the existing Git history and both workspaces’ data history. The Gallery and Lumen databases evolved independently after their initial snapshot; selecting Gallery does not authorize deleting or silently merging either database. Historical design and verification records remain evidence of earlier work, not claims about current readiness.

Keep the current Gallery app on port **3001** during consolidation. Its existing browser origin preserves access to browser-local drafts and maintains the current OAuth flow’s origin continuity.

Replace the planned Lumen/Gallery selection study with Gallery usability evaluation covering find → ask → branch → keep → return, accessibility and recovery. The UI decision does not change provider requirements, public-release scope or outstanding live-provider validation.

## Usability feedback — 5 November 2026

The founder reported poor usability and said they did not feel like using the current app themselves. The underlying reasons have not yet been identified, and the founder clarified that specific causes should not be assumed. Gallery remains selected, with acceptance of its current usability pending.

The next priority is to understand the friction through actual use and direct founder feedback, then select and evaluate changes based on that evidence. Follow [PRD acceptance scenarios V2-AC16–18](../PRD-v2.md): observe the core learning loop, record what remains unknown and establish whether the founder feels willing to use the app before further decorative polish. No specific remedy is prescribed. Usability iteration and local validation precede external launch; no successful usability result is claimed yet.
