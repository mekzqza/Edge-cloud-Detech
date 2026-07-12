const { Router } = require("express");
const { pool } = require("../db");
const { requireAdmin } = require("../auth");

const router = Router();

router.post("/mytest", async (req, res) => {
  const { id, name } = req.body;
  if (typeof id !== "number" || typeof name !== "string") {
    return res
      .status(400)
      .json({ error: "ต้องมี id (ตัวเลข) และ name (ข้อความ)" });
  }
  const { rows } = await pool.query({
    text: "INSERT INTO test (id, name) VALUES ($1, $2) RETURNING name",
    values: [id, name],
  });
  if (rows[0]) {
    console.log("Inserted name:", rows[0].name);
  }
  res.status(201).json(rows[0]);
});

router.get("/mytest/daily", async (req, res) => {
  const { rows } = await pool.query(`
    SELECT (COALESCE(captured_at, created_at) AT TIME ZONE 'Asia/Bangkok')::date AS day,
           COUNT(*)::int AS count
    FROM detections
    GROUP BY day
    ORDER BY day DESC
  `);
  res.json(rows); // [{ day: "2026-07-13", count: 42 }, ...]
});

router.delete("/mytest/:id", requireAdmin, async (req, res) => {
  const { rows } = await pool.query({
    text: "DELETE FROM test WHERE id = $1 RETURNING id",
    values: [req.params.id],
  });

  if (!rows[0]) {
    return res.status(404).json({ error: "ไม่พบข้อมูลที่ต้องการลบ" });
  }
  res.status(200).json({ ok: true });
});

module.exports = router;
