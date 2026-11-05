import { createHash, createPublicKey, randomBytes, randomUUID, timingSafeEqual, verify, type JsonWebKey } from 'node:crypto';
import { closeSync, constants, fstatSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import type { ChatGPTSettings, ChatGPTSignInStatus, ChatGPTModel } from '../lib/ai-settings';
import { AppError, assert } from './errors';
import { assertLocalRequest } from './http';

const ISSUER = 'https://auth.openai.com';
const AUTHORIZE = `${ISSUER}/api/accounts/authorize`;
const TOKEN = `${ISSUER}/api/accounts/oauth/token`;
const DISCOVERY = `${ISSUER}/.well-known/openid-configuration`;
const JWKS = `${ISSUER}/.well-known/jwks.json`;
const RESOURCE = 'https://api.openai.com/v1';
const CALLBACK = '/api/ai/chatgpt/callback';
const COOKIE = 'offscript_chatgpt_flow';
const SCOPE = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const DIRECT_SCOPE = 'chatgpt.tokens.use.direct';
const ATTEMPT_MS = 10 * 60_000;
const modelSchema = z.object({ id: z.string().min(1).max(160), name: z.string().min(1).max(200) });
const credentialSchema = z.object({
  accessToken: z.string().min(1).max(32_768), refreshToken: z.string().min(1).max(32_768).optional(),
  idToken: z.string().min(1).max(32_768), expiresAt: z.number().finite(), scopes: z.array(z.string().max(200)).max(100),
});
const registrationSchema = z.object({
  clientId: z.string().regex(/^oaiapp_[A-Za-z0-9_-]+$/).max(200),
  issuer: z.literal(ISSUER).optional(), subject: z.string().min(1).max(500).optional(), email: z.string().max(320).optional(),
});
const storeSchema = z.object({
  version: z.literal(1), hostId: z.string().regex(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  generation: z.string().uuid(), registration: registrationSchema.optional(), credentials: credentialSchema.optional(),
  model: z.string().max(160), models: z.array(modelSchema).max(500), needsReauth: z.boolean(),
});
type Store = z.infer<typeof storeSchema>;
type Credentials = z.infer<typeof credentialSchema>;
type Attempt = {
  path: string; cookie: string; state: string; nonce: string; verifier: string; redirectUri: string;
  expiresAt: number; generation: string; clientId?: string; consumed: boolean;
  status: ChatGPTSignInStatus;
};
type Runtime = { attempts: Map<string, Attempt>; refreshes: Map<string, Promise<void>>; disconnects: Map<string, Set<AbortController>> };
// Next's route bundles and development reloads must share in-flight transactions.
const runtimeGlobal = globalThis as typeof globalThis & { __offscriptChatGPT?: Runtime };
const runtime = runtimeGlobal.__offscriptChatGPT ??= { attempts: new Map(), refreshes: new Map(), disconnects: new Map() };
runtime.disconnects ??= new Map();

function stopSessionRequests(path: string) {
  const controllers = runtime.disconnects.get(path);
  runtime.disconnects.delete(path);
  for (const controller of controllers || []) controller.abort();
}
/** Cancels only requests using this local ChatGPT session, never API-key requests. */
export function watchChatGPTDisconnect(controller: AbortController): () => void {
  const path = pathForStore();
  let controllers = runtime.disconnects.get(path);
  if (!controllers) { controllers = new Set(); runtime.disconnects.set(path, controllers); }
  controllers.add(controller);
  return () => {
    controllers.delete(controller);
    if (controllers.size === 0 && runtime.disconnects.get(path) === controllers) runtime.disconnects.delete(path);
  };
}

function pathForStore() {
  return resolve(/* turbopackIgnore: true */ process.env.OFFSCRIPT_CHATGPT_CONFIG_PATH ||
    (process.env.OFFSCRIPT_AI_CONFIG_PATH ? resolve(dirname(process.env.OFFSCRIPT_AI_CONFIG_PATH), 'chatgpt-connection.json') : '.data/chatgpt-connection.json'));
}
function readStore(path = pathForStore()): Store | null {
  let file: number | undefined;
  try {
    file = openSync(/* turbopackIgnore: true */ path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = fstatSync(file);
    if (!info.isFile() || info.size > 262_144) return null;
    const parsed = storeSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
  finally { if (file !== undefined) closeSync(file); }
}
function saveStore(path: string, store: Store) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  let file: number | undefined;
  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    file = openSync(temporary, 'wx', 0o600);
    writeFileSync(file, JSON.stringify(store), 'utf8');
    fsyncSync(file); closeSync(file); file = undefined;
    renameSync(temporary, path);
  } catch { throw new AppError(500, 'CHATGPT_STORAGE_FAILED', 'Offscript could not save the ChatGPT connection on this computer. Check local storage permissions and try again.'); }
  finally {
    if (file !== undefined) closeSync(file);
    try { unlinkSync(temporary); } catch { /* Atomic rename already removed the temporary file. */ }
  }
}
function getOrCreateStore(path: string): Store {
  const existing = readStore(path);
  if (existing) return existing;
  const store: Store = { version: 1, hostId: `urn:uuid:${randomUUID()}`, generation: randomUUID(), model: '', models: [], needsReauth: false };
  saveStore(path, store);
  return store;
}
function authError() { return new AppError(400, 'CHATGPT_AUTH_INVALID', 'This sign-in attempt is invalid or has expired. Return to Offscript and start again.'); }
function identityError() { return new AppError(400, 'CHATGPT_IDENTITY_INVALID', 'Offscript could not verify this ChatGPT identity. Start sign-in again.'); }
function notConnected() { return new AppError(409, 'CHATGPT_NOT_CONNECTED', 'Connect your ChatGPT account before using its plan.'); }
function randomValue() { return randomBytes(32).toString('base64url'); }
function equal(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function cookieValue(request: Request) {
  const matches = (request.headers.get('cookie') || '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${COOKIE}=`));
  if (matches.length !== 1) return '';
  const value = matches[0].slice(COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
}
function pruneAttempts() {
  for (const [key, attempt] of runtime.attempts) if (attempt.expiresAt <= Date.now()) runtime.attempts.delete(key);
}
function boundAttempt(request: Request) {
  const attempt = runtime.attempts.get(cookieValue(request));
  return attempt?.path === pathForStore() ? attempt : undefined;
}
function canonicalOrigin(request: Request, callback = false) {
  if (process.env.NODE_ENV === 'production' && process.env.OFFSCRIPT_LOCAL_PREVIEW !== '1') throw authError();
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;
  const authority = new URL(`http://${host}`);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) || authority.hostname !== '127.0.0.1' ||
    authority.port !== url.port || authority.username || authority.password || authority.pathname !== '/' || authority.search || authority.hash) {
    if (callback) throw authError();
    throw new AppError(400, 'CHATGPT_CANONICAL_ORIGIN', 'Open Offscript at http://127.0.0.1:3001 to connect your ChatGPT account.');
  }
  return authority.origin;
}

export function startChatGPTSignIn(request: Request): { authorizationUrl: string; cookie: string } {
  assertLocalRequest(request);
  assert(request.method === 'POST', 'CHATGPT_AUTH_INVALID', 'Start sign-in from Offscript settings.');
  const origin = canonicalOrigin(request);
  const path = pathForStore(); const store = getOrCreateStore(path);
  pruneAttempts();
  const prior = boundAttempt(request);
  if (prior) runtime.attempts.delete(prior.cookie);
  if (runtime.attempts.size >= 128) throw new AppError(429, 'CHATGPT_AUTH_BUSY', 'Too many sign-in attempts are pending. Try again in a few minutes.');
  const attempt: Attempt = { path, cookie: randomValue(), state: randomValue(), nonce: randomValue(), verifier: randomValue(), redirectUri: `${origin}${CALLBACK}`, expiresAt: Date.now() + ATTEMPT_MS, generation: store.generation, clientId: store.registration?.clientId, consumed: false, status: { status: 'pending' } };
  const url = new URL(AUTHORIZE);
  url.search = new URLSearchParams({ client_id: attempt.clientId || 'dynamic_agent_client', ext_agent_host_id: store.hostId, response_type: 'code', redirect_uri: attempt.redirectUri, scope: SCOPE, resource: RESOURCE, state: attempt.state, nonce: attempt.nonce, code_challenge_method: 'S256', code_challenge: createHash('sha256').update(attempt.verifier).digest('base64url') }).toString();
  if (!attempt.clientId) url.searchParams.set('agent_name_hint', 'Offscript');
  else {
    if (store.credentials?.idToken) url.searchParams.set('id_token_hint', store.credentials.idToken);
    if (store.registration?.email) url.searchParams.set('login_hint', store.registration.email);
    // This is an explicit user action to enable the previously declined permission.
    if (store.credentials && !store.credentials.scopes.includes(DIRECT_SCOPE)) url.searchParams.set('prompt', 'consent');
  }
  runtime.attempts.set(attempt.cookie, attempt);
  return { authorizationUrl: url.href, cookie: `${COOKIE}=${attempt.cookie}; Path=/api/ai/chatgpt; HttpOnly; SameSite=Lax; Max-Age=600` };
}

export function getChatGPTSignInStatus(request: Request): ChatGPTSignInStatus {
  const attempt = boundAttempt(request);
  if (!attempt) return { status: 'idle' };
  if (attempt.expiresAt <= Date.now()) return { status: 'error', error: { message: 'Sign-in expired. Start again from Offscript settings.' } };
  return attempt.status;
}
export function cancelChatGPTSignIn(request: Request) {
  const attempt = boundAttempt(request);
  if (attempt) runtime.attempts.delete(attempt.cookie);
  return { status: 'idle' } as ChatGPTSignInStatus;
}

async function readProviderJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('Empty provider response');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 1_048_576) { await reader.cancel(); throw new Error('Provider response too large'); }
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { reader.releaseLock(); }
}
async function fetchProvider(url: string, init: RequestInit = {}, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(20_000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try { return await fetch(url, { ...init, signal: combined, cache: 'no-store', redirect: 'error' }); }
  catch {
    if (combined.aborted) throw new AppError(408, 'CHATGPT_CONNECTION_TIMEOUT', 'The ChatGPT connection timed out or was stopped. Try again.', true);
    throw new AppError(502, 'CHATGPT_CONNECTION_FAILED', 'ChatGPT could not be reached. Check your connection and try again.', true);
  }
}
const metadataSchema = z.object({ issuer: z.literal(ISSUER), authorization_endpoint: z.literal(AUTHORIZE), token_endpoint: z.literal(TOKEN), jwks_uri: z.literal(JWKS), revocation_endpoint: z.string().url().optional() });
async function metadata(signal?: AbortSignal) {
  const response = await fetchProvider(DISCOVERY, {}, signal);
  if (!response.ok) { await response.body?.cancel(); throw new AppError(502, 'CHATGPT_CONNECTION_FAILED', 'ChatGPT sign-in information is temporarily unavailable. Try again.', true); }
  const parsed = metadataSchema.safeParse(await readProviderJson(response));
  if (!parsed.success) throw identityError();
  return parsed.data;
}
const terminalRefreshErrors = new Set(['invalid_grant', 'invalid_refresh_token', 'token_expired', 'refresh_token_expired', 'refresh_token_invalidated', 'refresh_token_reused']);
const tokenSchema = z.object({ access_token: z.string().min(1).max(32_768), refresh_token: z.string().min(1).max(32_768).optional(), id_token: z.string().min(1).max(32_768).optional(), token_type: z.string().regex(/^Bearer$/i), expires_in: z.number().positive().max(86_400), scope: z.string().max(8192).optional() });
async function exchange(form: URLSearchParams, signal?: AbortSignal) {
  const response = await fetchProvider(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: form }, signal);
  let body: unknown;
  try { body = await readProviderJson(response); } catch { throw new AppError(502, 'CHATGPT_CONNECTION_FAILED', 'ChatGPT returned an unreadable sign-in response. Try again.', true); }
  if (!response.ok) {
    const raw = body && typeof body === 'object' && 'error' in body ? body.error : undefined;
    const code = typeof raw === 'string' ? raw : raw && typeof raw === 'object' && 'code' in raw && typeof raw.code === 'string' ? raw.code : '';
    if (form.get('grant_type') === 'refresh_token' && terminalRefreshErrors.has(code)) throw new AppError(401, 'CHATGPT_REAUTH_REQUIRED', 'Your ChatGPT connection has expired or was disconnected. Sign in again.');
    if (code === 'invalid_client') throw new AppError(400, 'CHATGPT_CLIENT_INVALID', 'ChatGPT did not recognize this app registration. Reconnect from Offscript settings.');
    if (code === 'invalid_grant') throw new AppError(400, 'CHATGPT_CODE_EXPIRED', 'This sign-in code has expired. Start sign-in again.');
    throw new AppError(502, 'CHATGPT_CONNECTION_FAILED', 'ChatGPT could not complete this connection. Try again later.', true);
  }
  const parsed = tokenSchema.safeParse(body);
  if (!parsed.success) throw new AppError(502, 'CHATGPT_CONNECTION_FAILED', 'ChatGPT returned an incomplete sign-in response. Try again.', true);
  return parsed.data;
}
async function verifiedIdentity(idToken: string, clientId: string, nonce: string, signal?: AbortSignal) {
  try {
    await metadata(signal);
    const parts = idToken.split('.');
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw identityError();
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!header || !['RS256', 'ES256'].includes(header.alg) || typeof header.kid !== 'string' || header.crit) throw identityError();
    const response = await fetchProvider(JWKS, {}, signal);
    if (!response.ok) { await response.body?.cancel(); throw identityError(); }
    const body = await readProviderJson(response) as { keys?: (JsonWebKey & { kid?: string; alg?: string; use?: string })[] };
    const candidates = Array.isArray(body.keys) ? body.keys.filter(key => key.kid === header.kid && (!key.alg || key.alg === header.alg) && (!key.use || key.use === 'sig')) : [];
    if (candidates.length !== 1) throw identityError();
    const candidate = candidates[0];
    if ((header.alg === 'RS256' && candidate.kty !== 'RSA') || (header.alg === 'ES256' && (candidate.kty !== 'EC' || candidate.crv !== 'P-256'))) throw identityError();
    const key = createPublicKey({ key: candidate, format: 'jwk' });
    if (!verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), { key, ...(header.alg === 'ES256' ? { dsaEncoding: 'ieee-p1363' as const } : {}) }, Buffer.from(parts[2], 'base64url'))) throw identityError();
    const now = Date.now() / 1000;
    const audience = typeof claims.aud === 'string' ? [claims.aud] : claims.aud;
    if (claims.iss !== ISSUER || !Array.isArray(audience) || !audience.includes(clientId) || ((audience.length > 1 || claims.azp !== undefined) && claims.azp !== clientId) ||
      typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp <= now - 5 ||
      typeof claims.iat !== 'number' || !Number.isFinite(claims.iat) || claims.iat > now + 5 ||
      (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || !Number.isFinite(claims.nbf) || claims.nbf > now + 5)) ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 500 || typeof claims.nonce !== 'string' || !equal(claims.nonce, nonce)) throw identityError();
    return { issuer: ISSUER as typeof ISSUER, subject: claims.sub as string, ...(typeof claims.email === 'string' && claims.email.length <= 320 ? { email: claims.email } : {}) };
  } catch (error) {
    if (error instanceof AppError && error.code.startsWith('CHATGPT_CONNECTION_')) throw error;
    throw identityError();
  }
}
async function availableModels(accessToken: string, signal?: AbortSignal): Promise<ChatGPTModel[]> {
  const response = await fetchProvider(`${RESOURCE}/models`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }, signal);
  if (!response.ok) {
    await response.body?.cancel();
    throw new AppError(response.status === 403 ? 403 : 502, 'CHATGPT_MODELS_UNAVAILABLE', 'ChatGPT could not load models for this account. Check its plan access and try connecting again.', true);
  }
  const parsed = z.object({ models: z.array(z.object({ slug: z.string().min(1).max(160), display_name: z.string().min(1).max(200), visibility: z.string() })).max(500) }).safeParse(await readProviderJson(response));
  if (!parsed.success) throw new AppError(502, 'CHATGPT_MODELS_UNAVAILABLE', 'ChatGPT returned an unreadable model list. Try connecting again.', true);
  return parsed.data.models.filter(model => model.visibility === 'list').map(model => ({ id: model.slug, name: model.display_name }));
}
function credentialsFrom(tokens: z.infer<typeof tokenSchema>, previous?: Credentials): Credentials {
  // Refresh does not create a new identity. An expired, previously verified token
  // remains a supported login hint; never replace it with an unverified hint.
  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token || previous?.refreshToken, idToken: previous?.idToken || tokens.id_token || '', expiresAt: Date.now() + tokens.expires_in * 1000, scopes: tokens.scope === undefined ? previous?.scopes || [] : tokens.scope.split(/\s+/).filter(Boolean) };
}
function attemptStillCurrent(attempt: Attempt) {
  return runtime.attempts.get(attempt.cookie) === attempt && attempt.expiresAt > Date.now() && readStore(attempt.path)?.generation === attempt.generation;
}

export async function completeChatGPTSignIn(request: Request): Promise<ChatGPTSettings> {
  const origin = canonicalOrigin(request, true); const url = new URL(request.url);
  const attempt = boundAttempt(request);
  if (request.method !== 'GET' || !attempt || attempt.consumed || !attemptStillCurrent(attempt) || `${origin}${url.pathname}` !== attempt.redirectUri ||
    ['state', 'code', 'client_id', 'error'].some(key => url.searchParams.getAll(key).length > 1) ||
    !equal(url.searchParams.get('state') || '', attempt.state)) throw authError();
  attempt.consumed = true;
  let uncommittedGrant: { refreshToken: string; clientId: string } | undefined;
  try {
    if (url.searchParams.has('error')) throw new AppError(400, 'CHATGPT_AUTH_DECLINED', 'ChatGPT sign-in was canceled or permission was declined. You can try again when ready.');
    const code = url.searchParams.get('code'); const suppliedId = url.searchParams.get('client_id');
    if (!code || code.length > 8192 || (attempt.clientId && suppliedId && suppliedId !== attempt.clientId)) throw authError();
    const clientId = attempt.clientId || suppliedId;
    if (!clientId || !registrationSchema.shape.clientId.safeParse(clientId).success) throw authError();
    const old = readStore(attempt.path)!;
    if (!old.registration) saveStore(attempt.path, { ...old, registration: { clientId } });
    const tokens = await exchange(new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code, code_verifier: attempt.verifier, redirect_uri: attempt.redirectUri, resource: RESOURCE }), request.signal);
    if (tokens.refresh_token) uncommittedGrant = { refreshToken: tokens.refresh_token, clientId };
    if (!tokens.id_token) throw identityError();
    const identity = await verifiedIdentity(tokens.id_token, clientId, attempt.nonce, request.signal);
    if (old.registration?.subject && (old.registration.subject !== identity.subject || old.registration.issuer !== identity.issuer)) throw identityError();
    const credentials = credentialsFrom(tokens);
    const models = credentials.scopes.includes(DIRECT_SCOPE) ? await availableModels(credentials.accessToken, request.signal) : [];
    if (!attemptStillCurrent(attempt)) throw authError();
    const current = readStore(attempt.path)!;
    saveStore(attempt.path, { ...current, generation: randomUUID(), registration: { clientId, ...identity }, credentials, needsReauth: false, models, model: models.some(model => model.id === current.model) ? current.model : models[0]?.id || '' });
    uncommittedGrant = undefined;
    stopSessionRequests(attempt.path);
    attempt.status = { status: 'connected' };
    return getChatGPTSettings();
  } catch (error) {
    if (uncommittedGrant) await revoke(uncommittedGrant.refreshToken, uncommittedGrant.clientId);
    const failure = error instanceof AppError ? error : new AppError(502, 'CHATGPT_CONNECTION_FAILED', 'ChatGPT could not complete sign-in. Try again.', true);
    attempt.status = { status: 'error', error: { message: failure.message } };
    throw failure;
  }
}

export function getChatGPTSettings(): ChatGPTSettings {
  const store = readStore(); const connected = Boolean(store?.credentials);
  const planEnabled = connected && Boolean(store?.credentials?.scopes.includes(DIRECT_SCOPE));
  const expiredWithoutRefresh = Boolean(store?.credentials && store.credentials.expiresAt <= Date.now() && !store.credentials.refreshToken);
  return { connected, ready: planEnabled && !expiredWithoutRefresh && Boolean(store?.model && store.models.some(model => model.id === store.model)), needsReauth: store?.needsReauth || expiredWithoutRefresh, planEnabled, accountLabel: store?.registration?.email || (store?.registration?.subject ? 'ChatGPT account' : null), model: store?.model || '', models: store?.models || [] };
}
export function setChatGPTModel(model: string): ChatGPTSettings {
  const path = pathForStore(); const store = readStore(path);
  if (!store?.credentials) throw notConnected();
  assert(store.models.some(candidate => candidate.id === model), 'CHATGPT_MODEL_UNAVAILABLE', 'Choose a model available to this ChatGPT account.');
  saveStore(path, { ...store, model });
  return getChatGPTSettings();
}
async function revoke(refreshToken: string, clientId: string) {
  try {
    const discovered = await metadata();
    if (!discovered.revocation_endpoint) return false;
    const endpoint = new URL(discovered.revocation_endpoint);
    if (endpoint.origin !== ISSUER || !endpoint.pathname.startsWith('/api/accounts/') || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return false;
    const response = await fetchProvider(endpoint.href, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: refreshToken, token_type_hint: 'refresh_token', client_id: clientId }) });
    await response.body?.cancel();
    return response.status === 200;
  } catch { return false; }
}
async function refresh(path: string, before: Store) {
  const token = before.credentials?.refreshToken;
  try {
    if (!token || !before.registration) throw new AppError(401, 'CHATGPT_REAUTH_REQUIRED', 'Sign in again to renew your ChatGPT connection.');
    const tokens = await exchange(new URLSearchParams({ grant_type: 'refresh_token', client_id: before.registration.clientId, refresh_token: token, resource: RESOURCE }));
    if (!tokens.refresh_token) throw new AppError(502, 'CHATGPT_CONNECTION_FAILED', 'ChatGPT did not renew this session completely. Try again.', true);
    const current = readStore(path);
    if (!current?.credentials || current.generation !== before.generation) {
      await revoke(tokens.refresh_token, before.registration.clientId);
      throw notConnected();
    }
    saveStore(path, { ...current, generation: randomUUID(), credentials: credentialsFrom(tokens, before.credentials), needsReauth: false });
  } catch (error) {
    if (error instanceof AppError && error.code === 'CHATGPT_REAUTH_REQUIRED') {
      const current = readStore(path);
      if (current?.generation === before.generation) {
        stopSessionRequests(path);
        saveStore(path, { ...current, generation: randomUUID(), credentials: undefined, needsReauth: true });
      }
    }
    throw error;
  }
}
export async function getChatGPTConnection(signal?: AbortSignal): Promise<{ accessToken: string; model: string }> {
  const path = pathForStore(); let store = readStore(path);
  if (signal?.aborted) throw new AppError(408, 'CHATGPT_CONNECTION_TIMEOUT', 'The ChatGPT request was stopped.', true);
  if (!store?.credentials) throw store?.needsReauth ? new AppError(401, 'CHATGPT_REAUTH_REQUIRED', 'Your ChatGPT connection needs a new sign-in.') : notConnected();
  if (store.credentials.expiresAt <= Date.now() + 60_000) {
    let renewal = runtime.refreshes.get(path);
    if (!renewal) {
      renewal = refresh(path, store).finally(() => { if (runtime.refreshes.get(path) === renewal) runtime.refreshes.delete(path); });
      runtime.refreshes.set(path, renewal);
    }
    await renewal;
    store = readStore(path);
  }
  if (signal?.aborted) throw new AppError(408, 'CHATGPT_CONNECTION_TIMEOUT', 'The ChatGPT request was stopped.', true);
  if (!store?.credentials) throw notConnected();
  assert(store.credentials.scopes.includes(DIRECT_SCOPE), 'CHATGPT_PLAN_DISABLED', 'Enable ChatGPT plan usage for Offscript before sending a request.', 403);
  assert(store.model && store.models.some(model => model.id === store.model), 'CHATGPT_MODEL_UNAVAILABLE', 'Choose an available ChatGPT model before sending a request.', 409);
  return { accessToken: store.credentials.accessToken, model: store.model };
}
export async function disconnectChatGPT(): Promise<{ revoked: boolean }> {
  const path = pathForStore(); const store = readStore(path);
  stopSessionRequests(path);
  for (const [key, attempt] of runtime.attempts) if (attempt.path === path) runtime.attempts.delete(key);
  if (!store) return { revoked: true };
  // Invalidate in-flight exchange/refresh before any revocation network operation.
  saveStore(path, { ...store, generation: randomUUID(), credentials: undefined, needsReauth: false, model: '', models: [] });
  return { revoked: store.credentials?.refreshToken && store.registration ? await revoke(store.credentials.refreshToken, store.registration.clientId) : !store.credentials };
}
