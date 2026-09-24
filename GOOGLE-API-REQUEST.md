# ขอสิทธิ์ Google Flood Forecasting API

มี Google Cloud อยู่แล้ว สามารถใช้โปรเจ็กต์เดิมได้ แต่ต้องได้รับอนุมัติ API นี้ก่อน

1. เปิดแบบฟอร์มทางการ: https://docs.google.com/forms/d/e/1FAIpQLSfcKhe3CHsncM-_NQ66zLheEfXKnNbDPBtuIT7BSYCqYkmOaA/viewform
2. ใช้อีเมล Google/Workspace ของผู้ดูแลโปรเจ็กต์ ระบุชื่อจริง หน่วยงานจริง และ Google Cloud Project ID เลือกประเภทการใช้งานตามจริง ไม่ต้องอ้างว่าเป็นหน่วยงานรัฐ
3. ใช้ข้อความตัวอย่างด้านล่าง ปรับชื่อหน่วยงานและรายละเอียดให้ตรง แล้วอ่านเงื่อนไขก่อนส่งด้วยตนเอง ยังไม่ได้ส่งคำขอแทนผู้ใช้
4. เมื่อ Google อนุมัติ เปิดใช้ Flood Forecasting API ในโปรเจ็กต์และสร้าง API key ที่จำกัดให้ใช้เฉพาะบริการนี้ เก็บเป็น server secret ชื่อ GOOGLE_FLOOD_API_KEY ไม่ต้องใส่ในแชตหรือหน้าเว็บ
5. ตรวจผล /api/google-flood ว่าดึงได้ มีจุดที่เกี่ยวข้องกับสิงห์บุรี และช่วงพยากรณ์ยังใช้ได้ ก่อนนำไปออกแบบข้อความจริง

## Use case draft

We are developing a non-commercial prototype for a community flood information service in Sing Buri province, Thailand, covering six districts. The intended users include older residents and their caregivers, with Thai-language information delivered through Facebook Messenger.

We would like to evaluate Google's riverine flood forecasts, forecast trends, severity, quality verification indicators and available inundation/notification polygons for Sing Buri and relevant upstream/downstream areas. We will retain attribution, issuance times, forecast validity and uncertainty, and distinguish model forecasts from observed flood reports. The initial stage is a private prototype and coverage/quality evaluation; automatic public warnings are not enabled.

Please confirm whether the proposed community notification use case is permitted under the current API terms, particularly the pilot restrictions regarding preservation of life or property, and advise which access program or agreement is appropriate before any operational deployment. We plan to coordinate with official local warning sources and not present model output as a substitute for official instructions.

## ข้อจำกัดที่ต้องยืนยันกับ Google

แบบฟอร์ม pilot ที่ตรวจ ณ 24 กันยายน 2026 มีข้อความ: “Partners will not use the Predictions for the preservation of life or property.” ต้องขอให้ Google ยืนยันว่าโครงการแจ้งข้อมูล/เตือนชุมชนนี้ใช้ได้ภายใต้โปรแกรมหรือข้อตกลงใดก่อนเปิดใช้จริง ไม่ควรข้ามเงื่อนไขนี้ด้วยการดึงข้อมูลจากหน้าเว็บแทน API

ระบบที่เตรียมไว้ค้นจุดพยากรณ์ในกรอบพื้นที่สิงห์บุรีและบริเวณใกล้เคียง โดยรับเฉพาะ qualityVerified=true การค้นหาของ API อิงตำแหน่งจุดพยากรณ์ ไม่ใช่การตัดพื้นที่ผลกระทบกับขอบเขตจังหวัด จึงยังไม่จับคู่ผลกับทั้งอำเภอหรือส่งอัตโนมัติ ต้องตรวจ notification polygon/แผนที่ผลกระทบและขอบเขตพื้นที่ก่อน

แหล่งอ้างอิง: https://developers.google.com/flood-forecasting และ https://support.google.com/flood-hub/answer/16364306
