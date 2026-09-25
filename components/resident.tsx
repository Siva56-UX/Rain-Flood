"use client";
import { useEffect, useRef, useState } from "react";
import {
  CloudRain,
  Waves,
  Volume2,
  Square,
  Phone,
  RefreshCw,
  MapPin,
  ArrowUpRight,
  Info,
  ChevronDown,
  CalendarDays,
  TextSelect,
} from "lucide-react";
import {
  AREAS,
  getArea,
  visibleDays,
  dateLabel,
  timeLabel,
  rainSummary,
  flowTrend,
  sourceIsUsable,
  type Forecast,
  type Source,
} from "@/lib/resident-model";
import type { AlertResult } from "@/lib/official-alerts";

const format = (n: number | null, suffix = "") =>
  n === null
    ? "ยังไม่มีข้อมูล"
    : `${n.toLocaleString("th-TH", { maximumFractionDigits: 1 })}${suffix}`;
const EMPTY_ALERTS: AlertResult = {
  state: "unconfigured",
  checkedAt: null,
  alerts: [],
};
const alertNames: Record<string, string> = {
  watch: "ประกาศเฝ้าระวัง",
  warning: "ประกาศเตือน",
  flood_report: "รายงานน้ำท่วม",
  resolved: "ประกาศคลี่คลาย",
};
function SourceStatus({
  label,
  source,
  now,
}: {
  label: string;
  source?: Source;
  now: number;
}) {
  const usable = source && sourceIsUsable(source, now);
  return (
    <p className="source-status">
      <strong>{label}</strong> ·{" "}
      {!usable
        ? "ยังไม่ได้รับข้อมูลที่ใช้ได้"
        : `${source.state === "stale" ? "ข้อมูลเก่า — โหลดใหม่ไม่สำเร็จ · " : source.state === "partial" ? "ข้อมูลบางวันไม่ครบ · " : ""}ดึงข้อมูล ${timeLabel(source.fetchedAt)}`}
    </p>
  );
}
export default function Resident() {
  const [areaId, setAreaId] = useState("");
  const [large, setLarge] = useState(false);
  const [data, setData] = useState<Forecast | null>(null);
  const [alerts, setAlerts] = useState<AlertResult>(EMPTY_ALERTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState<Date | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const selected = getArea(areaId);
  const current = data?.areaId === areaId ? data : null;
  const days = now ? visibleDays(current, now) : [];
  const activeAlerts =
    now && alerts.checkedAt && +now - Date.parse(alerts.checkedAt) < 5 * 60000
      ? alerts.alerts.filter(
          (a) =>
            a.areaId === areaId &&
            Date.parse(a.expiresAt) > +now &&
            +now - Date.parse(a.issuedAt) <= 6 * 3600000,
        )
      : [];
  const summary = rainSummary(days);
  const urgent = activeAlerts.some(
    (a) => a.level === "warning" || a.level === "flood_report",
  );

  function stopSpeech() {
    if (typeof window !== "undefined" && "speechSynthesis" in window)
      window.speechSynthesis.cancel();
    setSpeaking(false);
  }
  useEffect(() => {
    setNow(new Date());
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
    try {
      const saved = localStorage.getItem("rain-flood-area");
      if (saved && getArea(saved)) setAreaId(saved);
      setLarge(localStorage.getItem("rain-flood-large") === "true");
    } catch {
      /* preferences are optional */
    }
    const tick = window.setInterval(() => setNow(new Date()), 30000);
    return () => {
      clearInterval(tick);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.large = String(large);
  }, [large]);
  useEffect(() => {
    if (!areaId) return;
    const timer = window.setInterval(() => setAttempt((x) => x + 1), 60000);
    return () => clearInterval(timer);
  }, [areaId]);
  useEffect(() => {
    if (!areaId) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 14000);
    let alive = true;
    setLoading(true);
    setError("");
    async function read<T>(url: string): Promise<T> {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("unavailable");
      return response.json() as Promise<T>;
    }
    Promise.allSettled([
      read<Forecast>(`/api/forecast?area=${areaId}`),
      read<AlertResult>(`/api/alerts?area=${areaId}`),
    ]).then((results) => {
      if (!alive) return;
      clearTimeout(timeout);
      const [forecast, notices] = results;
      if (
        forecast.status === "fulfilled" &&
        forecast.value.areaId === areaId &&
        Array.isArray(forecast.value.days)
      )
        setData(forecast.value);
      else {
        setError("โหลดพยากรณ์ใหม่ไม่สำเร็จ กรุณาลองอีกครั้ง");
        setData((old) =>
          old?.areaId === areaId
            ? {
                ...old,
                weather: { ...old.weather, state: "stale" },
                river: { ...old.river, state: "stale" },
              }
            : null,
        );
      }
      setAlerts(
        notices.status === "fulfilled"
          ? notices.value
          : { state: "unavailable", checkedAt: null, alerts: [] },
      );
      setNow(new Date());
      setLoading(false);
    });
    return () => {
      alive = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [areaId, attempt]);
  function changeArea(id: string) {
    stopSpeech();
    setSpeechMessage("");
    setData(null);
    setAlerts(EMPTY_ALERTS);
    setError("");
    setAreaId(id);
    try {
      localStorage.setItem("rain-flood-area", id);
    } catch {
      /* usable without storage */
    }
  }
  function toggleLarge() {
    const next = !large;
    setLarge(next);
    try {
      localStorage.setItem("rain-flood-large", String(next));
    } catch {
      /* usable without storage */
    }
  }
  function speak() {
    stopSpeech();
    if (!("speechSynthesis" in window)) {
      setSpeechMessage(
        "อุปกรณ์นี้ไม่รองรับเสียงอ่าน สามารถขยายตัวหนังสือเพื่ออ่านได้",
      );
      return;
    }
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith("th"));
    if (!voice) {
      setSpeechMessage(
        "ยังไม่พบเสียงภาษาไทยในอุปกรณ์ กรุณาเปิดเสียงภาษาไทยในการตั้งค่าเครื่อง หรืออ่านสรุปด้านล่าง",
      );
      return;
    }
    const text = `อำเภอ${selected?.name} จังหวัดสิงห์บุรี ยังยืนยันน้ำท่วมรายบ้านไม่ได้ ${summary} ${current?.weather.state === "stale" ? "ข้อมูลฝนนี้เป็นข้อมูลเก่า " : ""}${activeAlerts.map((a) => `${alertNames[a.level]} จาก ${a.sourceName} ${a.text}`).join(" ")} หากต้องการความช่วยเหลือด้านสาธารณภัย โทร หนึ่ง เจ็ด แปด สี่`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = "th-TH";
    utterance.rate = 0.85;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setSpeechMessage(
        "เสียงอ่านหยุดทำงาน กรุณากดฟังอีกครั้ง หรืออ่านสรุปด้านล่าง",
      );
    };
    speechRef.current = utterance;
    setSpeaking(true);
    setSpeechMessage("กำลังอ่านสรุป");
    window.speechSynthesis.speak(utterance);
  }
  return (
    <>
      <a className="skip" href="#main">
        ข้ามไปเนื้อหา
      </a>
      <header className="header">
        <div className="shell header-inner">
          <a
            className="brand"
            href="/"
            aria-label="สิงห์บุรี เฝ้าระวังน้ำ หน้าแรก"
          >
            <Waves aria-hidden="true" />
            <span>
              สิงห์บุรี <strong>เฝ้าระวังน้ำ</strong>
            </span>
          </a>
          <button
            className="text-button"
            onClick={toggleLarge}
            aria-pressed={large}
          >
            <TextSelect aria-hidden="true" />
            {large ? "ตัวหนังสือปกติ" : "ขยายตัวหนังสือ"}
          </button>
        </div>
      </header>
      <main id="main" className="shell">
        <section className="intro" aria-labelledby="title">
          <p className="eyebrow">ข้อมูลสำหรับประชาชน</p>
          <h1 id="title">
            ติดตามฝนและน้ำ
            <br className="mobile-break" /> ในพื้นที่ของคุณ
          </h1>
          <p>เลือกอำเภอ ดูแนวโน้ม 7 วัน และติดตามประกาศทางการ</p>
        </section>
        <section className="area-bar" aria-label="เลือกพื้นที่">
          <div className="area-control">
            <MapPin aria-hidden="true" />
            <div>
              <label htmlFor="area">อำเภอที่ต้องการติดตาม</label>
              <select
                id="area"
                value={areaId}
                onChange={(e) => changeArea(e.target.value)}
              >
                <option value="">เลือกอำเภอของคุณ</option>
                {AREAS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p>
            จำอำเภอไว้ในเครื่องนี้
            <br />
            ไม่ต้องสมัครสมาชิก
          </p>
          <button
            onClick={() => {
              stopSpeech();
              setAttempt((x) => x + 1);
            }}
            disabled={!areaId || loading}
          >
            <RefreshCw aria-hidden="true" />
            {loading ? "กำลังโหลด…" : "โหลดข้อมูลใหม่"}
          </button>
        </section>
        <p className="live-status" role="status">
          {error ||
            (loading
              ? `กำลังโหลดข้อมูลอำเภอ${selected?.name}`
              : selected
                ? `กำลังแสดงข้อมูลอำเภอ${selected.name}`
                : "กรุณาเลือกอำเภอเพื่อเริ่มดูข้อมูล")}
        </p>
        {!selected ? (
          <section className="empty-state">
            <MapPin size={36} aria-hidden="true" />
            <h2>เริ่มจากเลือกอำเภอด้านบน</h2>
            <p>ดูพยากรณ์ฝนและแนวโน้มน้ำได้โดยไม่ต้องให้ตำแหน่ง GPS</p>
          </section>
        ) : (
          <>
            <section className="overview" aria-labelledby="overview-title">
              <div className="overview-main">
                <p className="eyebrow">อำเภอ{selected.name}</p>
                <h2 id="overview-title">
                  {urgent ? (
                    "มีประกาศเตือนในพื้นที่"
                  ) : (
                    <>
                      ยังยืนยันน้ำท่วม
                      <br />
                      รายบ้านไม่ได้
                    </>
                  )}
                </h2>
                <p>
                  ใช้พยากรณ์เพื่อเตรียมตัว
                  และตรวจประกาศจากหน่วยงานในพื้นที่ประกอบ
                </p>
                <a href="#official" className="primary-link">
                  ดูประกาศทางการ <ArrowUpRight aria-hidden="true" />
                </a>
              </div>
              <div className="overview-details">
                <h3>
                  <CloudRain aria-hidden="true" /> สรุปฝน 7 วัน
                </h3>
                <p className="summary">
                  {loading && !current ? "กำลังโหลดพยากรณ์…" : summary}
                </p>
                <SourceStatus
                  label="พยากรณ์ฝน"
                  source={current?.weather}
                  now={now ? +now : 0}
                />
                <div className="speech-buttons">
                  <button onClick={speak} disabled={loading && !current}>
                    <Volume2 aria-hidden="true" />
                    {speaking ? "ฟังตั้งแต่ต้น" : "ฟังสรุปภาษาไทย"}
                  </button>
                  <button onClick={stopSpeech} disabled={!speaking}>
                    <Square aria-hidden="true" />
                    หยุดเสียง
                  </button>
                </div>
                <p role="status" className="speech-message">
                  {speechMessage}
                </p>
              </div>
            </section>
            <section
              id="forecast"
              className="section"
              aria-labelledby="forecast-title"
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">วางแผนล่วงหน้า</p>
                  <h2 id="forecast-title">
                    <CalendarDays aria-hidden="true" /> พยากรณ์ 7 วัน
                  </h2>
                </div>
                <span className="pill">วันพรุ่งนี้ถึงอีก 7 วัน</span>
              </div>
              <p className="section-note">
                โอกาสฝนเป็นโอกาสเกิดฝน ไม่ใช่โอกาสน้ำท่วม •
                วันที่ไกลออกไปอาจเปลี่ยนแปลงได้มากขึ้น
              </p>
              <ol className="forecast-grid">
                {days.map((day, i) => (
                  <li className="day-card" key={day.date}>
                    <div className="day-top">
                      <span>{i === 0 ? "พรุ่งนี้" : `อีก ${i + 1} วัน`}</span>
                      <CloudRain aria-hidden="true" />
                    </div>
                    <h3>{dateLabel(day.date)}</h3>
                    <p className="metric-label">โอกาสฝนสูงสุด</p>
                    <p
                      className={
                        day.rainChance === null ? "missing" : "rain-chance"
                      }
                    >
                      {format(day.rainChance, "%")}
                    </p>
                    <p className="rain-volume">
                      ปริมาณฝน
                      <br />
                      <strong>{format(day.rainMm, " มม.")}</strong>
                    </p>
                    <div className="river-daily">
                      <p>แนวโน้มปริมาณน้ำ*</p>
                      <strong>
                        {flowTrend(day.flow, i ? days[i - 1].flow : null)}
                      </strong>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="footnote">
                * ปริมาณน้ำไหลผ่านจุดอ้างอิงจากแบบจำลอง ไม่ใช่ระดับน้ำที่บ้าน
                วันแรกยังไม่มีวันก่อนหน้าในชุดนี้ให้เปรียบเทียบ
              </p>
              <details className="details">
                <summary>
                  ดูตัวเลขน้ำ แหล่งข้อมูล และข้อจำกัด{" "}
                  <ChevronDown aria-hidden="true" />
                </summary>
                <div className="details-body">
                  <p>
                    แบบจำลอง GloFAS ผ่าน Open-Meteo มีความละเอียดประมาณ 5 กม.
                    อาจเลือกสาขาแม่น้ำคลาดเคลื่อน
                    จุดอ้างอิงอำเภอนี้ยังไม่ได้ตรวจสอบกับสถานีจริง
                    จึงใช้ยืนยันน้ำท่วมทั้งอำเภอไม่ได้
                  </p>
                  <p>
                    พิกัดอ้างอิงโดยประมาณ: {selected.latitude},{" "}
                    {selected.longitude} · ข้อมูลฝนตามวันเวลาไทย
                    ส่วนข้อมูลน้ำตามวัน UTC จึงไม่ใช่ช่วงเวลา 24 ชั่วโมงเดียวกัน
                  </p>
                  <SourceStatus
                    label="แบบจำลองน้ำ"
                    source={current?.river}
                    now={now ? +now : 0}
                  />
                  <div
                    className="table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="ตารางปริมาณน้ำ เลื่อนแนวนอนได้"
                  >
                    <table>
                      <caption>ปริมาณน้ำไหล หน่วยลูกบาศก์เมตรต่อวินาที</caption>
                      <thead>
                        <tr>
                          <th scope="col">วันที่</th>
                          <th scope="col">ค่าเฉลี่ย</th>
                          <th scope="col">ช่วงกลางของแบบจำลอง</th>
                        </tr>
                      </thead>
                      <tbody>
                        {days.map((d) => (
                          <tr key={d.date}>
                            <th scope="row">{dateLabel(d.date)}</th>
                            <td>{format(d.flow)}</td>
                            <td>
                              {d.flowLow === null || d.flowHigh === null
                                ? "ยังไม่มีข้อมูล"
                                : `${format(d.flowLow)}–${format(d.flowHigh)}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p>
                    ช่วงกลางคือเปอร์เซ็นไทล์ 25–75 ของชุดแบบจำลอง
                    ไม่ใช่ช่วงรับประกันผลหรือความน่าจะเป็นน้ำท่วม คำว่า
                    “ใกล้เคียงวันก่อน” หมายถึงเปลี่ยนน้อยกว่า 1%
                  </p>
                  <p>
                    แสดงเวลาที่ดึงข้อมูล ไม่ใช่เวลาที่แบบจำลองออกผล เนื่องจาก
                    API นี้ไม่ส่งเวลาออกผลมา ข้อมูลที่ดึงไว้นานเกิน 6
                    ชั่วโมงจะไม่แสดงเป็นพยากรณ์
                  </p>
                  <div className="link-row">
                    <a
                      href="https://open-meteo.com/en/docs"
                      target="_blank"
                      rel="noreferrer"
                    >
                      แหล่งพยากรณ์ฝน ↗
                    </a>
                    <a
                      href="https://open-meteo.com/en/docs/flood-api"
                      target="_blank"
                      rel="noreferrer"
                    >
                      แหล่งแบบจำลองน้ำ ↗
                    </a>
                    <a
                      href="https://www.thaiwater.net/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      ดูข้อมูลสถานี ThaiWater ↗
                    </a>
                  </div>
                </div>
              </details>
            </section>
            <section
              id="official"
              className="section official"
              aria-labelledby="official-title"
            >
              <p className="eyebrow">ตรวจสอบก่อนตัดสินใจ</p>
              <h2 id="official-title">ประกาศจากหน่วยงาน</h2>
              {activeAlerts.length ? (
                activeAlerts.map((a) => (
                  <article
                    className={`alert-card ${a.level === "warning" || a.level === "flood_report" ? "urgent" : ""}`}
                    key={a.id}
                  >
                    <p className="alert-label">
                      {alertNames[a.level]} · {a.sourceName}
                    </p>
                    <h3>{a.text}</h3>
                    <p>
                      ประกาศ {timeLabel(a.issuedAt)} · สิ้นสุด{" "}
                      {timeLabel(a.expiresAt)}
                    </p>
                    <a href={a.sourceUrl} target="_blank" rel="noreferrer">
                      เปิดประกาศต้นฉบับ ↗
                    </a>
                  </article>
                ))
              ) : (
                <div className="notice">
                  <Info aria-hidden="true" />
                  <div>
                    <strong>
                      {loading
                        ? "กำลังตรวจสอบประกาศ"
                        : alerts.state === "unconfigured"
                          ? "ยังไม่ได้เชื่อมประกาศอัตโนมัติ"
                          : alerts.state === "unavailable"
                            ? "ขณะนี้โหลดประกาศไม่ได้"
                            : "ยังไม่มีประกาศที่แสดงได้ในระบบนี้"}
                    </strong>
                    <p>
                      การไม่มีประกาศในหน้านี้ไม่ได้หมายความว่าไม่มีน้ำท่วม
                      โปรดตรวจสอบกับหน่วยงานโดยตรง
                    </p>
                  </div>
                </div>
              )}
              <div className="link-row">
                <a
                  href="https://sbr.disaster.go.th/ddpmsing/home"
                  target="_blank"
                  rel="noreferrer"
                >
                  ปภ. จังหวัดสิงห์บุรี ↗
                </a>
                <a
                  href="https://www.tmd.go.th/"
                  target="_blank"
                  rel="noreferrer"
                >
                  กรมอุตุนิยมวิทยา ↗
                </a>
                <a
                  href="https://www.rid.go.th/"
                  target="_blank"
                  rel="noreferrer"
                >
                  กรมชลประทาน ↗
                </a>
              </div>
            </section>
          </>
        )}
        <section
          id="help"
          className="section help"
          aria-labelledby="help-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">เมื่อคุณต้องการความช่วยเหลือ</p>
              <h2 id="help-title">ติดต่อได้จากที่นี่</h2>
            </div>
            <Phone aria-hidden="true" />
          </div>
          <div className="help-grid">
            <a className="help-card" href="tel:1784">
              <span>แจ้งเหตุสาธารณภัย · ปภ.</span>
              <strong>
                1784 <ArrowUpRight aria-hidden="true" />
              </strong>
              <span>กดเพื่อโทร</span>
            </a>
            <a className="help-card" href="tel:1669">
              <span>เจ็บป่วยฉุกเฉิน</span>
              <strong>
                1669 <ArrowUpRight aria-hidden="true" />
              </strong>
              <span>กดเพื่อโทร</span>
            </a>
            <a className="help-card" href="tel:036507129">
              <span>ปภ. จังหวัดสิงห์บุรี</span>
              <strong className="local-phone">036-507-129</strong>
              <span>สอบถามสถานการณ์ในพื้นที่</span>
            </a>
          </div>
          <p>
            ก่อนโทร เตรียมชื่ออำเภอ ตำบล หมู่บ้าน จุดสังเกต
            และจำนวนผู้ที่ต้องการความช่วยเหลือ
          </p>
          <details className="details">
            <summary>
              เตรียมตัวอย่างไร และดูที่มาของหมายเลข{" "}
              <ChevronDown aria-hidden="true" />
            </summary>
            <div className="details-body">
              <ul>
                <li>
                  เตรียมยาประจำตัว เอกสารจำเป็น โทรศัพท์ และเบอร์ติดต่อคนใกล้ชิด
                </li>
                <li>
                  หากต้องการผู้ช่วยเคลื่อนย้าย
                  ให้ติดต่อคนใกล้ชิดหรือเจ้าหน้าที่ไว้ล่วงหน้า
                </li>
                <li>
                  หลีกเลี่ยงการเดินหรือขับรถผ่านน้ำท่วม
                  และปฏิบัติตามประกาศของเจ้าหน้าที่
                </li>
              </ul>
              <div className="link-row">
                <a
                  href="https://www.disaster.go.th/"
                  target="_blank"
                  rel="noreferrer"
                >
                  ที่มา: ปภ. ↗
                </a>
                <a
                  href="https://www.niems.go.th/"
                  target="_blank"
                  rel="noreferrer"
                >
                  ที่มา: สพฉ. ↗
                </a>
                <a
                  href="https://sbr.disaster.go.th/ddpmsing/home"
                  target="_blank"
                  rel="noreferrer"
                >
                  ที่มา: ปภ. สิงห์บุรี ↗
                </a>
              </div>
              <p>ตรวจสอบหมายเลขจากเว็บไซต์หน่วยงานเมื่อ 25 กันยายน 2569</p>
            </div>
          </details>
        </section>
        <footer>
          <Waves aria-hidden="true" />
          <p>
            สิงห์บุรี เฝ้าระวังน้ำ
            <br />
            <span>
              ข้อมูลพยากรณ์ประกอบการติดตามสถานการณ์ •
              ไม่มีการส่งแจ้งเตือนอัตโนมัติจากหน้านี้
            </span>
          </p>
        </footer>
      </main>
      <nav className="mobile-nav" aria-label="ทางลัด">
        <a href="#forecast">ดู 7 วัน</a>
        <a href="#help">
          <Phone size={18} aria-hidden="true" />
          ขอความช่วยเหลือ
        </a>
      </nav>
    </>
  );
}
