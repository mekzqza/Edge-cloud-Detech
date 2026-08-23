const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const { pool } = require("../db");
const { requireAdmin } = require("../auth");
const { buildWhere } = require("./detections-filter");
const { matchVehicle } = require("./detections-match");

const router = Router();

// โฟลเดอร์เก็บรูป (backend/uploads) — สร้างถ้ายังไม่มี
const UPLOAD_DIR = path.join(__dirname, "../../uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// pk กล้องที่ Pi ส่งมา → ทิศทาง; ค่าอื่นหรือไม่ส่งมา = unknown
const DIRECTION = { IN: "in", OUT: "out" };

router.post("/detections", async (req, res) => {
  const { image, plate, province, confidence, captured_at, camera } = req.body;
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

  const direction = DIRECTION[String(camera ?? "").toUpperCase()] ?? "unknown";

  const match = await matchVehicle(pool, plate, province);

  // จับคู่รถได้ = เชื่อทะเบียนที่เจ้าของลงทะเบียนไว้มากกว่าที่ OCR อ่านมา (ทั้งป้ายและจังหวัด)
  // เชื่อพอจะเปิดประตูให้แล้ว ก็เชื่อพอจะใช้ค่าของมัน — ค่าดิบไม่หาย อยู่ใน plate_raw
  const finalPlate = match ? match.plate : plate;
  const finalProvince = match ? match.province : province;

  const result = await pool.query(
    `INSERT INTO detections (filename, plate, plate_raw, province, confidence, captured_at, direction, matched_vehicle_id, access_granted)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::int, $8::int IS NOT NULL)
     RETURNING *`,
    [
      filename,
      finalPlate,
      plate,
      finalProvince,
      confidence,
      captured_at ?? null,
      direction,
      match?.id ?? null,
    ],
  );
  // จับคู่กับ vehicles (ที่ approved) ไม่ได้ = แจ้งเตือน
  if (!match) {
    await pool.query(
      "INSERT INTO notifications (detection_id, reason) VALUES ($1, 'unregistered')",
      [result.rows[0].id],
    );
  }

  res.status(201).json(result.rows[0]);
});

router.get("/detections", async (req, res) => {
  const { where, params } = buildWhere(req.query);

  if (req.query.limit == null) {
    const result = await pool.query(
      `SELECT * FROM detections ${where} ORDER BY id DESC`,
      params,
    );
    return res.json(result.rows);
  }

  const limit = Number(req.query.limit);
  const offset = Number(req.query.offset ?? 0);
  if (
    !Number.isInteger(limit) ||
    limit <= 0 ||
    limit > 100 ||
    !Number.isInteger(offset) ||
    offset < 0
  ) {
    return res
      .status(400)
      .json({ error: "limit (1..100) / offset ไม่ถูกต้อง" });
  }

  // ยอดนับต้องอยู่ในขอบเขตวันที่/ป้ายเดียวกับหน้าที่ขอ แต่ไม่กรอง denied
  // ไม่งั้นแท็บ "ทั้งหมด" จะหายไป และเลขหน้าคำนวณผิด
  const base = buildWhere({
    date: req.query.date,
    plate: req.query.plate,
    direction: req.query.direction,
  });

  const n = params.length;
  const [page, counts] = await Promise.all([
    pool.query(
      `SELECT * FROM detections ${where} ORDER BY id DESC LIMIT $${n + 1} OFFSET $${n + 2}`,
      [...params, limit, offset],
    ),
    pool.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE NOT access_granted)::int AS denied FROM detections ${base.where}`,
      base.params,
    ),
  ]);
  res.json({ rows: page.rows, ...counts.rows[0] });
});

router.get("/detections/plate/:plate", async (req, res) => {
  const q = String(req.params.plate).trim();
  if (!q) return res.status(400).json({ error: "ระบุเลขทะเบียน" });
  const { rows } = await pool.query(
    // ค้นทั้งสองช่อง: คนที่จำค่าที่ระบบแก้ให้ และคนที่จำค่าที่ OCR อ่านมา ต้องเจอเหมือนกัน
    "SELECT * FROM detections WHERE plate ILIKE $1 OR plate_raw ILIKE $1 ORDER BY created_at DESC LIMIT 1000",
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
