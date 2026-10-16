import { getStore } from '../../../../server/db';
import { api, readJson } from '../../../../server/http';
import { updateTopicSchema } from '../../../../server/validation';
export const runtime = 'nodejs';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return api(request, async () => ({ topic: getStore().updateTopic((await context.params).id, updateTopicSchema.parse(await readJson(request))) })); }
