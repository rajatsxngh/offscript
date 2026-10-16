import { getStore } from '../../../server/db';
import { api, readJson } from '../../../server/http';
import { createTopicSchema } from '../../../server/validation';
export const runtime = 'nodejs';
export async function POST(request: Request) { return api(request, async () => ({ topic: getStore().createTopic(createTopicSchema.parse(await readJson(request))) })); }
