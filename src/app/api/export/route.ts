import { getStore } from '../../../server/db';
import { exportNotebook } from '../../../server/export';
import { api } from '../../../server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return api(request, () => {
    const query = new URL(request.url).searchParams;
    return exportNotebook(getStore(), query.get('notebookId') || '', query.get('format') || 'json');
  });
}
