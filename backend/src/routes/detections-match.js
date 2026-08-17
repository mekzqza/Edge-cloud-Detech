// จับคู่ป้ายที่ตรวจจับได้กับรถที่อนุมัติไว้ — แยกไฟล์ไว้ให้เทสต์เรียกได้ตรง ๆ
// ไล่จากมั่นใจมากไปน้อย เจอชั้นไหนก่อนใช้ชั้นนั้น:
//   1. ป้าย + จังหวัด ตรงเป๊ะ
//   2. ป้ายตรงเป๊ะ และมีคันเดียวในระบบ — Pi ส่ง province = UNKNOWN มาบ่อย เชื่อจังหวัดจาก OCR ไม่ได้
//   3. เลขในป้ายตรง และมีคันเดียวในระบบ — OCR พลาดตัวอักษรไทยบ่อยกว่าตัวเลข (ข/ช/ฃ, ย/ผ)
// ชั้น 2/3 บังคับ count(*) = 1 เสมอ: คลุมเครือเมื่อไหร่ = ไม่ให้ผ่าน
// ปล่อยรถผิดคันเข้า แย่กว่าไม่เปิดประตูให้เจ้าของ
// ใช้ [^0-9] ไม่ใช่ \D — ใน JS string "\D" กลายเป็น "D" เงียบ ๆ
const MATCH_SQL = `
  SELECT v.id, v.province
  FROM (
    SELECT COALESCE(
      (SELECT id FROM vehicles WHERE status = 'approved' AND plate = $1 AND province = $2),
      (SELECT CASE WHEN count(*) = 1 THEN min(id) END
         FROM vehicles WHERE status = 'approved' AND plate = $1),
      (SELECT CASE WHEN count(*) = 1 THEN min(id) END
         FROM vehicles
         WHERE status = 'approved'
           AND plate_digits = regexp_replace($1, '[^0-9]', '', 'g')
           AND plate_digits <> '')
    ) AS id
  ) m
  LEFT JOIN vehicles v ON v.id = m.id`;

// db = pool หรือ client ก็ได้ (เทสต์ส่ง client ที่อยู่ใน transaction เข้ามา)
// คืน { id, province } ของรถที่จับคู่ได้ หรือ null
async function matchVehicle(db, plate, province) {
  const { rows } = await db.query(MATCH_SQL, [plate, province]);
  return rows[0].id == null ? null : rows[0];
}

// Pi อ่านจังหวัดไม่ออกจะส่ง UNKNOWN มา (บางทีก็ว่างเปล่า)
const isUnknownProvince = (p) =>
  !String(p).trim() || String(p).trim().toUpperCase() === "UNKNOWN";

module.exports = { MATCH_SQL, matchVehicle, isUnknownProvince };
