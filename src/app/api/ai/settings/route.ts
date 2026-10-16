import { getAISettings, saveAIConnection } from '../../../../server/ai-config';
import { api, readJson } from '../../../../server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return api(request, () => getAISettings());
}

export async function POST(request: Request) {
  return api(request, async () => saveAIConnection(await readJson(request), { signal: request.signal }));
}
