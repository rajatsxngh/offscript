import { randomUUID } from 'node:crypto';
import { closeSync, constants, fstatSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { AppError } from './errors';

export const DEFAULT_AI_MODEL = 'gpt-5.4-mini';

/** Public connection status. Never include credentials in this shape. */
export interface AISettings {
  configured: boolean;
  model: string;
  source: 'local' | 'environment' | null;
}

interface AIConnection { apiKey: string; model: string; source: 'local' | 'environment' }
interface ConfigOptions { path?: string }

const connectionSchema = z.object({
  apiKey: z.string().trim().min(8).max(512).regex(/^[\x21-\x7e]+$/),
  model: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/),
}).strict();
const storedSchema = connectionSchema.extend({ version: z.literal(1), updatedAt: z.string().datetime() }).strict();

function configPath(options: ConfigOptions) {
  // Runtime secrets are machine-local and must never be traced into a build artifact.
  return resolve(/* turbopackIgnore: true */ options.path || process.env.OFFSCRIPT_AI_CONFIG_PATH || '.data/ai-connection.json');
}

function readLocalConnection(options: ConfigOptions): AIConnection | null {
  let file: number | undefined;
  try {
    // Do not follow a replacement symlink or read an unexpectedly large file.
    file = openSync(/* turbopackIgnore: true */ configPath(options), constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = fstatSync(file);
    if (!info.isFile() || info.size > 4_096) return null;
    const parsed = storedSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    return parsed.success ? { apiKey: parsed.data.apiKey, model: parsed.data.model, source: 'local' } : null;
  } catch {
    // A missing or unreadable local connection never exposes its contents or filesystem path.
    return null;
  } finally { if (file !== undefined) closeSync(file); }
}

/** Server-only: callers must never serialize this return value into an HTTP response. */
export function getAIConnection(options: ConfigOptions = {}): AIConnection | null {
  const local = readLocalConnection(options);
  if (local) return local;
  const environment = connectionSchema.safeParse({ apiKey: process.env.OPENAI_API_KEY || '', model: process.env.OPENAI_MODEL?.trim() || DEFAULT_AI_MODEL });
  return environment.success ? { ...environment.data, source: 'environment' } : null;
}

export function getAISettings(options: ConfigOptions = {}): AISettings {
  const connection = getAIConnection(options);
  return { configured: Boolean(connection), model: connection?.model || DEFAULT_AI_MODEL, source: connection?.source || null };
}

async function verifyModel(apiKey: string, model: string, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(15_000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
      method: 'GET', signal: combined, cache: 'no-store', redirect: 'error',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
    await response.body?.cancel();
    if (response.status === 401) throw new AppError(401, 'AI_AUTH_FAILED', 'OpenAI did not accept that API key. Check the key and try again.');
    if (response.status === 403) throw new AppError(403, 'AI_ACCESS_DENIED', 'This API key does not have access to that model. Choose an accessible model or check the key’s project permissions.');
    if (response.status === 404) throw new AppError(400, 'AI_MODEL_UNAVAILABLE', 'That model was not found or is unavailable to this API key. Check the model name.');
    if (response.status === 429) throw new AppError(429, 'AI_PROVIDER_LIMIT', 'OpenAI is limiting requests for this project. Check its usage and billing, then try connecting again.', true);
    if (!response.ok) throw new AppError(502, 'AI_CONNECTION_FAILED', 'OpenAI could not verify this connection. Try again later.', true);
    if (combined.aborted) throw new AppError(408, 'AI_CONNECTION_TIMEOUT', 'The connection check timed out or was stopped. Try connecting again.', true);
  } catch (error) {
    if (combined.aborted) throw new AppError(408, 'AI_CONNECTION_TIMEOUT', 'The connection check timed out or was stopped. Try connecting again.', true);
    if (error instanceof AppError) throw error;
    throw new AppError(502, 'AI_CONNECTION_FAILED', 'OpenAI could not be reached. Check your connection and try again.', true);
  }
}

/** Validates model access without generating tokens, then atomically saves a private local file. */
export async function saveAIConnection(value: unknown, options: ConfigOptions & { signal?: AbortSignal } = {}): Promise<AISettings> {
  const input = connectionSchema.safeParse(value);
  if (!input.success) throw new AppError(400, 'INVALID_AI_SETTINGS', 'Enter a valid API key and a model name such as gpt-5.4-mini.');
  await verifyModel(input.data.apiKey, input.data.model, options.signal);
  const destination = configPath(options);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  let file: number | undefined;
  try {
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
    file = openSync(temporary, 'wx', 0o600);
    writeFileSync(file, JSON.stringify({ version: 1, ...input.data, updatedAt: new Date().toISOString() }), 'utf8');
    fsyncSync(file);
    closeSync(file);
    file = undefined;
    renameSync(temporary, destination);
  } catch {
    throw new AppError(500, 'AI_SETTINGS_SAVE_FAILED', 'The connection was verified, but Offscript could not save it on this computer. Check local storage permissions and try again.', true);
  } finally {
    if (file !== undefined) closeSync(file);
    try { unlinkSync(temporary); } catch { /* The atomic rename normally consumed the temporary file. */ }
  }
  return { configured: true, model: input.data.model, source: 'local' };
}
