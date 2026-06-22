const { Router } = require("express");
const { pool } = require("../db");

const router = Router();

// บันทึก note ลง db
router.post("/notes", async (req, res) => {
  const { text } = req.body;
  if (typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "text ต้องเป็นข้อความ" });
  }
  const result = await pool.query(
    "INSERT INTO notes (text) VALUES ($1) RETURNING *",
    [text],
  );
  res.status(201).json(result.rows[0]);
});

// ดึง note ทั้งหมด
router.get("/notes", async (req, res) => {
  const result = await pool.query("SELECT * FROM notes ORDER BY id DESC");
  res.json(result.rows);
});

module.exports = router;
