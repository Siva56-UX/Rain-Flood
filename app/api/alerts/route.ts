import { getArea } from "@/lib/resident-model";
import { getOfficialAlerts } from "@/lib/official-alerts";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const area = new URL(request.url).searchParams.get("area") ?? "";
  if (!getArea(area))
    return Response.json({ error: "กรุณาเลือกอำเภอ" }, { status: 400 });
  return Response.json(
    await getOfficialAlerts(area, process.env.OFFICIAL_ALERT_FEED_URL),
    { headers: { "Cache-Control": "no-store" } },
  );
}
