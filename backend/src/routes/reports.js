const { Router } = require("express");
const { pool } = require("../db");
const { requireUser, requireAdmin } = require("../auth");

const router = Router();

// express 4 ไม่จับ async throw เอง — ไม่ห่อแล้ว query พังจะล้มทั้ง process
const h = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const MAX_MESSAGE_LEN = 2000;
const STATUSES = ["open", "resolved"];

// ผู้ใช้ส่งเรื่องร้องเรียน — ใครส่งมาจาก token (ไม่รับ user_id จาก body) เวลาใช้ now() ของ DB
router.post(
  "/reports",
  requireUser,
  h(async (req, res) => {
    const message =
      typeof req.body.message === "string" ? req.body.message.trim() : "";
    if (!message) {
      return res.status(400).json({ error: "ต้องมีรายละเอียดเรื่องร้องเรียน" });
    }
    if (message.length > MAX_MESSAGE_LEN) {
      return res
        .status(400)
        .json({ error: `ยาวได้ไม่เกิน ${MAX_MESSAGE_LEN} ตัวอักษร` });
    }
    const {
      rows: [row],
    } = await pool.query(
      `INSERT INTO reports (user_id, message) VALUES ($1, $2)
       RETURNING id, message, status, created_at, resolved_at`,
      [req.user.id, message],
    );
    res.status(201).json(row);
  }),
);

// เรื่องของตัวเอง — ไว้ดูว่าจัดการแล้วหรือยัง
router.get(
  "/reports",
  requireUser,
  h(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, message, status, created_at, resolved_at
         FROM reports WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 50`,
      [req.user.id],
    );
    res.json(rows);
  }),
);

// admin: ใครร้องเรียน เมื่อไหร่ เรื่องอะไร — ?status=open|resolved, ไม่ส่ง = ทั้งหมด
// ชื่อ join สดจาก users (แก้ชื่อที่ไหนก็เปลี่ยนตาม), user_name NULL = ผู้ใช้ถูกลบไปแล้ว
// ponytail: LIMIT ตายตัวแทน pagination — เรื่องค้างเป็นร้อยพร้อมกันค่อยทำแบ่งหน้า
router.get(
  "/admin/reports",
  requireAdmin,
  h(async (req, res) => {
    const status = STATUSES.includes(req.query.status) ? req.query.status : null;
    const { rows } = await pool.query(
      `SELECT c.id, c.message, c.status, c.created_at, c.resolved_at,
              COALESCE(u.full_name, u.username) AS user_name, u.username, u.contact,
              COALESCE(r.full_name, r.username) AS resolved_by_name
         FROM reports c
         LEFT JOIN users u ON u.id = c.user_id
         LEFT JOIN users r ON r.id = c.resolved_by
        ${status ? "WHERE c.status = $1" : ""}
        ORDER BY c.created_at DESC
        LIMIT 200`,
      status ? [status] : [],
    );
    res.json(rows);
  }),
);

// admin ปิดเรื่อง (resolved) / เปิดใหม่ (open) — ปิดแล้วจำว่าใครปิด เมื่อไหร่, เปิดใหม่ล้างทิ้ง
router.patch(
  "/admin/reports/:id",
  requireAdmin,
  h(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id ไม่ถูกต้อง" });
    }
    const { status } = req.body;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: "status ต้องเป็น open หรือ resolved" });
    }
    const {
      rows: [row],
    } = await pool.query(
      `UPDATE reports
          SET status = $1,
              resolved_by = CASE WHEN $1 = 'resolved' THEN $2::int END,
              resolved_at = CASE WHEN $1 = 'resolved' THEN now() END
        WHERE id = $3
        RETURNING id, status, resolved_at`,
      [status, req.user.id, id],
    );
    if (!row) return res.status(404).json({ error: "ไม่พบเรื่องร้องเรียนนี้" });
    res.json(row);
  }),
);

module.exports = router;
