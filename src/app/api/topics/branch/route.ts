import { getStore } from '../../../../server/db';
import { api, readJson } from '../../../../server/http';
import { branchQuestionSchema } from '../../../../server/validation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return api(request, async () => getStore().branchFromQuestion(branchQuestionSchema.parse(await readJson(request))));
}
