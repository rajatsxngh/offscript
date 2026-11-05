# Gallery: ChatGPT and API connections

The user approved connecting their ChatGPT account in Gallery while keeping the existing API-key option. This change is confined to `codex/gallery-ui`.

Tutor settings offers ChatGPT and OpenAI API. Each retains its credentials separately. One explicit active provider determines new requests, preserving node history and branching. No automatic paid fallback. ChatGPT authorization opens a separate window so the canvas and pending question survive. The user completes OpenAI login and permission approval.

Use documented public local-client OAuth. Persist an opaque host ID and issued registration. Use PKCE, nonce, expiring one-use state and a browser-bound HttpOnly SameSite=Lax cookie. Callback: `http://127.0.0.1:<port>/api/ai/chatgpt/callback`. Validate signed ID tokens via OpenAI discovery/JWKS. Store tokens in bounded private server files excluded from Git/exports. Serialize refresh and atomically replace rotated tokens. Revoke on disconnect where possible.

Keep API-key persistence compatible. A settings coordinator owns active-provider choice and public status. ChatGPT exposes its account-specific model catalog. Normal API origin checks remain strict; only the OAuth callback accepts cross-site navigation after loopback and transaction verification.

The tutor endpoint returns a completed JSON answer. Internally consume required Responses SSE until `response.completed`. Preserve idempotency, topic context, cancellation and failed-question recovery.

Test callback rejection/replay/expiry, identity checks, secret-free status, refresh/storage, explicit provider choice, API compatibility and streaming failures. Run typecheck, tests, build and local UI inspection. Live connection needs the user's authorization.

Sources checked 2026-10-16: OpenAI's official SIWC registration, sessions, inference, preview-limitations and UI/UX guides at https://developers.openai.com/siwc/token-sharing-open-source; installed Next 16.4.1 Route Handlers/cookies docs.
