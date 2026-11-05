import { api } from '@/server/http';
import { cancelChatGPTSignIn, getChatGPTSignInStatus, startChatGPTSignIn } from '@/server/chatgpt-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return api(request, () => {
    const { authorizationUrl, cookie } = startChatGPTSignIn(request);
    return Response.json({ authorizationUrl }, { headers: { 'Set-Cookie': cookie } });
  });
}
export async function GET(request: Request) {
  return api(request, () => getChatGPTSignInStatus(request));
}
export async function DELETE(request: Request) {
  return api(request, () => {
    const result = cancelChatGPTSignIn(request);
    return Response.json(result, { headers: { 'Set-Cookie': 'offscript_chatgpt_flow=; Path=/api/ai/chatgpt; HttpOnly; SameSite=Lax; Max-Age=0' } });
  });
}
