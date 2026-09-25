import test from "node:test";
import assert from "node:assert/strict";
import {
  upcomingDates,
  parseDaily,
  visibleDays,
  sourceIsUsable,
  flowTrend,
  rainSummary,
} from "../lib/resident-model.ts";
import { createForecastService } from "../lib/forecast-service.ts";
import {
  officialUrl,
  parseAlerts,
  createAlertService,
} from "../lib/official-alerts.ts";

// Synthetic fixtures for tests only. Never imported by production code.
const start = new Date("2026-09-25T08:00:00Z");
const dates = upcomingDates(start);
function fixture(kind, days = dates) {
  return kind === "weather"
    ? {
        daily_units: {
          precipitation_sum: "mm",
          precipitation_probability_max: "%",
        },
        daily: {
          time: days,
          precipitation_sum: days.map(() => 12),
          precipitation_probability_max: days.map(() => 60),
        },
      }
    : {
        daily_units: {
          river_discharge_mean: "m³/s",
          river_discharge_p25: "m³/s",
          river_discharge_p75: "m³/s",
        },
        daily: {
          time: days,
          river_discharge_mean: days.map(() => 100),
          river_discharge_p25: days.map(() => 80),
          river_discharge_p75: days.map(() => 120),
        },
      };
}
test("seven future dates use Bangkok midnight and handle month/year boundaries", () => {
  assert.equal(
    upcomingDates(new Date("2026-12-31T16:59:00Z"))[0],
    "2027-01-01",
  );
  assert.equal(
    upcomingDates(new Date("2026-12-31T17:00:00Z"))[0],
    "2027-01-02",
  );
  assert.equal(dates.length, 7);
  assert.equal(dates[6], "2026-10-02");
});
test("missing, string, negative, infinite, invalid probabilities and wrong units remain unknown", () => {
  const f = fixture("weather");
  f.daily.precipitation_sum = [null, "12", -1, Infinity, 0, 10];
  f.daily.precipitation_probability_max = [null, 101, -1, NaN, 0, 100];
  const parsed = parseDaily(f, dates, "weather");
  assert.deepEqual(
    parsed.map((x) => x.rainMm),
    [null, null, null, null, 0, 10, null],
  );
  assert.deepEqual(
    parsed.map((x) => x.rainChance),
    [null, null, null, null, 0, 100, null],
  );
  f.daily_units.precipitation_sum = "inch";
  assert.ok(parseDaily(f, dates, "weather").every((x) => x.rainMm === null));
});
test("dates align by key, missing days and duplicate days cannot shift a forecast", () => {
  const f = fixture("weather");
  f.daily.time = [dates[2], dates[0], dates[0]];
  const rows = parseDaily(f, dates, "weather");
  assert.equal(rows[0].rainMm, null);
  assert.equal(rows[1].rainMm, null);
  assert.equal(rows[2].rainMm, 12);
});
test("invalid ensemble range is withheld and missing flow never implies decline", () => {
  const f = fixture("river");
  f.daily.river_discharge_p25[0] = 200;
  const first = parseDaily(f, dates, "river")[0];
  assert.equal(first.flow, 100);
  assert.equal(first.flowLow, null);
  assert.equal(first.flowHigh, null);
  assert.equal(flowTrend(null, 100), "ยังเปรียบเทียบไม่ได้");
  assert.equal(flowTrend(0, 0), "ใกล้เคียงวันก่อน");
  assert.equal(flowTrend(0, 100), "น้อยกว่าวันก่อน");
});
test("weather and river failures are independent; area is validated before any network call", async () => {
  let calls = 0;
  const service = createForecastService(
    async (url) => {
      calls++;
      if (String(url).includes("flood-api")) throw Error("offline");
      return Response.json(fixture("weather"));
    },
    () => start,
  );
  await assert.rejects(() => service("invalid"));
  assert.equal(calls, 0);
  const result = await service("1701");
  assert.equal(result.weather.state, "available");
  assert.equal(result.river.state, "unavailable");
  assert.equal(result.floodRisk, "unknown");
  assert.ok(result.days.every((d) => d.flow === null));
});
test("concurrent requests share fetch, cache remains per district, stale data expires without synthetic fallback", async () => {
  let now = +start,
    calls = 0,
    fail = false;
  const service = createForecastService(
    async (url) => {
      calls++;
      if (fail) throw Error("offline");
      return Response.json(
        fixture(String(url).includes("flood-api") ? "river" : "weather"),
      );
    },
    () => new Date(now),
  );
  await Promise.all([service("1701"), service("1701")]);
  assert.equal(calls, 2);
  await service("1702");
  assert.equal(calls, 4);
  now += 16 * 60000;
  fail = true;
  const stale = await service("1701");
  assert.equal(stale.weather.state, "stale");
  assert.equal(stale.weather.fetchedAt, start.toISOString());
  now = +start + 7 * 3600000;
  const expired = await service("1701");
  assert.equal(expired.weather.state, "unavailable");
  assert.ok(expired.days.every((d) => d.rainMm === null));
});
test("open page suppresses expired forecasts and removes yesterday after midnight", async () => {
  const service = createForecastService(
    async (url) =>
      Response.json(
        fixture(String(url).includes("flood-api") ? "river" : "weather"),
      ),
    () => start,
  );
  const result = await service("1701");
  assert.ok(
    visibleDays(result, new Date(+start + 7 * 3600000)).every(
      (d) => d.rainMm === null,
    ),
  );
  assert.equal(
    visibleDays(result, new Date("2026-09-25T17:01:00Z"))[0].date,
    "2026-09-27",
  );
  assert.equal(
    sourceIsUsable(
      { state: "available", fetchedAt: "2027-01-01T00:00:00Z" },
      +start,
    ),
    false,
  );
});
test("partial summary does not claim complete seven day coverage or flood safety", () => {
  const summary = rainSummary([{ date: dates[0], rainMm: 0 }]);
  assert.match(summary, /1 วันที่ได้รับ/);
  assert.doesNotMatch(summary, /ปลอดภัย|ไม่มีน้ำท่วม/);
});
const alert = {
  id: "test-only",
  areaId: "1701",
  level: "warning",
  text: "TEST ONLY",
  sourceName: "Test",
  sourceUrl: "https://sbr.disaster.go.th/ddpmsing/home",
  issuedAt: "2026-09-25T07:00:00Z",
  expiresAt: "2026-09-25T09:00:00Z",
};
test("official alerts require correct area, allowed HTTPS origin, current issue/expiry, known level and unique ID", () => {
  const variants = [
    alert,
    alert,
    { ...alert, id: "wrong-area", areaId: "1702" },
    { ...alert, id: "expired", expiresAt: start.toISOString() },
    { ...alert, id: "future", issuedAt: "2026-09-25T08:01:00Z" },
    { ...alert, id: "url", sourceUrl: "https://disaster.go.th.evil.test/" },
    { ...alert, id: "level", level: "safe" },
  ];
  assert.deepEqual(parseAlerts({ alerts: variants }, "1701", +start), [alert]);
  assert.equal(officialUrl("http://sbr.disaster.go.th"), false);
  assert.equal(officialUrl("https://user:password@disaster.go.th"), false);
  assert.equal(officialUrl("https://127.0.0.1"), false);
});
test("unconfigured/failed feeds never become all clear; failed feed does not reuse old warning", async () => {
  let fail = false,
    now = +start,
    calls = 0;
  const service = createAlertService(
    async () => {
      calls++;
      if (fail) throw Error("offline");
      return Response.json({ alerts: [alert] });
    },
    () => now,
  );
  assert.equal((await service("1701")).state, "unconfigured");
  assert.equal(calls, 0);
  assert.equal(
    (await service("1701", "https://localhost/feed")).state,
    "unavailable",
  );
  assert.equal(calls, 0);
  assert.equal(
    (await service("1701", "https://sbr.disaster.go.th/feed")).alerts.length,
    1,
  );
  now += 61000;
  fail = true;
  const result = await service("1701", "https://sbr.disaster.go.th/feed");
  assert.equal(result.state, "unavailable");
  assert.equal(result.alerts.length, 0);
});
