import { AppError, assert } from './errors';

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Use only known codes for user-facing errors; never forward provider messages or tokens. */
export function chatGPTProviderError(value: unknown, status = 502): AppError {
  const body = object(value);
  const detail = object(body.error || body.detail || body);
  const code = detail.code || (typeof body.detail === 'string' ? body.detail : undefined);
  if (status === 429 || code === 'subscription_sharing_usage_limit_exceeded') return new AppError(429, 'PROVIDER_LIMIT', 'Your ChatGPT plan has reached its usage limit for this app. Manage usage in ChatGPT, wait, or explicitly choose your API connection in Tutor settings. Your question is saved.', true);
  if (code === 'subscription_sharing_user_not_eligible') return new AppError(403, 'CHATGPT_PLAN_UNAVAILABLE', 'This ChatGPT account is not eligible for plan usage in this app. You can choose an API connection in Tutor settings.');
  if (code === 'subscription_sharing_usage_unavailable' || code === 'subscription_sharing_user_unavailable') return new AppError(503, 'CHATGPT_PLAN_UNAVAILABLE', 'ChatGPT plan usage is temporarily unavailable. Your connection is saved; try again later.', true);
  if (status === 401) return new AppError(401, 'CHATGPT_REAUTH_REQUIRED', 'ChatGPT could not authorize this request. Reconnect ChatGPT in Tutor settings. Your question is saved.');
  if (status === 403) return new AppError(403, 'CHATGPT_ACCESS_DENIED', 'ChatGPT did not allow this model or plan request. Check your plan permissions or choose another model in Tutor settings.');
  return new AppError(502, 'PROVIDER_ERROR', 'ChatGPT could not complete this answer. Your question is saved; try again later.', true);
}

export function completedText(value: unknown): string {
  const data = object(value);
  const output = Array.isArray(data.output) ? data.output : [];
  const text = output.filter(item => object(item).type === 'message')
    .flatMap(item => Array.isArray(object(item).content) ? object(item).content as unknown[] : [])
    .filter(item => object(item).type === 'output_text' && typeof object(item).text === 'string')
    .map(item => object(item).text as string).join('\n\n').trim();
  assert(data.status === 'completed' && text.length > 0 && text.length <= 30_000, 'INCOMPLETE_ANSWER', 'The tutor did not finish a usable answer. Try a shorter or more specific question.', 502);
  return text;
}

/** Buffer a bounded upstream stream; partial output is never committed to the conversation. */
export async function readChatGPTStream(response: Response): Promise<string> {
  assert(response.body, 'INCOMPLETE_ANSWER', 'ChatGPT returned an empty answer.', 502);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      assert(bytes <= 1_000_000, 'PROVIDER_RESPONSE_TOO_LARGE', 'The tutor returned more content than this version supports.', 502);
      buffer += decoder.decode(value, { stream: true });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
        if (!data || data === '[DONE]') continue;
        let event: Record<string, unknown>;
        try { event = object(JSON.parse(data)); }
        catch { throw new AppError(502, 'INCOMPLETE_ANSWER', 'ChatGPT returned an interrupted answer. Please try again.'); }
        if (event.type === 'response.failed') throw chatGPTProviderError(object(event.response).error);
        if (event.type === 'error') throw chatGPTProviderError(event);
        if (event.type === 'response.incomplete') throw new AppError(502, 'INCOMPLETE_ANSWER', 'ChatGPT stopped before finishing its answer. Try a shorter question.');
        if (event.type === 'response.completed') return completedText(event.response);
      }
    }
    throw new AppError(502, 'INCOMPLETE_ANSWER', 'The ChatGPT connection ended before the answer finished. Your question is saved.', true);
  } finally {
    try { await reader.cancel(); } catch { /* The stream may already be aborted. */ }
    reader.releaseLock();
  }
}
