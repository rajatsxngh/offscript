import { getStore } from '../../../server/db';
import { askTutor } from '../../../server/ai';
import { api, readJson } from '../../../server/http';
export const runtime = 'nodejs';
export const maxDuration = 65;
export async function POST(request: Request) { return api(request, async () => askTutor(getStore(), await readJson(request), request.signal)); }
