const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const { pool } = require("../db");

const router = Router();

// โฟลเดอร์เก็บรูป (backend/uploads) — สร้างถ้ายังไม่มี
const UPLOAD_DIR = path.join(__dirname, "../../uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Pi ส่งมา: { image: "<base64>", plate, province, confidence }
router.post("/detections", async (req, res) => {
  const { image, plate, province, confidence, captured_at } = req.body;
  if (
    typeof image !== "string" ||
    typeof plate !== "string" ||
    typeof province !== "string" ||
    typeof confidence !== "number"
  ) {
    return res
      .status(400)
      .json({ error: "ต้องมี image (base64), plate, province, confidence (ตัวเลข)" });
  }
  // captured_at ไม่บังคับ — Pi ส่ง ISO string มา, ไม่ส่งก็เป็น null (Postgres รับ ISO8601 ตรงๆ)
  if (captured_at != null && typeof captured_at !== "string") {
    return res.status(400).json({ error: "captured_at ต้องเป็น ISO timestamp string" });
  }

  // เผื่อ Pi ส่งมาแบบมี prefix "data:image/jpeg;base64," ก็ตัดทิ้ง
  const b64 = image.replace(/^data:.*;base64,/, "");
  const filename = `${Date.now()}.jpg`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(b64, "base64"));

  const result = await pool.query(
    "INSERT INTO detections (filename, plate, province, confidence, captured_at) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    [filename, plate, province, confidence, captured_at ?? null],
  );
  res.status(201).json(result.rows[0]);
});

// ดึงรายการทั้งหมด (รูปดูได้ที่ /uploads/<filename>)
router.get("/detections", async (req, res) => {
  const result = await pool.query("SELECT * FROM detections ORDER BY id DESC");
  res.json(result.rows);
});

module.exports = router;
