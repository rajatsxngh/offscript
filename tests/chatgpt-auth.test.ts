import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startChatGPTSignIn, completeChatGPTSignIn, getChatGPTSignInStatus, cancelChatGPTSignIn, getChatGPTSettings, getChatGPTConnection, disconnectChatGPT, setChatGPTModel, watchChatGPTDisconnect } from '../src/server/chatgpt-auth';
import { AppError } from '../src/server/errors';
import { GET as statusRoute, POST as startRoute, DELETE as cancelRoute } from '../src/app/api/ai/chatgpt/route';
import { GET as callbackRoute } from '../src/app/api/ai/chatgpt/callback/route';
import { POST as disconnectRoute } from '../src/app/api/ai/chatgpt/disconnect/route';

const originalFetch = globalThis.fetch;
const envNames = ['OFFSCRIPT_CHATGPT_CONFIG_PATH', 'OFFSCRIPT_AI_CONFIG_PATH', 'OFFSCRIPT_AI_SELECTION_PATH', 'NODE_ENV'] as const;
const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...keyPair.publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
let previousEnv: Record<string, string | undefined>;
let directory: string;
let file: string;
let calls: string[];
let tokenClaims: Record<string, unknown>;
let refreshCount: number;
let lastTokenForm: URLSearchParams;
const origin = 'http://127.0.0.1:3001';

beforeEach(() => {
  previousEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  directory = mkdtempSync(join(tmpdir(), 'offscript-chatgpt-test-'));
  file = join(directory, 'chatgpt.json');
  process.env.OFFSCRIPT_CHATGPT_CONFIG_PATH = file;
  process.env.OFFSCRIPT_AI_CONFIG_PATH = join(directory, 'api-key.json');
  process.env.OFFSCRIPT_AI_SELECTION_PATH = join(directory, 'ai-provider.json');
  Object.assign(process.env, { NODE_ENV: 'test' });
  calls = []; tokenClaims = {}; refreshCount = 0;
  globalThis.fetch = provider;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of envNames) {
    if (previousEnv[name] === undefined) Reflect.deleteProperty(process.env, name);
    else Object.assign(process.env, { [name]: previousEnv[name] });
  }
  rmSync(directory, { recursive: true, force: true });
});

function request(method = 'POST', cookie?: string, url = `${origin}/api/ai/chatgpt`) {
  return new Request(url, { method, headers: { host: new URL(url).host, origin: new URL(url).origin, ...(cookie ? { cookie } : {}) } });
}
function matches(code: string) { return (error: unknown) => error instanceof AppError && error.code === code; }
function jwt(nonce: string, clientId: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: 'https://auth.openai.com', aud: clientId, sub: 'test-subject', iat: now, exp: now + 3600, nonce, email: 'local@example.com', ...tokenClaims })).toString('base64url');
  return `${header}.${payload}.${sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), keyPair.privateKey).toString('base64url')}`;
}
let activeNonce = '';
async function provider(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input); calls.push(url);
  assert.equal(init?.redirect, 'error');
  if (url.endsWith('/.well-known/openid-configuration')) return Response.json({ issuer: 'https://auth.openai.com', authorization_endpoint: 'https://auth.openai.com/api/accounts/authorize', token_endpoint: 'https://auth.openai.com/api/accounts/oauth/token', jwks_uri: 'https://auth.openai.com/.well-known/jwks.json', revocation_endpoint: 'https://auth.openai.com/api/accounts/oauth/revoke' });
  if (url.endsWith('/.well-known/jwks.json')) return Response.json({ keys: [jwk] });
  if (url.endsWith('/oauth/revoke')) return new Response(null, { status: 200 });
  if (url.endsWith('/oauth/token')) {
    lastTokenForm = new URLSearchParams(String(init?.body));
    const refresh = lastTokenForm.get('grant_type') === 'refresh_token';
    if (refresh) refreshCount++;
    return Response.json({ access_token: `access-test-secret-${refreshCount}`, refresh_token: `refresh-test-secret-${refreshCount}`, id_token: jwt(activeNonce, lastTokenForm.get('client_id')!), token_type: 'Bearer', expires_in: 3600, scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct' });
  }
  if (url === 'https://api.openai.com/v1/models') return Response.json({ models: [{ slug: 'test-model', display_name: 'Test model', visibility: 'list' }, { slug: 'hidden', display_name: 'Hidden', visibility: 'hidden' }, { slug: 'other-model', display_name: 'Other model', visibility: 'list' }] });
  throw new Error(`Unexpected provider request: ${url}`);
}
function begin(cookie?: string) {
  const result = startChatGPTSignIn(request('POST', cookie));
  const url = new URL(result.authorizationUrl);
  activeNonce = url.searchParams.get('nonce')!;
  return { ...result, url, cookieHeader: result.cookie, cookie: result.cookie.split(';')[0] };
}
function callback(attempt: ReturnType<typeof begin>, changes: Record<string, string> = {}, cookie = attempt.cookie) {
  const url = new URL(attempt.url.searchParams.get('redirect_uri')!);
  url.search = new URLSearchParams({ code: 'test-auth-code', state: attempt.url.searchParams.get('state')!, client_id: 'oaiapp_test', ...changes }).toString();
  return request('GET', cookie, url.href);
}
async function connect() { const attempt = begin(); await completeChatGPTSignIn(callback(attempt)); return attempt; }
function expireAccessToken() {
  const stored = JSON.parse(readFileSync(file, 'utf8'));
  stored.credentials.expiresAt = Date.now() - 1000;
  writeFileSync(file, JSON.stringify(stored), { mode: 0o600 });
}

test('authorization is browser-bound, uses PKCE and keeps a stable private host ID', () => {
  const first = begin();
  assert.equal(first.url.origin + first.url.pathname, 'https://auth.openai.com/api/accounts/authorize');
  assert.equal(first.url.searchParams.get('client_id'), 'dynamic_agent_client');
  assert.equal(first.url.searchParams.get('agent_name_hint'), 'Offscript');
  assert.match(first.url.searchParams.get('ext_agent_host_id')!, /^urn:uuid:/);
  assert.equal(first.url.searchParams.get('redirect_uri'), `${origin}/api/ai/chatgpt/callback`);
  assert.equal(first.url.searchParams.get('code_challenge_method'), 'S256');
  assert.match(first.cookie, /^offscript_chatgpt_flow=/);
  assert.match(first.cookieHeader, /HttpOnly; SameSite=Lax; Max-Age=600/);
  const second = begin(first.cookie);
  assert.equal(first.url.searchParams.get('ext_agent_host_id'), second.url.searchParams.get('ext_agent_host_id'));
  assert.notEqual(first.url.searchParams.get('state'), second.url.searchParams.get('state'));
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal(getChatGPTSignInStatus(request('GET', second.cookie)).status, 'pending');
  assert.equal(getChatGPTSignInStatus(request('GET')).status, 'idle');
  assert.equal(calls.length, 0);
});

test('signed callback saves private credentials and loads only visible models', async () => {
  const attempt = await connect();
  assert.equal(lastTokenForm.get('client_id'), 'oaiapp_test');
  assert.equal(lastTokenForm.get('resource'), 'https://api.openai.com/v1');
  assert.equal(createHash('sha256').update(lastTokenForm.get('code_verifier')!).digest('base64url'), attempt.url.searchParams.get('code_challenge'));
  assert.deepEqual(getChatGPTSettings(), { connected: true, ready: true, needsReauth: false, planEnabled: true, accountLabel: 'local@example.com', model: 'test-model', models: [{ id: 'test-model', name: 'Test model' }, { id: 'other-model', name: 'Other model' }] });
  assert.equal(getChatGPTSignInStatus(request('GET', attempt.cookie)).status, 'connected');
  assert.ok(!JSON.stringify(getChatGPTSettings()).includes('secret'));
  assert.ok(!JSON.stringify(getChatGPTSignInStatus(request('GET', attempt.cookie))).includes('secret'));
  setChatGPTModel('other-model');
  assert.equal((await getChatGPTConnection()).model, 'other-model');
  assert.throws(() => setChatGPTModel('hidden'), matches('CHATGPT_MODEL_UNAVAILABLE'));
});

test('bad state, missing browser binding, duplicate callback parameters and replay never exchange a code', async () => {
  const attempt = begin();
  await assert.rejects(completeChatGPTSignIn(callback(attempt, { state: 'wrong' })), matches('CHATGPT_AUTH_INVALID'));
  await assert.rejects(completeChatGPTSignIn(callback(attempt, {}, '')), matches('CHATGPT_AUTH_INVALID'));
  const duplicate = new URL(callback(attempt).url); duplicate.searchParams.append('state', 'other');
  await assert.rejects(completeChatGPTSignIn(request('GET', attempt.cookie, duplicate.href)), matches('CHATGPT_AUTH_INVALID'));
  assert.equal(calls.length, 0);
  await completeChatGPTSignIn(callback(attempt));
  const count = calls.length;
  await assert.rejects(completeChatGPTSignIn(callback(attempt)), matches('CHATGPT_AUTH_INVALID'));
  assert.equal(calls.length, count);
});

test('expired or canceled attempts cannot complete', async () => {
  const attempt = begin();
  const originalNow = Date.now;
  try {
    Date.now = () => originalNow() + 11 * 60_000;
    await assert.rejects(completeChatGPTSignIn(callback(attempt)), matches('CHATGPT_AUTH_INVALID'));
  } finally { Date.now = originalNow; }
  const another = begin();
  cancelChatGPTSignIn(request('DELETE', another.cookie));
  await assert.rejects(completeChatGPTSignIn(callback(another)), matches('CHATGPT_AUTH_INVALID'));
  assert.equal(calls.length, 0);
});

test('canonical origin is required and callback permits only its bound loopback host', async () => {
  assert.throws(() => startChatGPTSignIn(request('POST', undefined, 'http://localhost:3001/api/ai/chatgpt')), matches('CHATGPT_CANONICAL_ORIGIN'));
  const attempt = begin();
  const hostile = callback(attempt); hostile.headers.set('host', 'attacker.example:3001');
  await assert.rejects(completeChatGPTSignIn(hostile), matches('CHATGPT_AUTH_INVALID'));
  const wrongPort = callback(attempt); wrongPort.headers.set('host', '127.0.0.1:3002');
  await assert.rejects(completeChatGPTSignIn(wrongPort), matches('CHATGPT_AUTH_INVALID'));
  assert.equal(calls.length, 0);
  const legitimate = callback(attempt); legitimate.headers.set('sec-fetch-site', 'cross-site');
  await completeChatGPTSignIn(legitimate);
});

test('invalid issuer, audience, nonce, expiry and signature are rejected without replacing the active connection', async () => {
  await connect();
  const original = readFileSync(file, 'utf8');
  for (const claims of [{ iss: 'https://attacker.example' }, { aud: 'wrong-client' }, { azp: 'wrong-client' }, { nonce: 'wrong' }, { exp: 1 }, { sub: 'different-user' }]) {
    tokenClaims = claims;
    const attempt = begin();
    await assert.rejects(completeChatGPTSignIn(callback(attempt)), matches('CHATGPT_IDENTITY_INVALID'));
    assert.equal(readFileSync(file, 'utf8'), original);
  }
  tokenClaims = {};
  const attempt = begin();
  globalThis.fetch = async (url, init) => {
    const response = await provider(url, init);
    if (String(url).endsWith('/oauth/token')) {
      const body = await response.json(); body.id_token = body.id_token.slice(0, -8) + 'AAAAAAAA'; return Response.json(body);
    }
    return response;
  };
  await assert.rejects(completeChatGPTSignIn(callback(attempt)), matches('CHATGPT_IDENTITY_INVALID'));
  assert.equal(readFileSync(file, 'utf8'), original);
});

test('returning sign-in reuses issued registration and rejects a changed callback client', async () => {
  await connect();
  const attempt = begin();
  assert.equal(attempt.url.searchParams.get('client_id'), 'oaiapp_test');
  assert.equal(attempt.url.searchParams.has('agent_name_hint'), false);
  await assert.rejects(completeChatGPTSignIn(callback(attempt, { client_id: 'oaiapp_other' })), matches('CHATGPT_AUTH_INVALID'));
  assert.equal(getChatGPTSettings().ready, true);
});

test('concurrent inference refreshes once and atomically stores the rotated token', async () => {
  await connect(); expireAccessToken();
  const results = await Promise.all([getChatGPTConnection(), getChatGPTConnection(), getChatGPTConnection()]);
  assert.equal(refreshCount, 1);
  assert.ok(results.every(value => value.accessToken === 'access-test-secret-1'));
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).credentials.refreshToken, 'refresh-test-secret-1');
  assert.equal(lastTokenForm.has('scope'), false);
});

test('disconnect during refresh cannot resurrect credentials', async () => {
  await connect(); expireAccessToken();
  let release!: () => void;
  const paused = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/oauth/token')) { started(); await paused; }
    return provider(url, init);
  };
  const renewal = getChatGPTConnection();
  await entered;
  const result = await disconnectChatGPT();
  assert.equal(result.revoked, true);
  release();
  await assert.rejects(renewal, matches('CHATGPT_NOT_CONNECTED'));
  assert.equal(getChatGPTSettings().connected, false);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).credentials, undefined);
  assert.equal(begin().url.searchParams.get('client_id'), 'oaiapp_test');
});

test('terminal refresh errors require reauthorization; temporary errors retain credentials and sanitize messages', async () => {
  await connect(); expireAccessToken();
  const stored = readFileSync(file, 'utf8');
  globalThis.fetch = async () => Response.json({ error: 'temporary_server_error', error_description: 'provider-secret' }, { status: 503 });
  await assert.rejects(getChatGPTConnection(), error => matches('CHATGPT_CONNECTION_FAILED')(error) && !String(error).includes('provider-secret'));
  assert.equal(readFileSync(file, 'utf8'), stored);
  globalThis.fetch = async () => Response.json({ error: 'invalid_grant', error_description: 'provider-secret' }, { status: 400 });
  await assert.rejects(getChatGPTConnection(), matches('CHATGPT_REAUTH_REQUIRED'));
  assert.equal(getChatGPTSettings().needsReauth, true);
  assert.equal(getChatGPTSettings().connected, false);
});

test('identity-only consent remains signed in but cannot enable plan inference', async () => {
  globalThis.fetch = async (url, init) => {
    const response = await provider(url, init);
    if (String(url).endsWith('/oauth/token')) {
      const body = await response.json(); body.scope = 'openid profile email offline_access'; return Response.json(body);
    }
    return response;
  };
  await connect();
  assert.equal(getChatGPTSettings().connected, true);
  assert.equal(getChatGPTSettings().planEnabled, false);
  assert.equal(getChatGPTSettings().ready, false);
  assert.ok(!calls.includes('https://api.openai.com/v1/models'));
  await assert.rejects(getChatGPTConnection(), matches('CHATGPT_PLAN_DISABLED'));
  assert.equal(begin().url.searchParams.get('prompt'), 'consent');
});

test('canceling an in-flight sign-in prevents credential persistence', async () => {
  const attempt = begin();
  let release!: () => void;
  const paused = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/oauth/token')) { started(); await paused; }
    return provider(url, init);
  };
  const pending = completeChatGPTSignIn(callback(attempt));
  await entered;
  cancelChatGPTSignIn(request('DELETE', attempt.cookie));
  release();
  await assert.rejects(pending, matches('CHATGPT_AUTH_INVALID'));
  assert.equal(getChatGPTSettings().connected, false);
  assert.ok(calls.includes('https://auth.openai.com/api/accounts/oauth/revoke'));
});

test('routes enforce same-origin initiation and cancellation while callback accepts a valid OAuth navigation', async () => {
  const blocked = request(); blocked.headers.set('origin', 'https://attacker.example');
  assert.equal((await startRoute(blocked)).status, 403);
  assert.equal(calls.length, 0);
  const started = await startRoute(request());
  assert.equal(started.status, 200);
  assert.equal(started.headers.get('cache-control'), 'no-store');
  const cookie = started.headers.get('set-cookie')!.split(';')[0];
  const authorization = new URL((await started.json()).authorizationUrl);
  activeNonce = authorization.searchParams.get('nonce')!;
  const url = new URL(authorization.searchParams.get('redirect_uri')!);
  url.search = new URLSearchParams({ state: authorization.searchParams.get('state')!, code: 'test-code', client_id: 'oaiapp_test' }).toString();
  const navigation = request('GET', cookie, url.href); navigation.headers.set('sec-fetch-site', 'cross-site');
  const completed = await callbackRoute(navigation);
  assert.equal(completed.status, 200);
  assert.equal(completed.headers.get('referrer-policy'), 'no-referrer');
  assert.match(completed.headers.get('content-security-policy')!, /default-src 'none'/);
  assert.ok(!(await completed.text()).includes('test-code'));
  assert.equal((await (await statusRoute(request('GET', cookie))).json()).status, 'connected');
  const deniedDisconnect = request('POST', cookie, `${origin}/api/ai/chatgpt/disconnect`); deniedDisconnect.headers.set('origin', 'https://attacker.example');
  assert.equal((await disconnectRoute(deniedDisconnect)).status, 403);
  assert.equal(getChatGPTSettings().connected, true);
  const canceled = await cancelRoute(request('DELETE', cookie));
  assert.equal(canceled.status, 200);
  assert.match(canceled.headers.get('set-cookie')!, /Max-Age=0/);
});

test('failed revocation clears local credentials and preserves the issued registration', async () => {
  await connect();
  globalThis.fetch = async () => { throw new Error('private network details'); };
  assert.deepEqual(await disconnectChatGPT(), { revoked: false });
  assert.equal(getChatGPTSettings().connected, false);
  assert.equal(begin().url.searchParams.get('client_id'), 'oaiapp_test');
});

test('storage follows an isolated API configuration directory and never follows a credential symlink', () => {
  delete process.env.OFFSCRIPT_CHATGPT_CONFIG_PATH;
  process.env.OFFSCRIPT_AI_CONFIG_PATH = join(directory, 'api-key.json');
  begin();
  assert.equal(statSync(join(directory, 'chatgpt-connection.json')).mode & 0o777, 0o600);
  assert.equal(getChatGPTSettings().connected, false);
  const protectedFile = join(directory, 'protected.json');
  writeFileSync(protectedFile, JSON.stringify({ credentials: { accessToken: 'must-not-follow' } }));
  unlinkSync(join(directory, 'chatgpt-connection.json'));
  symlinkSync(protectedFile, join(directory, 'chatgpt-connection.json'));
  assert.equal(getChatGPTSettings().connected, false);
  begin();
  assert.equal(JSON.parse(readFileSync(protectedFile, 'utf8')).credentials.accessToken, 'must-not-follow');
});

test('expired credentials without refresh permission need reauthorization before inference', async () => {
  await connect(); expireAccessToken();
  const saved = JSON.parse(readFileSync(file, 'utf8')); delete saved.credentials.refreshToken;
  writeFileSync(file, JSON.stringify(saved), { mode: 0o600 });
  assert.equal(getChatGPTSettings().ready, false);
  assert.equal(getChatGPTSettings().needsReauth, true);
  await assert.rejects(getChatGPTConnection(), matches('CHATGPT_REAUTH_REQUIRED'));
  assert.equal(getChatGPTSettings().connected, false);
});

test('disconnect stops registered inference controllers while released operations stay unaffected', async () => {
  await connect();
  const live = new AbortController(); const released = new AbortController();
  const stop = watchChatGPTDisconnect(live);
  const release = watchChatGPTDisconnect(released); release();
  const signingOut = disconnectChatGPT();
  assert.equal(live.signal.aborted, true);
  assert.equal(released.signal.aborted, false);
  await signingOut; stop();
});

test('refresh retains the previously verified identity hint', async () => {
  await connect();
  const previous = JSON.parse(readFileSync(file, 'utf8')).credentials.idToken;
  expireAccessToken(); tokenClaims = { nonce: 'not-a-sign-in-nonce', sub: 'different-subject' };
  await getChatGPTConnection();
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).credentials.idToken, previous);
});
