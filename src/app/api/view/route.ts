import { getStore } from '../../../server/db';
import { api, readJson } from '../../../server/http';
import { viewSchema } from '../../../server/validation';
export const runtime = 'nodejs';
export async function POST(request: Request) { return api(request, async () => getStore().selectTopic(viewSchema.parse(await readJson(request)).topicId)); }
