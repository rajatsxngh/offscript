import { getStore } from '../../../server/db';
import { aiConfigured } from '../../../server/ai';
import { api } from '../../../server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return api(request, () => getStore().workspace(aiConfigured())); }
