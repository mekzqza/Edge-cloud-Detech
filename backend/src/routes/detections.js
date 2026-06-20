const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const { pool } = require("../db");

const router = Router();

// โฟลเดอร์เก็บรูป (backend/uploads) — สร้างถ้ายังไม่มี
const UPLOAD_DIR = path.join(__dirname, "../../uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Pi ส่งมา: { image: "<base64>", label: "ข้อความ" }
router.post("/detections", async (req, res) => {
  const { image, label } = req.body;
  if (typeof image !== "string" || typeof label !== "string") {
    return res.status(400).json({ error: "ต้องมี image (base64) และ label" });
  }

  // เผื่อ Pi ส่งมาแบบมี prefix "data:image/jpeg;base64," ก็ตัดทิ้ง
  const b64 = image.replace(/^data:.*;base64,/, "");
  const filename = `${Date.now()}.jpg`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(b64, "base64"));

  const result = await pool.query(
    "INSERT INTO detections (filename, label) VALUES ($1, $2) RETURNING *",
    [filename, label],
  );
  res.status(201).json(result.rows[0]);
});

// ดึงรายการทั้งหมด (รูปดูได้ที่ /uploads/<filename>)
router.get("/detections", async (req, res) => {
  const result = await pool.query("SELECT * FROM detections ORDER BY id DESC");
  res.json(result.rows);
});

module.exports = router;
