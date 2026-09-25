import { getArea } from "./resident-model.ts";
export type OfficialAlert = {
  id: string;
  areaId: string;
  level: string;
  text: string;
  sourceName: string;
  sourceUrl: string;
  issuedAt: string;
  expiresAt: string;
};
export type AlertResult = {
  state: "available" | "unconfigured" | "unavailable";
  checkedAt: string | null;
  alerts: OfficialAlert[];
};
// Operators must verify the publisher and feed before setting the URL. No arbitrary client URLs.
export function officialUrl(value: unknown) {
  try {
    if (typeof value !== "string") return false;
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443") &&
      [
        "disaster.go.th",
        "tmd.go.th",
        "rid.go.th",
        "thaiwater.net",
        "singburi.go.th",
      ].some((host) => u.hostname === host || u.hostname.endsWith("." + host))
    );
  } catch {
    return false;
  }
}
export function parseAlerts(
  raw: unknown,
  areaId: string,
  now = Date.now(),
): OfficialAlert[] {
  if (
    !raw ||
    typeof raw !== "object" ||
    !Array.isArray((raw as { alerts?: unknown }).alerts)
  )
    throw new Error("invalid feed");
  const seen = new Set<string>();
  return (raw as { alerts: unknown[] }).alerts
    .filter((item): item is OfficialAlert => {
      if (!item || typeof item !== "object") return false;
      const a = item as OfficialAlert;
      const issued = Date.parse(a.issuedAt),
        expires = Date.parse(a.expiresAt);
      const valid =
        ["id", "text", "sourceName"].every(
          (key) =>
            typeof a[key as keyof OfficialAlert] === "string" &&
            a[key as keyof OfficialAlert].trim().length > 0 &&
            a[key as keyof OfficialAlert].length <= 2000,
        ) &&
        a.areaId === areaId &&
        ["watch", "warning", "flood_report", "resolved"].includes(a.level) &&
        officialUrl(a.sourceUrl) &&
        Number.isFinite(issued) &&
        Number.isFinite(expires) &&
        issued <= now &&
        now - issued <= 6 * 3600000 &&
        expires > now &&
        expires > issued &&
        !seen.has(a.id);
      if (valid) seen.add(a.id);
      return valid;
    })
    .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt))
    .slice(0, 20);
}
export function createAlertService(
  fetcher: typeof fetch = fetch,
  clock = () => Date.now(),
) {
  let cached: { url: string; raw: unknown; at: number } | undefined;
  let pending: Promise<unknown> | undefined;
  let retryAfter = 0;
  return async (areaId: string, feedUrl?: string): Promise<AlertResult> => {
    if (!getArea(areaId)) throw new Error("invalid area");
    if (!feedUrl) return { state: "unconfigured", checkedAt: null, alerts: [] };
    if (!officialUrl(feedUrl))
      return { state: "unavailable", checkedAt: null, alerts: [] };
    try {
      if (!cached || cached.url !== feedUrl || clock() - cached.at >= 60000) {
        if (clock() < retryAfter) throw new Error("retry cooldown");
        if (!pending)
          pending = (async () => {
            const res = await fetcher(feedUrl, {
              signal: AbortSignal.timeout(8000),
              cache: "no-store",
              redirect: "error",
            });
            if (!res.ok) throw new Error("unavailable");
            const body = await res.text();
            if (body.length > 500000) throw new Error("oversized feed");
            const raw = JSON.parse(body);
            parseAlerts(raw, areaId, clock());
            cached = { url: feedUrl, raw, at: clock() };
            return raw;
          })();
        await pending;
      }
      return {
        state: "available",
        checkedAt: new Date(cached!.at).toISOString(),
        alerts: parseAlerts(cached!.raw, areaId, clock()),
      };
    } catch {
      retryAfter = clock() + 60000;
      return { state: "unavailable", checkedAt: null, alerts: [] };
    } finally {
      pending = undefined;
    }
  };
}
export const getOfficialAlerts = createAlertService();
