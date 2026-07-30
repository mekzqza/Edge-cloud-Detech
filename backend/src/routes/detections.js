const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const { pool } = require("../db");
const { requireAdmin } = require("../auth");

const router = Router();

// โฟลเดอร์เก็บรูป (backend/uploads) — สร้างถ้ายังไม่มี
const UPLOAD_DIR = path.join(__dirname, "../../uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

router.post("/detections", async (req, res) => {
  const { image, plate, province, confidence, captured_at } = req.body;
  if (
    typeof image !== "string" ||
    typeof plate !== "string" ||
    typeof province !== "string" ||
    typeof confidence !== "number"
  ) {
    return res.status(400).json({
      error: "ต้องมี image (base64), plate, province, confidence (ตัวเลข)",
    });
  }
  if (captured_at != null && typeof captured_at !== "string") {
    return res
      .status(400)
      .json({ error: "captured_at ต้องเป็น ISO timestamp string" });
  }

  const b64 = image.replace(/^data:.*;base64,/, "");

  const filename = `${Date.now()}.jpg`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(b64, "base64"));

  const result = await pool.query(
    "INSERT INTO detections (filename, plate, province, confidence, captured_at) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    [filename, plate, province, confidence, captured_at ?? null],
  );
  res.status(201).json(result.rows[0]);
});

// ไม่ส่ง limit = ได้ array แบบเดิม แต่ตัดที่ DEFAULT_LIMIT แถวล่าสุด
// (เมื่อก่อนคืนทั้งตาราง — ตารางโตเรื่อย ๆ แล้ว backend ค้าง)
// ส่ง ?limit=&offset=&unverified=1 = ได้ { rows, total, unverified } สำหรับแบ่งหน้า
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;

router.get("/detections", async (req, res) => {
  if (req.query.limit == null) {
    const result = await pool.query(
      "SELECT * FROM detections ORDER BY id DESC LIMIT $1",
      [DEFAULT_LIMIT],
    );
    return res.json(result.rows);
  }

  const limit = Number(req.query.limit);
  const offset = Number(req.query.offset ?? 0);
  if (
    !Number.isInteger(limit) ||
    limit <= 0 ||
    limit > MAX_LIMIT ||
    !Number.isInteger(offset) ||
    offset < 0
  ) {
    return res
      .status(400)
      .json({ error: `limit (1..${MAX_LIMIT}) / offset ไม่ถูกต้อง` });
  }

  const where = req.query.unverified === "1" ? "WHERE NOT verified" : "";
  const [page, counts] = await Promise.all([
    pool.query(
      `SELECT * FROM detections ${where} ORDER BY id DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    pool.query(
      "SELECT count(*)::int AS total, count(*) FILTER (WHERE NOT verified)::int AS unverified FROM detections",
    ),
  ]);
  res.json({ rows: page.rows, ...counts.rows[0] });
});

// ตัวเลข 5 ช่องบนหน้า Overview — นับด้วย SQL แทนการโหลดทั้งตารางไปนับใน browser
// ponytail: fix timezone ไทยไว้เลย ถ้าต้องรองรับหลายโซนค่อยรับเป็น query param
const TZ = "Asia/Bangkok";

router.get("/detections/stats", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT
       count(*) FILTER (WHERE day = today)::int              AS today,
       count(*) FILTER (WHERE has_plate AND has_prov)::int   AS ok,
       count(*) FILTER (WHERE NOT verified)::int             AS unverified,
       count(*) FILTER (WHERE has_plate <> has_prov)::int    AS partial,
       count(*) FILTER (WHERE NOT has_plate AND NOT has_prov)::int AS unreadable
     FROM (
       SELECT verified,
              (created_at AT TIME ZONE $1)::date AS day,
              (now()      AT TIME ZONE $1)::date AS today,
              coalesce(plate, '')    NOT IN ('', 'UNKNOWN') AS has_plate,
              coalesce(province, '') NOT IN ('', 'UNKNOWN') AS has_prov
       FROM detections
     ) t`,
    [TZ],
  );
  res.json(rows[0]);
});

// ค้นด้วยเลขทะเบียน (ตรงตัวหรือบางส่วน) — หน้า /history เอาไปจับกลุ่มเป็นรอบเข้า-ออก
router.get("/detections/plate/:plate", async (req, res) => {
  const q = String(req.params.plate).trim();
  if (!q) return res.status(400).json({ error: "ระบุเลขทะเบียน" });
  const { rows } = await pool.query(
    "SELECT * FROM detections WHERE plate ILIKE $1 ORDER BY created_at DESC LIMIT 1000",
    [`%${q}%`],
  );
  res.json(rows);
});

router.get("/detections/time/:hours", async (req, res) => {
  const hours = Number(req.params.hours);
  if (!Number.isInteger(hours) || hours <= 0) {
    return res.status(400).json({ error: "ระบุจำนวนชั่วโมงเป็นตัวเลขบวก" });
  }
  const result = await pool.query(
    "SELECT * FROM detections WHERE created_at >= NOW() - make_interval(hours => $1) ORDER BY created_at DESC",
    [hours],
  );
  res.json(result.rows);
});

router.get("/detections/last/:count", async (req, res) => {
  const count = Number(req.params.count);
  if (!Number.isInteger(count) || count <= 0) {
    return res.status(400).json({ error: "ระบุจำนวนเป็นตัวเลขบวก" });
  }
  const result = await pool.query(
    "SELECT * FROM detections ORDER BY created_at DESC LIMIT $1",
    [count],
  );
  res.json(result.rows);
});

router.patch("/detections/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const fields = ["label", "plate", "province", "verified"].filter(
    (f) => f in req.body,
  );
  if (!Number.isInteger(id) || fields.length === 0) {
    return res.status(400).json({
      error: "ระบุ id และอย่างน้อย 1 field (label/plate/province/verified)",
    });
  }
  if ("verified" in req.body && typeof req.body.verified !== "boolean") {
    return res.status(400).json({ error: "verified ต้องเป็น true/false" });
  }
  const set = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
  const values = fields.map((f) => req.body[f]);
  const { rows } = await pool.query(
    `UPDATE detections SET ${set} WHERE id = $${fields.length + 1} RETURNING *`,
    [...values, id],
  );
  if (!rows[0]) return res.status(404).json({ error: "ไม่พบรูป" });
  res.json(rows[0]);
});

router.delete("/detections/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id))
    return res.status(400).json({ error: "id ไม่ถูกต้อง" });
  const { rows } = await pool.query(
    "DELETE FROM detections WHERE id = $1 RETURNING filename",
    [id],
  );
  if (!rows[0]) return res.status(404).json({ error: "ไม่พบรูป" });
  fs.rmSync(path.join(UPLOAD_DIR, rows[0].filename), { force: true }); // ไม่มีไฟล์ก็ไม่ error
  res.json({ ok: true });
});

module.exports = router;
