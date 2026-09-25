import { getArea } from "@/lib/resident-model";
import { getForecast } from "@/lib/forecast-service";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const area = new URL(request.url).searchParams.get("area") ?? "";
  if (!getArea(area))
    return Response.json(
      { error: "กรุณาเลือกอำเภอในจังหวัดสิงห์บุรี" },
      { status: 400 },
    );
  return Response.json(await getForecast(area), {
    headers: { "Cache-Control": "no-store" },
  });
}
