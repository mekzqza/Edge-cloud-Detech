const { Router } = require("express");
const { pool } = require("../db");
const { requireUser } = require("../auth");

const router = Router();

// ?unread=1 เอาเฉพาะที่คนนี้ยังไม่อ่าน
router.get("/notifications", requireUser, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT n.id, n.reason, n.created_at, r.read_at,
            d.id AS detection_id, d.filename, d.plate, d.province, d.direction, d.captured_at
     FROM notifications n
     JOIN detections d ON d.id = n.detection_id
     LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = $1
     ${req.query.unread ? "WHERE r.user_id IS NULL" : ""}
     ORDER BY n.created_at DESC
     LIMIT 200`,
    [req.user.id],
  );
  res.json(rows);
});

router.get("/notifications/unread-count", requireUser, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS count
     FROM notifications n
     LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = $1
     WHERE r.user_id IS NULL`,
    [req.user.id],
  );
  res.json(rows[0]);
});

router.post("/notifications/:id/read", requireUser, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id))
    return res.status(400).json({ error: "id ไม่ถูกต้อง" });
  // อ่านซ้ำไม่ใช่ error — เก็บ read_at ครั้งแรกไว้
  const { rows } = await pool.query(
    `INSERT INTO notification_reads (notification_id, user_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING read_at`,
    [id, req.user.id],
  );
  if (!rows[0]) {
    const exists = await pool.query("SELECT 1 FROM notifications WHERE id = $1", [id]);
    if (!exists.rows[0]) return res.status(404).json({ error: "ไม่พบการแจ้งเตือน" });
  }
  res.json({ ok: true });
});

module.exports = router;
