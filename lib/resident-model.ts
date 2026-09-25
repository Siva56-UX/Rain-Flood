export const AREAS = [
  { id: "1701", name: "เมืองสิงห์บุรี", latitude: 14.89, longitude: 100.4 },
  { id: "1702", name: "บางระจัน", latitude: 14.89, longitude: 100.32 },
  { id: "1703", name: "ค่ายบางระจัน", latitude: 14.8, longitude: 100.31 },
  { id: "1704", name: "พรหมบุรี", latitude: 14.78, longitude: 100.45 },
  { id: "1705", name: "ท่าช้าง", latitude: 14.78, longitude: 100.39 },
  { id: "1706", name: "อินทร์บุรี", latitude: 15.0, longitude: 100.33 },
] as const;
// Approximate district reference points, not validated river stations or flood boundaries.
export type Area = (typeof AREAS)[number];
export type SourceState = "available" | "partial" | "stale" | "unavailable";
export type Source = {
  state: SourceState;
  fetchedAt: string | null;
  url: string;
  modelIssuedAt: null;
  calendar: string;
};
export type Day = {
  date: string;
  rainMm: number | null;
  rainChance: number | null;
  flow: number | null;
  flowLow: number | null;
  flowHigh: number | null;
};
export type Forecast = {
  areaId: string;
  days: Day[];
  weather: Source;
  river: Source;
  floodRisk: "unknown";
  generatedAt: string;
};
export const MAX_AGE_MS = 6 * 60 * 60 * 1000;
export const getArea = (id: string) => AREAS.find((a) => a.id === id);
export function thaiDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function upcomingDates(now = new Date()): string[] {
  const start = Date.parse(`${thaiDateKey(now)}T00:00:00+07:00`);
  return Array.from({ length: 7 }, (_, i) =>
    thaiDateKey(new Date(start + (i + 1) * 86400000)),
  );
}
export const finiteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
type Raw = {
  daily?: Record<string, unknown>;
  daily_units?: Record<string, unknown>;
};
export function parseDaily(
  raw: unknown,
  dates: string[],
  kind: "weather" | "river",
): Partial<Day>[] {
  if (!raw || typeof raw !== "object") return dates.map((date) => ({ date }));
  const { daily, daily_units: units } = raw as Raw;
  const times = Array.isArray(daily?.time) ? daily.time : [];
  const read = (key: string, index: number, unit: string) => {
    if (index < 0 || units?.[key] !== unit || !Array.isArray(daily?.[key]))
      return null;
    return finiteNumber(daily[key][index]);
  };
  return dates.map((date) => {
    const index = times.indexOf(date);
    // Duplicate days are ambiguous. Do not silently choose one.
    const i = times.lastIndexOf(date) === index ? index : -1;
    if (kind === "weather") {
      const chance = read("precipitation_probability_max", i, "%");
      return {
        date,
        rainMm: read("precipitation_sum", i, "mm"),
        rainChance: chance !== null && chance <= 100 ? chance : null,
      };
    }
    const low = read("river_discharge_p25", i, "m³/s");
    const high = read("river_discharge_p75", i, "m³/s");
    const validRange = low !== null && high !== null && low <= high;
    return {
      date,
      flow: read("river_discharge_mean", i, "m³/s"),
      flowLow: validRange ? low : null,
      flowHigh: validRange ? high : null,
    };
  });
}
export function sourceIsUsable(source: Source, now = Date.now()) {
  const age = now - Date.parse(source.fetchedAt ?? "");
  return (
    source.state !== "unavailable" &&
    Number.isFinite(age) &&
    age >= -60000 &&
    age <= MAX_AGE_MS
  );
}
export function visibleDays(data: Forecast | null, now = new Date()): Day[] {
  const dates = upcomingDates(now);
  return dates.map((date) => {
    const day = data?.days.find((d) => d.date === date);
    const weather = !!data && sourceIsUsable(data.weather, +now);
    const river = !!data && sourceIsUsable(data.river, +now);
    return {
      date,
      rainMm: weather ? (day?.rainMm ?? null) : null,
      rainChance: weather ? (day?.rainChance ?? null) : null,
      flow: river ? (day?.flow ?? null) : null,
      flowLow: river ? (day?.flowLow ?? null) : null,
      flowHigh: river ? (day?.flowHigh ?? null) : null,
    };
  });
}
export function flowTrend(current: number | null, previous: number | null) {
  if (current === null || previous === null) return "ยังเปรียบเทียบไม่ได้";
  if (
    current === previous ||
    (previous > 0 && Math.abs(current - previous) / previous < 0.01)
  )
    return "ใกล้เคียงวันก่อน";
  return current > previous ? "มากกว่าวันก่อน" : "น้อยกว่าวันก่อน";
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${date}T12:00:00+07:00`));
}
export function timeLabel(iso: string | null) {
  return iso && Number.isFinite(Date.parse(iso))
    ? new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Bangkok",
      }).format(new Date(iso)) + " น."
    : "ยังไม่ได้รับข้อมูล";
}
export function rainSummary(days: Day[]) {
  const available = days.filter((d) => d.rainMm !== null);
  if (!available.length) return "ยังไม่มีพยากรณ์ฝน โปรดลองโหลดข้อมูลอีกครั้ง";
  const max = available.reduce((a, b) => (b.rainMm! > a.rainMm! ? b : a));
  const prefix =
    available.length === 7
      ? "ใน 7 วันข้างหน้า"
      : `จากข้อมูลฝน ${available.length} วันที่ได้รับ`;
  return `${prefix} คาดว่าฝนมากที่สุด ${dateLabel(max.date)} ประมาณ ${max.rainMm!.toLocaleString("th-TH", { maximumFractionDigits: 1 })} มม. พยากรณ์อาจเปลี่ยนได้`;
}
