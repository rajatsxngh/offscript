# Offscript implementation plan

Source: [PRD](PRD.md). Decisions: [architecture](architecture.md). Status and evidence: [requirement register](requirements.md). Initial planning baseline: 15 October 2026.

## Milestone 0 — Local learning-loop foundation (current scope)

Deliver a Next.js 16 / React 19 TypeScript app that runs only on loopback. Use canonical server SQLite data with immutable page revisions and expected-revision writes. Browser state is recovery/presentation only. No fake account boundary, cloud persistence claim or public deployment is included.

| Work package | Requirement contribution | Proof to collect |
| --- | --- | --- |
| Reproducible workspace, validated shared types, env example and local-only mode gate | NOTE02, SEC02/SEC03, OPS01 foundations | Typecheck, test suite, production build, clean startup and local-only guard checks |
| Warm paper/green note workspace, responsive navigation and labeled removable Statistics example | NB02/NB04, NOTE01/NOTE07, §7–8 foundations | Browser walkthrough of narrow/wide layouts and deterministic chart parameters |
| SQLite notebook/topic CRUD and versioned pages | NB01/NB03, NOTE02/NOTE05/NOTE06, REL02 foundations | Reload/restart persistence; stale revision rejection; immutable history and independent notebook data |
| Deep anchored child creation, inherited context and return/draft recovery | BR01–BR04/BR06/BR07, AI03/AI05 foundations | 50-level stored ancestry; cycle/wrong-notebook rejection; nested return, changed/missing anchor fallback and sibling isolation |
| Editable kept explanation with source provenance | NOTE03/NOTE04 foundations | Keep preview/application/wording edits retain source; no automatic page overwrite |
| Real optional non-streaming Responses adapter | AI01/AI03/AI05 foundations | Configuration/error handling and mocked contract tests; real call remains unverified until keys/model are configured |
| Canonical tree/lightweight map, local search/history and Markdown/JSON export | MAP01/MAP03/MAP06, FIND01/FIND02, NOTE06, EXPORT01 foundations | Navigation consistency; no AI call on view change; exported scope and parsed JSON |

Do not expand this milestone's claims to full PRD completion. SQLite is local server persistence, not authenticated multi-device or redeployment persistence. A small block editor is not the complete rich editor. Non-streaming generation is not a durable resumable worker. Local search/exports do not establish tenant isolation or production job delivery. PDF, imports, comparison/merge, quick-question promotion and public shares must stay unclaimed until implemented.

Use `npm run typecheck`, `npm test` and `npm run build` (or the combined `npm run check`) for repository verification. Record actual output and browser observations after implementation; this plan is not test evidence.

## Milestone 1 — Durable authenticated learning loop

Move canonical storage to PostgreSQL/Supabase, implement verified email authentication and owner paths, add RLS/private-storage policies and verify every implemented route with two independent users. Retain modular domain validation and immutable revision semantics. Prepare migrations and controlled seeding; do not migrate sample data into a real user's private history implicitly.

Implement full anchors (stable block/message/surface, origin revision, quote/prefix/suffix, offsets and preserved excerpt), durable account-isolated IndexedDB drafts, acknowledged cross-device resume and explicit conflict recovery. Complete quick questions and atomic no-charge promotion. Finish required Phase 1 content editing and provenance behavior.

Introduce provider run records before any request, immutable full context manifests, checkpoints/events, a durable queue/worker, leases, reattachment and Stop/cancellation. Persist partial/interrupted outcomes without automatic duplicate generation. Reserve cost/action allowance before real calls and settle actual usage. Ensure missing production config fails closed.

**Exit gate:** AC01–AC06 in staging using real provider calls and real email, including second-device and tenant-isolation checks. Add AC12/AC13 coverage for the new lifecycle and conflict surfaces. No fixture can substitute for this gate.

## Milestone 2 — Connected product workflow

Complete rich block editing (including images, captions, formulas, tables, diagrams, alt text and deterministic chart vocabulary) and revision change previews. Complete map interaction, related links, layout persistence and large-graph/outline behavior while retaining canonical topics and view-only layout semantics.

Add two/three-topic comparisons with frozen revisions, editable criteria, citation membership and stale-result indication. Add exact-change merge previews, expected-revision/idempotent atomic commits with provenance, and inverse-change undo that preserves later edits. Existing child context remains frozen until explicitly refreshed.

Add privately stored source uploads, durable extraction, scanned/corrupt/encrypted PDF recovery, editable outline proposals and source-located citations. Complete authenticated search, recent/revisit behavior, PDF/Markdown/JSON export jobs and immutable selected-note snapshot shares with hashed tokens, short-lived assets, reports and rapid revocation.

**Exit gate:** AC07–AC15, including real user-created content, direct tenant tests, source attribution, repeat-request safety and every supported export format.

## Milestone 3 — Public-release hardening

Complete configured quota/usage pages, global spending ceilings, reservation reconciliation, AI pause and cost modeling from measured actual usage. Add logs and analytics without private text, error/latency/queue/cost monitoring and named alert ownership.

Complete recoverable trash, account/source deletion, session/share revocation, storage cleanup, retention and restore tombstones. Back up database and files separately; test an isolated restore. Exercise worker crashes, provider failure, stale secrets and unhealthy deployments. Prepare operator runbooks and recovery copies for unsynced sign-out.

Complete WCAG 2.2 AA checks and keyboard/screen-reader/mobile flow, responsive 320px layouts, browser/device coverage, load tests and 500/1,000-topic map fixtures. Run the versioned 40-task AI evaluation and observed learner trials, fixing core confusion and critical factual/citation/privacy issues.

**Exit gate:** AC16–AC19 plus all applicable prior scenarios; documented performance/AI/accessibility/learner evidence; no acknowledged-note loss, incorrect sharing boundary or unresolved critical/high security issue.

## Milestone 4 — Owner-controlled deployment and handoff

Prepare concrete staging/production service manifests, migration/deploy/rollback commands, provider variable names, sender/domain configuration and operational inventory. Request only the owner inputs required for the next external step after the local result and setup instructions are reviewable.

Provision only within authorized owner accounts and approved spending limits. Deploy matching app/worker releases, configure HTTPS/email/auth callbacks and run fresh-user production checks. Conduct restore and rollback drills and verify alerts reach the named operator. Open public signup only after the complete launch checklist passes.

**Exit gate:** AC20 and the complete PRD §30 handoff: URLs, repository/release, service inventory, environment/migration/test/deployment instructions, schema/policies, acceptance/evaluation evidence, backups/rollback/monitoring, costs/limits, support/operator contacts and walkthroughs. No secret values belong in docs.

## Milestone 5 — Paid activation (conditional)

Keep billing disabled until explicitly selected. Implement hosted checkout/customer portal, authenticated identity mapping, signed idempotent webhooks, entitlement reconciliation, failures/cancellation/downgrade and preserved reading/export. Price/tax/refund/grace-period decisions require owner input. Complete AC21 and the authorized live-payment check before purchases are enabled.

## Verification order

1. Domain/unit: schema, anchors, cycles/depth, frozen context, idempotency, deterministic plotting, revision guards and inverse patches.
2. Local/database integration: immutable commits, repeat requests, ownership/RLS, jobs/leases, usage, deletion and storage/share boundaries as each is added.
3. Browser journeys: edit → branch → nested return → keep → refresh; then comparison/merge/import/export/share and conflict/recovery.
4. Staging real-provider/email: no canned answers, actual context manifests, stream/stop/reconnect, costs and supported imports.
5. Production readiness: full acceptance suite, evaluations, device/accessibility/load checks, fresh-user deployment, alert delivery and isolated recovery.

Do not mark a full numbered requirement Verified when only its happy path or local subset passes. Attach concrete code/tests/evaluation links in the register and describe remaining clauses.

## Inputs needed later

| Input | Earliest dependent work | Independent preparation now |
| --- | --- | --- |
| Owner repository/hosting/database access | Shared staging and production provisioning | Local source, migration plan and service manifest |
| Real AI key and chosen model | Real generation/evaluation | Adapter, configuration checks, safe failures and fixtures for tests only |
| Approved daily/monthly budgets | Shared beta generation | Server reservation/limit design and cost measurement tooling |
| Sender/support inbox and operator/channel | Real auth and alert validation | Email templates, callback/env checklist and runbooks |
| Domain/DNS and policies/audience | Public launch | Deployable application, HTTPS/cookie/callback requirements and accurate policy drafts |
| Payment account/pricing | Optional paid activation | Keep billing disabled; preserve entitlement seams |

The supplied document describes desired product behavior, not approval to purchase services, publish the app, send messages or activate billing. Continue local implementation and configuration preparation while external prerequisites remain pending.
