import { randomUUID } from 'node:crypto';
import { closeSync, constants, fstatSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import type { AIProvider, AISettings } from '../lib/ai-settings';
import { getAIConnection, getAISettings as getAPIKeySettings, saveAIConnection } from './ai-config';
import { getChatGPTSettings, getChatGPTConnection, setChatGPTModel } from './chatgpt-auth';
import { AppError, assert } from './errors';

const selectionSchema = z.object({ version: z.literal(1), provider: z.enum(['chatgpt', 'api-key']) }).strict();
const inputSchema = z.object({ provider: z.enum(['chatgpt', 'api-key']), model: z.string().min(1).max(160).optional() }).strict();
function selectionPath() {
  return resolve(/* turbopackIgnore: true */ process.env.OFFSCRIPT_AI_SELECTION_PATH || join(dirname(process.env.OFFSCRIPT_AI_CONFIG_PATH || '.data/ai-connection.json'), 'ai-provider.json'));
}
function selectedProvider(): AIProvider {
  let file: number | undefined;
  try {
    file = openSync(/* turbopackIgnore: true */ selectionPath(), constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(file);
    if (!stat.isFile() || stat.size > 1024) throw new Error('Invalid selection');
    return selectionSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).provider;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'api-key';
    // A damaged saved preference must never silently enable separately billed API usage.
    throw new AppError(500, 'AI_SELECTION_UNAVAILABLE', 'The saved AI preference could not be read. Choose your connection again in Tutor settings.');
  } finally { if (file !== undefined) closeSync(file); }
}
function saveSelection(provider: AIProvider) {
  const destination = selectionPath();
  const temporary = `${destination}.${randomUUID()}.tmp`;
  let file: number | undefined;
  try {
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
    file = openSync(temporary, 'wx', 0o600);
    writeFileSync(file, JSON.stringify({ version: 1, provider }));
    fsyncSync(file); closeSync(file); file = undefined;
    renameSync(temporary, destination);
  } catch {
    throw new AppError(500, 'AI_SELECTION_SAVE_FAILED', 'Offscript could not save your AI preference. Check local storage and try again.', true);
  } finally {
    if (file !== undefined) closeSync(file);
    try { unlinkSync(temporary); } catch { /* Atomic rename consumed the file. */ }
  }
}

/** All public status is assembled explicitly; credentials stay in server-only modules. */
export function getAISettings(): AISettings {
  const apiKey = getAPIKeySettings();
  const chatgpt = getChatGPTSettings();
  let activeProvider: AIProvider;
  try { activeProvider = selectedProvider(); }
  catch {
    return { activeProvider: null, apiKey, chatgpt, configured: false, model: '', source: null,
      selectionError: 'Your saved AI preference could not be read. Choose a connection below to restore it.' };
  }
  return {
    activeProvider, apiKey, chatgpt,
    ...(activeProvider === 'api-key' ? apiKey : { configured: chatgpt.ready, model: chatgpt.model, source: chatgpt.connected ? 'local' as const : null }),
  };
}

export function selectAIProvider(value: unknown): AISettings {
  const input = inputSchema.parse(value);
  if (input.provider === 'chatgpt') {
    assert(getChatGPTSettings().ready, 'CHATGPT_NOT_READY', 'Connect ChatGPT and enable plan usage before selecting it.', 409);
    if (input.model) setChatGPTModel(input.model);
  } else {
    const apiKey = getAPIKeySettings();
    assert(apiKey.configured, 'API_KEY_NOT_READY', 'Connect an OpenAI API key before selecting it.', 409);
    assert(!input.model || input.model === apiKey.model, 'API_MODEL_REQUIRES_CHECK', 'Enter your API key to verify a different API model.');
  }
  saveSelection(input.provider);
  return getAISettings();
}

export async function saveAPIKeyAndSelect(value: unknown, signal?: AbortSignal): Promise<AISettings> {
  await saveAIConnection(value, { signal });
  return selectAIProvider({ provider: 'api-key' });
}

export type TutorConnection = { provider: AIProvider; bearer: string; model: string };
/** No fallback between billing sources. Capture the explicit provider before asynchronous work. */
export async function resolveAIConnection(provider: AIProvider, signal?: AbortSignal): Promise<TutorConnection> {
  if (provider === 'chatgpt') {
    const connection = await getChatGPTConnection(signal);
    return { provider, bearer: connection.accessToken, model: connection.model };
  }
  const connection = getAIConnection();
  assert(connection, 'AI_NOT_CONFIGURED', 'Connect ChatGPT or an OpenAI API key in Tutor settings.', 503);
  return { provider, bearer: connection.apiKey, model: connection.model };
}
