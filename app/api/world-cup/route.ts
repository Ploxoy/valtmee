import { getWorldCupData } from "../../lib/world-cup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const worldCup = await getWorldCupData();

  return Response.json({ worldCup });
}
