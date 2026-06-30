import { getWorldCupMatch } from "../../lib/world-cup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const match = await getWorldCupMatch();

  return Response.json({ match });
}
