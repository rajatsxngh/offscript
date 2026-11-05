import { getAISettings, saveAPIKeyAndSelect, selectAIProvider } from '../../../../server/ai-settings';
import { api, readJson } from '../../../../server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return api(request, () => getAISettings());
}

export async function POST(request: Request) {
  return api(request, async () => saveAPIKeyAndSelect(await readJson(request), request.signal));
}

export async function PATCH(request: Request) {
  return api(request, async () => selectAIProvider(await readJson(request)));
}
