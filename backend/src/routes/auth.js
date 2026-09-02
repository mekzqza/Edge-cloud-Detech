const { Router } = require("express");
const { pool } = require("../db");
const {
  hashPassword,
  verifyPassword,
  signToken,
  requireUser,
  requireAdmin,
} = require("../auth");

const router = Router();

const h = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const MIN_PASSWORD_LEN = 8;
const MIN_USERNAME_LEN = 3;

const str = (v) => (typeof v === "string" && v.trim() !== "" ? v : null);

// ponytail: กัน brute-force แบบนับในหน่วยความจำ — process เดียว รีสตาร์ตแล้วลืม
// ย้ายไป redis/express-rate-limit ตอนขึ้นหลาย instance
// นับราย username ไม่ใช่ราย IP — login วิ่งผ่าน NextAuth ฝั่ง server ทุก request
// เลยมาจาก IP เดียวกันหมด นับ IP จะกลายเป็นล็อกทั้งระบบ
const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const fails = new Map(); // username -> { n, until }

function isLocked(key) {
  const t = fails.get(key);
  return t !== undefined && t.until > Date.now() && t.n >= MAX_FAILS;
}

function countFail(key) {
  const now = Date.now();
  const t = fails.get(key);
  if (!t || t.until < now) {
    if (fails.size > 10000) fails.clear(); // กันบวมจากชื่อสุ่ม
    fails.set(key, { n: 1, until: now + WINDOW_MS });
  } else {
    t.n += 1;
  }
}

// login ด้วยรหัสที่ admin ตั้งให้ — Google ยังเข้าทาง /oauth เหมือนเดิม
router.post(
  "/login",
  h(async (req, res) => {
    const username = str(req.body.username);
    const password = str(req.body.password);
    if (!username || !password) {
      return res.status(400).json({ error: "ต้องมี username, password" });
    }
    const key = username.trim().toLowerCase();
    if (isLocked(key)) {
      return res
        .status(429)
        .json({ error: "ลองมากเกินไป รอสักครู่แล้วลองใหม่" });
    }

    const { rows } = await pool.query(
      `SELECT username, password_hash, role, must_change_password
         FROM users WHERE username = $1`,
      [username.trim()],
    );
    const user = rows[0];
    // password_hash NULL = บัญชี Google ล้วน — ไม่มีรหัสให้เทียบ
    if (!user?.password_hash || !verifyPassword(password, user.password_hash)) {
      countFail(key);
      return res
        .status(401)
        .json({ error: "username หรือ password ไม่ถูกต้อง" });
    }

    fails.delete(key);
    res.json({
      token: signToken(user),
      role: user.role,
      mustChange: user.must_change_password,
    });
  }),
);

// เปลี่ยนรหัสตัวเอง — ต้องรู้รหัสเดิม (ที่ admin ให้มา) ไม่ต้องมีลิงก์/โทเคนทางอีเมล
router.post(
  "/password",
  requireUser,
  h(async (req, res) => {
    const current = str(req.body.current);
    const next = str(req.body.next);
    if (!current || !next) {
      return res.status(400).json({ error: "ต้องมีรหัสเดิมและรหัสใหม่" });
    }
    if (next.length < MIN_PASSWORD_LEN) {
      return res
        .status(400)
        .json({ error: `รหัสใหม่ต้องยาวอย่างน้อย ${MIN_PASSWORD_LEN} ตัว` });
    }
    if (next === current) {
      return res.status(400).json({ error: "รหัสใหม่ต้องไม่ซ้ำรหัสเดิม" });
    }

    const {
      rows: [row],
    } = await pool.query("SELECT password_hash FROM users WHERE id = $1", [
      req.user.id,
    ]);
    if (!verifyPassword(current, row.password_hash)) {
      return res.status(401).json({ error: "รหัสเดิมไม่ถูกต้อง" });
    }
    await pool.query(
      `UPDATE users SET password_hash = $1, must_change_password = false
        WHERE id = $2`,
      [hashPassword(next), req.user.id],
    );
    res.json({ ok: true });
  }),
);

// รายชื่อเจ้าของ + สถานะ account — หน้า admin ใช้เลือกว่าจะแจก account ให้ใคร
// เจ้าของกับ account เป็นแถวเดียวกันแล้ว: username NULL = ยังล็อกอินไม่ได้ ขึ้นก่อน
router.get(
  "/admin/owners",
  requireAdmin,
  h(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT u.id, COALESCE(u.full_name, u.username) AS full_name, u.contact,
              u.username, count(v.id)::int AS vehicle_count
         FROM users u
         LEFT JOIN vehicles v ON v.owner_id = u.id
        GROUP BY u.id
        ORDER BY u.username IS NOT NULL, COALESCE(u.full_name, u.username)
        LIMIT 500`,
    );
    res.json(rows);
  }),
);

// admin แจก account ให้เจ้าของที่มีชื่ออยู่แล้ว แล้วบอกรหัสไปให้เขาเปลี่ยนเอง
// userId = แถวเจ้าของที่ import มา (เติม username/รหัสให้แถวเดิม), ไม่ส่ง = สร้างแถวใหม่
router.post(
  "/admin/users",
  requireAdmin,
  h(async (req, res) => {
    const username = str(req.body.username)?.trim();
    const password = str(req.body.password);
    const userId = req.body.userId == null ? null : Number(req.body.userId);
    if (!username || !password) {
      return res.status(400).json({ error: "ต้องมี username, password" });
    }
    if (username.length < MIN_USERNAME_LEN) {
      return res
        .status(400)
        .json({ error: `username ต้องยาวอย่างน้อย ${MIN_USERNAME_LEN} ตัว` });
    }
    if (password.length < MIN_PASSWORD_LEN) {
      return res
        .status(400)
        .json({ error: `รหัสต้องยาวอย่างน้อย ${MIN_PASSWORD_LEN} ตัว` });
    }
    if (userId !== null && !Number.isInteger(userId)) {
      return res.status(400).json({ error: "userId ไม่ถูกต้อง" });
    }

    const hash = hashPassword(password);
    try {
      // username IS NULL ใน WHERE = กันแย่ง account ของคนที่มีอยู่แล้ว ในคิวรี่เดียว
      const { rows } = userId
        ? await pool.query(
            `UPDATE users
                SET username = $1, password_hash = $2, must_change_password = true
              WHERE id = $3 AND username IS NULL
              RETURNING id, username`,
            [username, hash, userId],
          )
        : await pool.query(
            `INSERT INTO users (username, password_hash, role, must_change_password)
             VALUES ($1, $2, 'user', true)
             RETURNING id, username`,
            [username, hash],
          );
      if (!rows[0]) {
        return res
          .status(409)
          .json({ error: "เจ้าของรายนี้มี account อยู่แล้ว" });
      }
      res.status(201).json(rows[0]);
    } catch (e) {
      if (e.code === "23505")
        return res.status(409).json({ error: "username นี้ถูกใช้แล้ว" });
      throw e;
    }
  }),
);

module.exports = router;
