import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { AppError, assert } from './errors';

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
export function assertLocalRequest(request: Request) {
  assert(process.env.NODE_ENV !== 'production' || process.env.OFFSCRIPT_LOCAL_PREVIEW === '1', 'LOCAL_MODE_DISABLED', 'This build has no account authentication. Local preview must be explicitly enabled; public access is not supported.', 403);
  const url = new URL(request.url);
  const host = request.headers.get('host');
  let browserOrigin = url.origin;
  assert(localHosts.has(url.hostname), 'LOCAL_ONLY', 'This prototype is available only on the local computer.', 403);
  if (host) {
    let hostUrl: URL;
    try { hostUrl = new URL(`${url.protocol}//${host}`); } catch { throw new AppError(403, 'LOCAL_ONLY', 'Invalid local host.'); }
    // Next can normalize the internal URL to localhost while the browser uses 127.0.0.1.
    // Both authorities must still be loopback and use the same listening port.
    assert(localHosts.has(hostUrl.hostname) && hostUrl.port === url.port && !hostUrl.username && !hostUrl.password && hostUrl.pathname === '/' && !hostUrl.search && !hostUrl.hash, 'LOCAL_ONLY', 'This prototype is available only on the local computer.', 403);
    browserOrigin = hostUrl.origin;
  }
  assert(request.headers.get('sec-fetch-site') !== 'cross-site', 'ORIGIN_REJECTED', 'Cross-site requests are not allowed.', 403);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    assert(request.headers.get('origin') === browserOrigin, 'ORIGIN_REJECTED', 'This action must come from the same local Offscript page.', 403);
  }
}

export async function readJson(request: Request): Promise<unknown> {
  assert(request.headers.get('content-type')?.split(';')[0].trim() === 'application/json', 'INVALID_CONTENT_TYPE', 'Send this request as JSON.', 415);
  const maxBytes = 1_000_000;
  assert(Number(request.headers.get('content-length') || 0) <= maxBytes, 'REQUEST_TOO_LARGE', 'The request is too large.', 413);
  assert(request.body, 'INVALID_JSON', 'A JSON request body is required.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new AppError(413, 'REQUEST_TOO_LARGE', 'The request is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new AppError(400, 'INVALID_JSON', 'The request body is not valid JSON.'); }
}

export async function api(request: Request, callback: () => unknown | Promise<unknown>): Promise<Response> {
  const requestId = randomUUID();
  try {
    assertLocalRequest(request);
    const result = await callback();
    const response = result instanceof Response ? result : Response.json(result);
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Request-Id', requestId);
    return response;
  } catch (error) {
    const failure = error instanceof AppError ? error : error instanceof ZodError ? new AppError(400, 'INVALID_INPUT', 'Some information is missing or invalid. Check the fields and try again.') : new AppError(500, 'INTERNAL_ERROR', 'Offscript could not complete this request. Your last acknowledged save is still stored.', true);
    // Provider errors, payloads, and credentials are intentionally never logged or returned.
    return Response.json({ error: { code: failure.code, message: failure.message, retryable: failure.retryable, requestId } }, { status: failure.status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Request-Id': requestId } });
  }
}
