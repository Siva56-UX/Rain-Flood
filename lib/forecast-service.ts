import {
  getArea,
  upcomingDates,
  parseDaily,
  MAX_AGE_MS,
  type Forecast,
  type Source,
} from "./resident-model.ts";
type Cache = { raw: unknown; fetchedAt: string };
export function createForecastService(
  fetcher: typeof fetch = fetch,
  clock = () => new Date(),
) {
  const cache = new Map<string, Cache>();
  const pending = new Map<string, Promise<Cache>>();
  const retryAfter = new Map<string, number>();
  async function load(
    key: string,
    url: string,
    kind: "weather" | "river",
    dates: string[],
  ) {
    const now = +clock();
    const saved = cache.get(key);
    let entry = saved;
    let stale = false;
    if (!saved || now - Date.parse(saved.fetchedAt) >= 15 * 60000) {
      try {
        if ((retryAfter.get(key) ?? 0) > now) throw new Error("retry cooldown");
        if (!pending.has(key))
          pending.set(
            key,
            (async () => {
              const res = await fetcher(url, {
                signal: AbortSignal.timeout(10000),
                cache: "no-store",
                redirect: "error",
              });
              if (!res.ok) throw new Error(`upstream HTTP ${res.status}`);
              const raw = await res.json();
              const parsed = parseDaily(raw, dates, kind);
              if (
                !parsed.some((d) =>
                  kind === "weather"
                    ? d.rainMm != null || d.rainChance != null
                    : d.flow != null,
                )
              )
                throw new Error("missing forecast");
              const result = { raw, fetchedAt: clock().toISOString() };
              cache.set(key, result);
              return result;
            })(),
          );
        entry = await pending.get(key)!;
      } catch (error) {
        // Log only the source type and error category, never URLs, credentials or response bodies.
        console.warn('Forecast source unavailable', kind, error instanceof Error ? error.name : 'UnknownError');
        retryAfter.set(key, now + 60000);
        stale = true;
      } finally {
        pending.delete(key);
      }
    }
    if (
      !entry ||
      now - Date.parse(entry.fetchedAt) > MAX_AGE_MS ||
      now < Date.parse(entry.fetchedAt) - 60000
    )
      entry = undefined;
    const rows = parseDaily(entry?.raw, dates, kind);
    const complete = rows.every((d) =>
      kind === "weather"
        ? d.rainMm != null && d.rainChance != null
        : d.flow != null,
    );
    const any = rows.some((d) =>
      kind === "weather"
        ? d.rainMm != null || d.rainChance != null
        : d.flow != null,
    );
    const source: Source = {
      state: !any
        ? "unavailable"
        : stale
          ? "stale"
          : complete
            ? "available"
            : "partial",
      fetchedAt: entry?.fetchedAt ?? null,
      modelIssuedAt: null,
      url:
        kind === "weather"
          ? "https://open-meteo.com/en/docs"
          : "https://open-meteo.com/en/docs/flood-api",
      calendar: kind === "weather" ? "Asia/Bangkok" : "UTC",
    };
    return { rows, source };
  }
  return async (areaId: string): Promise<Forecast> => {
    const area = getArea(areaId);
    if (!area) throw new Error("invalid area");
    const now = clock();
    const dates = upcomingDates(now);
    const base = {
      latitude: String(area.latitude),
      longitude: String(area.longitude),
      start_date: dates[0],
      end_date: dates[6],
    };
    const weatherQuery = new URLSearchParams({
      ...base,
      timezone: "Asia/Bangkok",
      daily: "precipitation_sum,precipitation_probability_max",
    });
    const riverQuery = new URLSearchParams({
      ...base,
      daily: "river_discharge_mean,river_discharge_p25,river_discharge_p75",
    });
    const [weather, river] = await Promise.all([
      load(
        `${areaId}:weather`,
        `https://api.open-meteo.com/v1/forecast?${weatherQuery}`,
        "weather",
        dates,
      ),
      load(
        `${areaId}:river`,
        `https://flood-api.open-meteo.com/v1/flood?${riverQuery}`,
        "river",
        dates,
      ),
    ]);
    return {
      areaId,
      days: dates.map((date, i) => ({
        date,
        rainMm: null,
        rainChance: null,
        flow: null,
        flowLow: null,
        flowHigh: null,
        ...weather.rows[i],
        ...river.rows[i],
      })),
      weather: weather.source,
      river: river.source,
      floodRisk: "unknown",
      generatedAt: now.toISOString(),
    };
  };
}
export const getForecast = createForecastService();
