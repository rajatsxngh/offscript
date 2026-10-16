import { getStore } from '../../../../../server/db';
import { api } from '../../../../../server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { return api(request, async () => ({ revisions: getStore().history((await context.params).id) })); }
