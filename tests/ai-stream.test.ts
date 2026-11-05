import test from 'node:test';
import assert from 'node:assert/strict';
import { readChatGPTStream } from '../src/server/ai-stream';
import { AppError } from '../src/server/errors';

function stream(events: unknown[], chunkSize = 7) {
  const bytes = new TextEncoder().encode(events.map(event => `data: ${JSON.stringify(event)}\r\n\r\n`).join(''));
  let offset = 0;
  return new Response(new ReadableStream({ pull(controller) {
    if (offset >= bytes.length) { controller.close(); return; }
    controller.enqueue(bytes.slice(offset, offset += chunkSize));
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
}
const completed = (text: string) => ({ type: 'response.completed', response: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] } });
const code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;

test('ChatGPT SSE requires terminal completion and decodes split UTF-8 frames', async () => {
  const answer = 'A z-score of 2 is two standard deviations above μ. 日本語';
  assert.equal(await readChatGPTStream(stream([
    { type: 'response.output_text.delta', delta: 'partial' }, completed(answer),
  ], 1)), answer);
});

test('partial, malformed, incomplete and failed streams never become a finished answer', async () => {
  await assert.rejects(readChatGPTStream(stream([{ type: 'response.output_text.delta', delta: 'partial answer' }])), code('INCOMPLETE_ANSWER'));
  await assert.rejects(readChatGPTStream(new Response('data: {broken}\n\n')), code('INCOMPLETE_ANSWER'));
  await assert.rejects(readChatGPTStream(stream([{ type: 'response.incomplete', response: { status: 'incomplete' } }])), code('INCOMPLETE_ANSWER'));
  await assert.rejects(readChatGPTStream(stream([completed('')])), code('INCOMPLETE_ANSWER'));
});

test('late ChatGPT plan usage errors are sanitized and do not accept partial text', async () => {
  await assert.rejects(readChatGPTStream(stream([
    { type: 'response.output_text.delta', delta: 'Answer so far' },
    { type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'private-provider-payload' } } },
  ])), error => code('PROVIDER_LIMIT')(error) && !String(error).includes('private-provider-payload'));
  await assert.rejects(readChatGPTStream(stream([{ type: 'error', code: 'subscription_sharing_user_not_eligible' }])), code('CHATGPT_PLAN_UNAVAILABLE'));
});

test('bounded streams cancel their reader and reject overly long output', async () => {
  await assert.rejects(readChatGPTStream(stream([completed('x'.repeat(30_001))], 4096)), code('INCOMPLETE_ANSWER'));
  let cancelled = false;
  const huge = new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(1_000_001))); }, cancel() { cancelled = true; } }));
  await assert.rejects(readChatGPTStream(huge), code('PROVIDER_RESPONSE_TOO_LARGE'));
  assert.equal(cancelled, true);
});
