const { Router } = require("express");
const { pool } = require("../db");
const { requireUser, requireAdmin } = require("../auth");

const router = Router();

// express 4 ไม่จับ async throw เอง — ไม่ห่อแล้ว query พังจะค้างจน timeout
const h = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// รูปแบบถูกอย่างเดียวไม่พอ — "2026-13-99" ผ่าน regex แต่ ::date ใน SQL จะระเบิดเป็น 500
const isDate = (s) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? "")) && !Number.isNaN(Date.parse(s));

// รับได้ทั้งไม่ส่ง (undefined) และ string ที่ไม่ว่าง; อย่างอื่นคือ error
function field(v) {
  if (v === undefined) return undefined;
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

router.post(
  "/vehicles",
  requireUser,
  h(async (req, res) => {
    const plate = field(req.body.plate);
    const province = field(req.body.province);
    if (!plate || !province) {
      return res
        .status(400)
        .json({ error: "ต้องมี plate และ province เป็นข้อความที่ไม่ว่าง" });
    }

    // UNIQUE (plate, province) กันซ้ำอยู่แล้ว — เช็คก่อน insert เปิดช่องให้แข่งกัน
    const { rows } = await pool.query(
      `INSERT INTO vehicles (plate, province, owner_id) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING RETURNING *`,
      [plate, province, req.user.id],
    );
    if (!rows[0]) return res.status(409).json({ error: "รถคันนี้มีอยู่แล้ว" });
    return res.status(201).json(rows[0]);
  }),
);

router.get(
  "/vehicles",
  requireUser,
  h(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM vehicles WHERE owner_id = $1 ORDER BY created_at DESC`,
      [req.user.id],
    );
    return res.json(rows);
  }),
);

router.delete(
  "/vehicles/:id",
  requireUser,
  h(async (req, res) => {
    const vehicleId = Number(req.params.id);
    if (!Number.isInteger(vehicleId)) {
      return res.status(400).json({ error: "vehicle id ต้องเป็นตัวเลข" });
    }

    // owner_id อยู่ใน WHERE = เช็คความเป็นเจ้าของกับลบในคิวรี่เดียว
    const { rows } = await pool.query(
      `DELETE FROM vehicles WHERE id = $1 AND owner_id = $2 RETURNING id`,
      [vehicleId, req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "ไม่พบรถคันนี้" });
    return res.json({ message: "ลบรถคันนี้เรียบร้อยแล้ว" });
  }),
);

router.patch(
  "/vehicles/:id",
  requireUser,
  h(async (req, res) => {
    const vehicleId = Number(req.params.id);
    if (!Number.isInteger(vehicleId)) {
      return res.status(400).json({ error: "vehicle id ต้องเป็นตัวเลข" });
    }
    const plate = field(req.body.plate);
    const province = field(req.body.province);
    if (plate === null || province === null) {
      return res.status(400).json({ error: "plate/province ต้องไม่ว่าง" });
    }

    // แก้ทะเบียนแล้วยังค้าง approved = ย้ายทะเบียนไปเป็นของคนอื่นแล้วได้สิทธิ์ฟรี
    // ponytail: reset ทุกครั้งที่ patch เพราะมีแค่ 2 ฟิลด์นี้ให้แก้ ไม่ต้องเทียบค่าเก่า
    const { rows } = await pool.query(
      `UPDATE vehicles
          SET plate = COALESCE($1, plate),
              province = COALESCE($2, province),
              status = 'pending', approved_by = NULL, approved_at = NULL
        WHERE id = $3 AND owner_id = $4
        RETURNING *`,
      [plate ?? null, province ?? null, vehicleId, req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "ไม่พบรถคันนี้" });
    return res.json(rows[0]);
  }),
);

/* ===== ฝั่ง admin: อนุมัติ/ปฏิเสธคำขอ ===== */

// GET /admin/vehicles?status=&date=YYYY-MM-DD&q=ชื่อผู้ใช้&plate=
router.get(
  "/admin/vehicles",
  requireAdmin,
  h(async (req, res) => {
    const cond = [];
    const params = [];
    const where = (sql, value) => {
      params.push(value);
      cond.push(sql.replace("$?", `$${params.length}`));
    };

    const { status, date, q, plate } = req.query;
    if (["pending", "approved", "revoked"].includes(status)) {
      where("v.status = $?", status);
    }
    if (isDate(date)) {
      where("(v.created_at AT TIME ZONE 'Asia/Bangkok')::date = $?::date", date);
    }
    if (typeof q === "string" && q.trim()) {
      where("u.username ILIKE $?", `%${q.trim()}%`);
    }
    if (typeof plate === "string" && plate.trim()) {
      where("v.plate ILIKE $?", `%${plate.trim()}%`);
    }

    // ponytail: LIMIT ตายตัวแทน pagination — คำขอค้างพร้อมกันเป็นร้อยค่อยว่ากัน
    const { rows } = await pool.query(
      `SELECT v.*, u.username AS owner_name, a.username AS approved_by_name
         FROM vehicles v
         JOIN users u ON u.id = v.owner_id
         LEFT JOIN users a ON a.id = v.approved_by
         ${cond.length ? `WHERE ${cond.join(" AND ")}` : ""}
        ORDER BY v.created_at DESC
        LIMIT 200`,
      params,
    );
    return res.json(rows);
  }),
);

// อนุมัติ = approved, ปฏิเสธ = revoked (ใช้สถานะเดิมใน schema ไม่เพิ่มค่าใหม่)
// approved_by/at เก็บ "ใครตัดสิน เมื่อไหร่" ทั้งสองทาง ไม่ใช่เฉพาะตอนอนุมัติ
router.patch(
  "/admin/vehicles/:id",
  requireAdmin,
  h(async (req, res) => {
    const vehicleId = Number(req.params.id);
    if (!Number.isInteger(vehicleId)) {
      return res.status(400).json({ error: "vehicle id ต้องเป็นตัวเลข" });
    }
    const { status } = req.body;
    if (status !== "approved" && status !== "revoked") {
      return res.status(400).json({ error: "status ต้องเป็น approved หรือ revoked" });
    }

    const { rows } = await pool.query(
      `UPDATE vehicles SET status = $1, approved_by = $2, approved_at = now()
        WHERE id = $3 RETURNING *`,
      [status, req.user.id, vehicleId],
    );
    if (!rows[0]) return res.status(404).json({ error: "ไม่พบรถคันนี้" });
    return res.json(rows[0]);
  }),
);

// แก้ทะเบียนไปชนคันที่มีอยู่แล้ว = ผู้ใช้ทำผิด ไม่ใช่ 500
router.use((err, _req, res, next) =>
  err.code === "23505"
    ? res.status(409).json({ error: "รถคันนี้มีอยู่แล้ว" })
    : next(err),
);

module.exports = router;
