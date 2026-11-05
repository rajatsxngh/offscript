# ChatGPT connection implementation plan

**Goal:** Let the user converse in Gallery with ChatGPT or their saved API key.

**Architecture:** Server-only OAuth/token manager; compatible API-key config; explicit provider coordinator; bounded SSE adapter; two-choice dialog. Next Route Handlers, TypeScript, React, Node crypto, Zod and node:test.

**Approved design:** [Connection design](../specs/2026-10-16-chatgpt-connection-design.md).

1. Define client-safe status types (integrator).
2. Implement OAuth, private storage, routes and protocol tests (auth worker).
3. Implement provider selection, settings routes, SSE generation and failure tests (integrator).
4. Implement connection choices, popup status, model selection and active indicator (UI worker).
5. Review boundaries, run typecheck/tests/build; restart Gallery and inspect UI.
6. Let user complete official authorization. Do not claim successful inference without observing it.

## Shared contracts

- GET `/api/ai/settings`: `AISettings`; POST retains `{apiKey,model}`; PATCH `{provider:'chatgpt'|'api-key',model?:string}` selects provider/model.
- POST `/api/ai/chatgpt`: `{authorizationUrl}` with browser-binding cookie. GET: `ChatGPTSignInStatus`. DELETE cancels pending sign-in.
- GET `/api/ai/chatgpt/callback`: one-use callback and safe success/error page; success selects ChatGPT.
- POST `/api/ai/chatgpt/disconnect`: clears ChatGPT tokens, returns `{revoked:boolean}`, no automatic API fallback.
- Auth exports synchronous `getChatGPTSettings()`, async `getChatGPTConnection(signal?) -> {accessToken,model}`, and `setChatGPTModel(model)`.

Review: state/nonce/PKCE, issuer/audience/signature, loopback/origin policy, no secret leakage, refresh races, explicit billing choice, completed-only persistence and isolated tests.
