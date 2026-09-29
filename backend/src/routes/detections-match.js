// จับคู่ป้ายที่ตรวจจับได้กับรถที่อนุมัติไว้ — แยกไฟล์ไว้ให้เทสต์เรียกได้ตรง ๆ
// ไล่จากมั่นใจมากไปน้อย เจอชั้นไหนก่อนใช้ชั้นนั้น:
//   1. ป้าย + จังหวัด ตรงเป๊ะ
//   2. ป้ายตรงเป๊ะ และมีคันเดียวในระบบ — Pi ส่ง province = UNKNOWN มาบ่อย เชื่อจังหวัดจาก OCR ไม่ได้
//   3. เลขในป้ายตรง และมีคันเดียวในระบบ — OCR พลาดตัวอักษรไทยบ่อยกว่าตัวเลข (ข/ช/ฃ, ย/ผ)
// ชั้น 2/3 บังคับ count(*) = 1 เสมอ: คลุมเครือเมื่อไหร่ = ไม่ให้ผ่าน
// ปล่อยรถผิดคันเข้า แย่กว่าไม่เปิดประตูให้เจ้าของ
// ชั้น 3 เปิดเฉพาะตอน OCR ไม่มั่นใจ ($3) — ถ้า OCR อ่าน "กง1234" ชัด ๆ แปลว่ารถคันนั้นคือ กง จริง
// ไม่ใช่ กข1234 ที่อ่านผิด ห้ามเอาเลขไปจับคู่
// ใช้ [^0-9] ไม่ใช่ \D — ใน JS string "\D" กลายเป็น "D" เงียบ ๆ
const MATCH_SQL = `
  SELECT v.id, v.plate, v.province
  FROM (
    SELECT COALESCE(
      (SELECT id FROM vehicles WHERE status = 'approved' AND plate = $1 AND province = $2),
      (SELECT CASE WHEN count(*) = 1 THEN min(id) END
         FROM vehicles WHERE status = 'approved' AND plate = $1),
      (SELECT CASE WHEN count(*) = 1 THEN min(id) END
         FROM vehicles
         WHERE $3::boolean
           AND status = 'approved'
           AND plate_digits = regexp_replace($1, '[^0-9]', '', 'g')
           AND plate_digits <> '')
    ) AS id
  ) m
  LEFT JOIN vehicles v ON v.id = m.id`;

// ต่ำกว่านี้ = OCR ไม่มั่นใจ ยอมให้ใช้ชั้น 3 (plate_confidence จาก Pi อยู่ช่วง 0..1)
// ponytail: ค่าเดา — ปรับจากข้อมูลจริง: ดู plate_confidence ของแถวที่ plate_raw <> plate
const FUZZY_MAX_CONF = Number(process.env.PLATE_FUZZY_MAX_CONF ?? 0.8);

// ไม่ส่ง conf มา (Pi รุ่นเก่า / null) = ไม่รู้ว่ามั่นใจแค่ไหน → ไม่ใช้ชั้น 3 (fail closed)
const ocrUnsure = (conf) => typeof conf === "number" && conf < FUZZY_MAX_CONF;

// db = pool หรือ client ก็ได้ (เทสต์ส่ง client ที่อยู่ใน transaction เข้ามา)
// คืน { id, plate, province } ของรถที่จับคู่ได้ หรือ null
async function matchVehicle(db, plate, province, plateConfidence) {
  const { rows } = await db.query(MATCH_SQL, [
    plate,
    province,
    ocrUnsure(plateConfidence),
  ]);
  return rows[0].id == null ? null : rows[0];
}

module.exports = { MATCH_SQL, matchVehicle, ocrUnsure };
