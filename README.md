# Offscript — Gallery comparison branch

This checkout is the alternate **Gallery** interface on `codex/gallery-ui`. Its local preview runs at **http://127.0.0.1:3001**. The original Lumen checkout remains on `main` at **http://127.0.0.1:3000**.

The variants have separate databases and browser drafts. Gallery starts with a snapshot of the existing maps; later changes are not synchronized. No AI credentials were copied. See [Gallery design and comparison notes](docs/design/gallery.md).

Start Gallery with `OFFSCRIPT_LOCAL_PREVIEW=1 npm run start` after `npm run build`, or use `npm run dev`. Both commands use port 3001 in this branch.

Follow your curiosity. Keep your place.

Offscript is a visual learning workspace with connected topics, nested discussions, editable explanations, and a path back to the passage where a question began. This repository starts the implementation described in [the PRD](docs/PRD.md); the original [Word document](docs/Offscript_PRD.docx) is preserved.

## Current milestone

This is a **local development application**, with a working interface and server-side SQLite persistence. It is not a publicly deployed product, and it has no account authentication. The server only accepts loopback hostnames. Production-mode API access is disabled unless explicitly opted into a local preview. Do not expose this milestone through a tunnel or public host.

The primary workspace is now a persistent mind map with pan and zoom. Click a node to open its topic thread over the map: saved explanations, discussion and a question composer share one continuous surface. Close the thread or press Escape to return to the map; thread drafts and reading positions are retained. Hash routes distinguish maps from open threads. This replaces the earlier notebook-page presentation in response to the user's updated direction.

The local slice also includes a removable statistics example, editable structured insights, nested topics with origin snapshots, return navigation, a synchronized outline, self-reported learning statuses, search, revision history, JSON and Markdown export, and an AI adapter that makes real provider requests only when configured. A sample is clearly labeled; it is not a generated response.

Each node has its own saved conversation and frozen ancestor context. Choose **Ask in new node** in the composer, or **Explore as new node** on an existing user question, to create a connected child with that question already saved. When AI is configured, the child immediately requests its first answer; otherwise, the question remains available after connecting. Branch creation is atomic and replay-safe, and the first answer reuses the saved question.

The test suite and optimized production build pass. Gallery browser checks cover responsive layouts, draggable nodes and chat, keyboard movement, saved drafts, search, Notes, and question-to-node branching in an isolated test workspace. No real API key or live AI answer has been verified. See [the verification record](docs/verification.md) for exact evidence and remaining limits.

## Run locally

Use Node **22.23.2** (the built-in SQLite adapter requires Node 22.13 or later).

```sh
nvm use
npm ci --ignore-scripts
cp .env.example .env.local
npm run dev
```

The original Lumen checkout uses macOS/iCloud workarounds: its dependencies and build cache link into `.runtime.nosync`. This managed Gallery worktree has independent dependency and build directories outside the iCloud-backed Documents folder. These workarounds are not required for a normal clone.

Open [Offscript Gallery at localhost](http://127.0.0.1:3001). Notes are stored in this worktree's `.data/offscript.sqlite`, outside Git. Keep that file to preserve local data. SQLite journals may also exist beside it while the app runs. A browser refresh does not reset notes. Deleting browser data does not delete server notes; deleting `.data` does. There is no automatic backup or multi-device synchronization yet.

To preview an optimized build on the same machine:

```sh
npm run build
OFFSCRIPT_LOCAL_PREVIEW=1 npm start
```

### Optional real AI

Click **Connect AI** in the sidebar. Enter an OpenAI API key and choose a model available to that key. The editable default is `gpt-5.4-mini`. Offscript checks key/model access with a model-metadata GET before saving; this check does not request a billed generation. A configured connection can also be reused with **Continue with this connection**. Successful UI changes take effect without restarting the server.

The key and model are stored server-side in `.data/ai-connection.json`, outside Git, notes and exports. The file is written with owner-only permissions (`0600`); it is a local plaintext credential file, not an encrypted vault. The saved key is never returned in settings responses. Preserve this file only on a machine you trust.

Environment configuration is still supported as a fallback when no valid local connection exists. Set these variables in `.env.local` and restart the server after changing them:

```dotenv
OPENAI_API_KEY=your-secret-key
OPENAI_MODEL=gpt-5.4-mini
```

`OPENAI_MODEL` is optional and defaults to `gpt-5.4-mini`; choose another model if needed. Never commit credentials. Neither variable uses the `NEXT_PUBLIC_` prefix. The adapter uses the OpenAI Responses API with `store: false` and application-managed context. The selected topic's notes, local discussion, and inherited fork snapshot are sent to the provider. Unrelated topics are excluded. `store: false` is not a claim of zero provider retention.

Without a configured connection, reading, editing, branching, history and export still work; the UI offers connection setup for generation. There are no fallback canned AI answers. Real generations incur provider charges. The current adapter is non-streaming, with bounded request sizes and a 60-second generation timeout. Model-access validation does not prove successful generation or teaching quality; no live provider answer has been verified in this iteration. Production quota accounting and spending limits remain required before a shared launch.

## Validate

```sh
npm run typecheck
npm test
npm run build
```

With the local server running, use a second terminal to check the live API:

```sh
npm run test:smoke
node scripts/smoke-ai.mjs
```

The smoke check creates and removes a temporary notebook, exercises 12 nested branches, request replay, frozen context, revision conflicts, history/resume and notes-only exports. It defaults to `http://127.0.0.1:3000`; `OFFSCRIPT_TEST_URL` can select another loopback URL. It does not call the AI provider.

The AI/branch smoke check verifies public connection status, invalid-key and cross-origin rejection, seeded question branches, idempotent replay/conflicts, question promotion and inherited context. Its temporary fixture is removed; it does not submit a real key or request generation.

Tests use isolated temporary SQLite files and synthetic data. They do not send provider requests. The GitHub workflow runs the same static, unit, and build checks. Passing these checks does not establish production authentication, real-provider teaching quality, or the PRD's staging acceptance scenarios.

See [the verification record](docs/verification.md) for observed results and outstanding checks.

## Project structure

```text
src/app/          Next.js entry points and API routes
src/components/   Mind map, topic-thread overlay and interactive surfaces
src/lib/          Shared contracts, anchor matching, chart calculations
src/server/       Database, validation, API safeguards, provider adapter
tests/            Deterministic domain and database tests
docs/             PRD, decisions, implementation plan, requirement register
```

The UI and API share [a typed contract](src/lib/types.ts). The canonical topic records power the map, outline and topic threads. The existing API/storage name `notebook` still identifies a collection displayed as a map; this UI iteration does not migrate saved data. An immutable note revision is created on each acknowledged update. Conflicts return an error instead of overwriting a newer revision. Creating a branch captures parent context independently of AI generation.

## Next milestones

See [the implementation plan](docs/implementation-plan.md), [architecture decisions](docs/architecture.md), and [requirement register](docs/requirements.md).

The next infrastructure step is owner-controlled Supabase/PostgreSQL with email authentication and tested row-level access policies, followed by a durable generation worker and resumable streaming. Rich editing, the complete quick-question workflow, compare and merge, source imports, full exports and snapshot sharing remain release work. Saved follow-up promotion into a child node is implemented locally. Public deployment also requires owner-selected hosting, provider budget, domain, SMTP sender, support contact, monitoring, and recovery tests. No accounts, paid resources, or public site have been provisioned by this local milestone.

Current local simplifications include a structured block editor instead of Tiptap, a lightweight topic map instead of React Flow, and local SQLite instead of hosted PostgreSQL. Notebook deletion is permanent in this milestone; the UI asks for confirmation. The PRD's recoverable trash, complete offline recovery, multi-device conflict workflow, theme support, and full accessibility/browser matrix remain open.

## API references

The implementation follows [Next.js route handlers](https://nextjs.org/docs/app/getting-started/route-handlers) and the [OpenAI Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create). Provider configuration and teaching quality still need validation with the owner's selected model.
