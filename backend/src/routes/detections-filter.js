// ตัวกรองร่วมของ GET /detections — แยกไฟล์ไว้เพื่อให้เทสต์เรียกได้โดยไม่ต้องโหลด pg/express
//   unverified=1        เฉพาะที่ยังไม่ยืนยัน
//   plate=ok|unread     อ่านป้ายได้ / อ่านไม่ออก (ป้ายว่าง)
//   date=YYYY-MM-DD     ตามวันที่เวลาไทย (created_at เป็น timestamptz)
//   direction=in|out|unknown  ทิศทางจากกล้อง (ค่าอื่นไม่กรอง)
function buildWhere(q) {
  const cond = [];
  const params = [];
  if (q.unverified === "1") cond.push("NOT verified");
  if (["in", "out", "unknown"].includes(q.direction)) {
    params.push(q.direction);
    cond.push(`direction = $${params.length}`);
  }
  if (q.plate === "ok") cond.push("plate IS NOT NULL AND plate <> ''");
  if (q.plate === "unread") cond.push("(plate IS NULL OR plate = '')");
  // "2026-13-99" ผ่าน regex แต่ ::date ใน SQL จะระเบิดเป็น 500 เลยต้องเช็คว่าเป็นวันจริง
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(String(q.date ?? "")) &&
    !Number.isNaN(Date.parse(q.date))
  ) {
    params.push(q.date);
    cond.push(
      `(created_at AT TIME ZONE 'Asia/Bangkok')::date = $${params.length}::date`,
    );
  }
  return { where: cond.length ? `WHERE ${cond.join(" AND ")}` : "", params };
}

module.exports = { buildWhere };
