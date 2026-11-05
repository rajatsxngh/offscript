import { api } from '@/server/http';
import { disconnectChatGPT } from '@/server/chatgpt-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return api(request, () => disconnectChatGPT());
}
