import { getStore } from '../../../../server/db';
import { api } from '../../../../server/http';
export const runtime = 'nodejs';
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { return api(request, async () => getStore().deleteNotebook((await context.params).id)); }
