# บันทึกโครงการเดิม — ยังไม่ใช่รายการความสามารถของโค้ดปัจจุบัน

เอกสารเดิมอ้างถึงไฟล์ที่ไม่อยู่ใน GitHub ณ commit `0ea964fb1a8c93c87c76a30ef5cc483be6c89a24` เช่น dashboard ผู้ดูแล, ThaiWater adapter, D1, Messenger และสคริปต์ backtest จึงเก็บไว้อ้างอิงเพื่อรวมต้นฉบับภายหลัง ไม่ได้ยืนยันว่าฟังก์ชันเหล่านั้นทำงานใน checkout นี้

# สิงห์บุรี เฝ้าระวังน้ำ

ต้นแบบใช้งานได้สำหรับติดตามข้อมูลภายนอกทั้ง 6 อำเภอ ทดลองข้อความสำหรับผู้สูงอายุ และเตรียมเชื่อม Facebook Messenger

## สิ่งที่ใช้งานได้แล้ว

- เลือก 6 อำเภอ ดูแผนที่จุดตัวแทน (ไม่ใช่ขอบเขตน้ำท่วม)
- ดึงพยากรณ์ฝนรายชั่วโมง 24 ช่วงเวลาจาก Open-Meteo และแบบจำลองน้ำไหล GloFAS 7 วันจริง
- ดึงใหม่ทุก 15 นาทีเมื่อเปิดหน้าและเก็บ cache ใน D1; หากดึงล้มเหลวแสดงข้อมูลเก่าพร้อมป้าย ไม่เกิน 24 ชั่วโมง ไม่มีการสลับเป็นข้อมูลสมมติเงียบ ๆ
- ทดลองแนวโน้มระดับน้ำ 6/12/24 ชั่วโมง โดยใช้ข้อมูลสมมติที่มีป้ายแยกชัดเจน
- ทดลองข้อความ เสียงอ่านภาษาไทยตามเสียงที่อุปกรณ์มี และกดรับทราบ (บนหน้าตัวอย่างเท่านั้น)
- Webhook ตรวจลายเซ็น HMAC, ลงทะเบียนรายอำเภอเมื่อผู้ใช้ยินยอม, ยกเลิก/ลบการลงทะเบียน, รับทราบ และกันข้อความซ้ำ
- ช่องทางรับประกาศเตือนที่ตรวจสอบแล้วและส่งตามพื้นที่ มีการบันทึกสถานะการส่งและจำกัดหน้าต่าง 24 ชั่วโมง

## สิ่งที่ยังไม่พร้อมใช้เตือนประชาชน

ข้อมูล GloFAS เป็นแบบจำลองระดับโลก ความละเอียดประมาณ 5 กม. และอาจเลือกสาขาแม่น้ำผิด ห้ามใช้ยืนยันน้ำท่วมรายบ้าน/หมู่บ้าน จุด sampling ใน lib/areas.ts เป็นค่าตัวแทนที่ต้องตรวจสอบทางภูมิศาสตร์ก่อนใช้งานจริง รุ่นนี้ไม่มีขอบเขตตำบลหรือหมู่บ้านที่ผ่านการตรวจสอบ

ยังไม่ได้เชื่อมข้อมูลสถานี ThaiWater/RID, ข้อมูลเขื่อน, ระดับตลิ่งที่อนุมัติ, แนวคันกั้นน้ำ หรือแบบจำลองไฮดรอลิกในพื้นที่ จึงแสดงความเสี่ยงน้ำท่วมจริงเป็น unknown เสมอ และไม่อ้างพื้นที่ใดว่าปลอดภัย

หน้า simulation ใช้ระดับเริ่มต้น 8.4 ม. และตลิ่ง 9.2 ม. ที่สมมติขึ้น อัตราน้ำขึ้นเชิงเส้นและช่วงขอบบน/ล่างไม่ได้ปรับเทียบ ไม่มีการนำผลนี้เข้า dispatcher

ยังไม่มีข้อมูลย้อนหลังจริงสำหรับวัดความแม่นยำ สคริปต์ backtest พร้อมรับผลพยากรณ์ที่ออกไว้ก่อนเหตุการณ์จริง แต่ยังไม่ได้รันกับประวัติเหตุการณ์ของสิงห์บุรี

ยังไม่ได้เชื่อม Facebook Page และไม่ได้ส่งข้อความให้ใคร เสียงอ่านในเว็บไม่ใช่เสียงใน Messenger; การส่งเสียงใน Messenger ต้องเพิ่มบริการ TTS และไฟล์เสียง

ลิงก์ Sites รุ่นนี้เป็นส่วนตัว Meta จึงเรียก Webhook ผ่านหน้านี้ไม่ได้ ต้องแยก endpoint Webhook/งานตามเวลาไว้บน origin ที่เข้าถึงได้ และตรวจลายเซ็นกับ token เช่นเดิม ก่อนเปิดใช้งานจริง ไม่ควรเปลี่ยนหน้าผู้ดูแลเป็นสาธารณะเพียงเพื่อรับ Webhook

## เริ่มในเครื่อง

ต้องมี Node.js 22.13 ขึ้นไป

```sh
npm ci
npm run dev
```

Windows หาก npm shim ใช้ไม่ได้ เรียก npm-cli.js จากตำแหน่งติดตั้ง Node โดยตรง หรือเรียกคำสั่งที่ติดตั้งแล้ว:

```sh
node scripts/run-framework.mjs dev
node scripts/run-framework.mjs build
node node_modules/typescript/bin/tsc --noEmit
node scripts/test-safety.mjs
```

ฐานข้อมูลใช้ Cloudflare D1 แยก local กับ hosted ตั้ง logical binding DB ใน .openai/hosting.json แล้วสร้าง migration จาก db/schema.ts ปัจจุบันมี source_cache, subscribers, webhook_events และ delivery_ledger ใช้ prepared statements ทุก query ไม่มีข้อมูลส่วนตัวส่งถึง browser

หลัง build ครั้งแรก ใช้คำสั่งต่อไปนี้กับฐาน local ครั้งเดียว:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_demonic_ultragirl.sql
```

## เชื่อม Messenger ภายหลัง

เก็บค่าลับที่ฝั่ง server เท่านั้น ดูชื่อใน .env.example ห้ามใส่ Page token ใน client หรือ commit ค่า token

1. ตั้งค่า META_APP_SECRET, META_PAGE_ACCESS_TOKEN, META_PAGE_ID, META_VERIFY_TOKEN และ META_GRAPH_VERSION ตามรุ่นที่ Meta รองรับจริง
2. เตรียม Webhook HTTPS ที่ Meta เข้าถึงได้: GET /api/messenger/webhook สำหรับ verification และ POST ที่ตรวจ X-Hub-Signature-256
3. ผูกเพจกับแอป เปิดสิทธิ์/subscriptions ที่จำเป็น และทดสอบกับบัญชีที่อนุญาตก่อน production
4. เปิด MESSENGER_SEND_ENABLED=true เฉพาะเมื่อพร้อมส่งตามเงื่อนไข Meta
5. ผู้ใช้ทักเพจ กดอำเภอหลังข้อความขอความยินยอมเพื่อสมัคร เปลี่ยนพื้นที่ด้วยการเริ่มต้นใหม่ ใช้ หยุด เพื่อยกเลิกและลบการลงทะเบียน และ รับทราบ เพื่อบันทึกเวลา

การส่งอัตโนมัติใช้เพียงหน้าต่าง 24 ชั่วโมงหลัง interaction ของผู้ใช้ ไม่ใช้ message tag เพื่อหลบข้อจำกัด และไม่ถือว่าการ opt-in ธรรมดาให้สิทธิ์ส่งนอกช่วงเวลานี้ ต้องยืนยันช่องทางที่ Meta อนุญาตและเตรียมช่องทางสำรองก่อนใช้เตือนฉุกเฉิน

ตั้ง JOB_TOKEN เป็นค่าลับสุ่ม และ OFFICIAL_ALERT_FEED_URL เป็น HTTPS feed ที่หน่วยงานหรือผู้ดูแลได้ตรวจสอบสิทธิ์/ที่มาแล้ว ตัวอย่าง schema (ค่าตัวอย่าง ไม่ใช่เหตุการณ์จริง):

```json
{"alerts":[{"id":"unique-official-event-revision","areaId":"1701","level":"watch","text":"ข้อความประกาศที่ตรวจสอบแล้ว","sourceName":"ชื่อหน่วยงาน","sourceUrl":"https://example.org/official-notice","issuedAt":"2026-09-24T08:00:00Z","expiresAt":"2026-09-24T10:00:00Z"}]}
```

level รองรับ watch, warning, flood_report, resolved แต่ละ revision ต้องใช้ id ใหม่ URL ต้องเป็น HTTPS และต้องตรวจสอบ publisher จริงนอกเหนือจาก schema รุ่นนี้ยังไม่มี official feed พร้อมใช้งาน

เรียก POST /api/jobs/poll โดยมี Authorization: Bearer JOB_TOKEN จาก scheduler ที่ตั้งค่าแยกต่างหาก ขณะนี้ยังไม่ได้ติดตั้ง scheduler งานจะไม่ทำงานหลังปิดหน้าเอง เว้นแต่ตั้ง scheduler นี้แล้ว

Dispatcher รับไม่เกิน 20 ประกาศต่อรอบ ข้ามประกาศเก่ากว่า 6 ชม. หมดอายุ หรือเวลาอนาคต ส่งเฉพาะผู้สมัครพื้นที่เดียวกันที่อยู่ในหน้าต่าง 24 ชม. ไม่ส่ง simulation และไม่ส่งซ้ำเมื่อพบ id เดิม หากผลการส่งไม่แน่ชัดบันทึก failed_or_unknown โดยไม่ลองซ้ำอัตโนมัติ เพื่อไม่ส่งซ้ำให้ผู้สูงอายุ ต้องมีงานติดตามความล้มเหลว/คิวและ batching เพิ่มก่อนรองรับทั้งจังหวัดจำนวนมาก

Webhook claim event ก่อนทำงานเพื่อกันซ้ำ หากล้มเหลวหลัง claim ต้องตรวจสถานะและกู้คืนด้วยผู้ดูแล ระบบนี้ยังไม่ใช่คิวส่งเตือนที่รับประกันการส่ง

## ตรวจย้อนหลัง

```sh
node scripts/backtest.mjs historical-predictions.json
```

ไฟล์ JSON เป็น array: areaId, issuedAt, targetAt, predictedLevel, observedLevel, bankLevel ค่าระดับทุกค่าต้องหน่วย/ฐานอ้างอิงเดียวกัน ใช้ผลที่ออกก่อน targetAt เท่านั้น และแยกข้อมูลทดสอบจากข้อมูลปรับเทียบ รายงาน MAE, precision, recall, missed exceedances และ false alarms เป็นการประเมินน้ำเกินเกณฑ์ ณ เวลาเป้าหมาย ไม่ใช่ความแม่นยำแผนที่ท่วมหรือการนับเหตุการณ์น้ำท่วม

## แหล่งข้อมูล

## Google Flood Hub / Flood Forecasting API

เพิ่ม adapter ฝั่ง server แล้ว: GET /api/google-flood เรียก searchLatestFloodStatusByArea พร้อม pagination โดยส่ง API key ผ่าน header เฉพาะฝั่ง server ดูสถานะสิทธิ์/ข้อผิดพลาดในหน้า Google Flood Hub บน dashboard เมื่อยังไม่มี key จะแสดง unconfigured ไม่ส่งคำขอเปล่าไป Google

ขั้นตอนขอสิทธิ์และข้อความร่างอยู่ใน GOOGLE-API-REQUEST.md ต้องได้รับอนุมัติและตั้ง GOOGLE_FLOOD_API_KEY ก่อน ไม่ถือว่า Google Cloud project ทั่วไปเข้าถึง API นี้ได้ทันที

ผลที่แสดงจำกัด qualityVerified=true และกรอบค้นหาที่ระบุว่าเป็นสิงห์บุรีและบริเวณใกล้เคียง แสดงเวลาออกผล ช่วงพยากรณ์ สถานะและแนวโน้ม ผลเก่ากว่า 36 ชั่วโมงหรือหมดช่วงพยากรณ์ไม่แสดงเป็นสถานะปัจจุบัน ไม่แปลงจุดพยากรณ์เป็นความเสี่ยงทั้งอำเภอ และยังไม่ส่งผล Google เข้า Messenger dispatcher

ไม่มีการทดสอบเรียก Google API ด้วยสิทธิ์จริง เนื่องจากยังไม่มี API key ที่ได้รับอนุมัติ ทดสอบ parser ด้วย fixture ที่ระบุว่าเป็น test เท่านั้น ไม่ใช้เป็นข้อมูล live

## แหล่งอ้างอิง

- Weather: https://open-meteo.com/en/docs
- Flood model: https://open-meteo.com/en/docs/flood-api
- เงื่อนไขบริการ/การใช้เชิงพาณิชย์: https://open-meteo.com/en/terms
- แผนที่: OpenStreetMap contributors, https://www.openstreetmap.org/copyright
- แหล่งทางการที่ยังไม่เชื่อม API: https://www.thaiwater.net/ และ https://www.rid.go.th/th/runoff
- TMD: https://www.tmd.go.th/service/serviceData

API free tier ของ Open-Meteo ใช้ตามเงื่อนไข non-commercial และอัตราจำกัด ต้องตรวจ license/แผนบริการก่อน production หน้าดูข้อมูลนี้ใช้ refresh/cache เพื่อลดการเรียกซ้ำ

## Measured-data risk screening (version 1)
The overview now reads ThaiWater public observations: current water levels/bank levels/discharge, hourly water history, daily annual water series, observed 24-hour rain, and monthly daily rain history. Google approval is not required for this view. Refresh is on demand and every 15 minutes while open; this is not a background alert scheduler.

Risk rules are provisional and displayed in the UI: <=0.5 m below station bank is high watch; <=1.5 m, >=0.3 m rise over approximately 24 hours, or >=35 mm observed 24-hour rain is watch. Only observations <=6 hours old are assessed. Upstream signals are basin context, never evidence of inundation across a district. Missing observations do not become zero or imply safety. Historical comparisons are contextual and cannot downgrade threshold alerts. No calibrated flood probability or arrival time is claimed.

River comparison uses the same station and month/day over 30 days. Rain compares the current month up to yesterday with the same station/days last year; only matched valid days enter both totals, with coverage shown. Some districts have rain but no connected local water/bank station. The risk panel does not send Messenger messages; the existing official-alert dispatcher remains separate.

Validation: `node scripts/test-safety.mjs`; bundle `tests/risk.test.ts` with esbuild and run Node's test runner. `scripts/check-risk.mjs` checks live data UI, district switch, flow chart, and mobile overflow; provide PLAYWRIGHT_MODULE if Playwright is outside the project.

## Resident and admin views
`/` is the simple resident view: search/select one of six Sing Buri districts, remember the valid district ID in localStorage, display the shared observed-data risk assessment, read the summary with an installed Thai voice, and refresh or inspect reasons. `/admin` retains the complete original dashboard. These are separate views, not a new authorization system: the existing owner-only Sites access still protects the whole deployment. No public access or admin role permissions were added.

Run `scripts/check-resident.mjs` with PLAYWRIGHT_MODULE configured to verify search, selection, remembered district, mobile layout, and navigation between views.

