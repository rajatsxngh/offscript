import { completeChatGPTSignIn } from '@/server/chatgpt-auth';
import { selectAIProvider } from '@/server/ai-settings';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';

function page(title: string, message: string, status = 200) {
  // Only fixed application text is rendered; callback and provider values never enter HTML.
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body><main><h1>${title}</h1><p>${message}</p><p>You can close this window and return to Offscript.</p></main></body></html>`, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  });
}

export async function GET(request: Request) {
  // OAuth is a cross-site browser navigation. The helper applies its own narrow
  // loopback, exact callback, state, one-use transaction and browser-cookie checks.
  try {
    const connection = await completeChatGPTSignIn(request);
    if (connection.ready) {
      selectAIProvider({ provider: 'chatgpt' });
      return page('ChatGPT connected', 'Offscript is ready to use your eligible ChatGPT plan.');
    }
    return page('ChatGPT signed in', 'Your identity was verified. Enable plan usage and choose an available model in Offscript settings to continue.');
  } catch (error) {
    return page('ChatGPT connection incomplete', 'Return to Offscript settings to review the connection and start sign-in again.', error instanceof AppError ? error.status : 500);
  }
}
