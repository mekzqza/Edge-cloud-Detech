const { Router } = require("express");
const { pool } = require("../db");
const { verifyPassword, signToken, hashPassword } = require("../auth");

const router = Router();

// POST /api/register  { username, password } → { token, role } (สมัครแล้ว login เลย)
router.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "ต้องมี username, password" });
  }
  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: "username ≥ 3 ตัว, password ≥ 6 ตัว" });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'user')
       RETURNING username, role`,
      [username, hashPassword(password)],
    );
    const user = rows[0];
    res.status(201).json({ token: signToken(user), role: user.role });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "username นี้ถูกใช้แล้ว" });
    throw e;
  }
});

// POST /api/login  { username, password } → { token, role }
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "ต้องมี username, password" });
  }
  const { rows } = await pool.query(
    "SELECT username, password_hash, role FROM users WHERE username = $1",
    [username],
  );
  const user = rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "username หรือ password ไม่ถูกต้อง" });
  }
  res.json({ token: signToken(user), role: user.role });
});

module.exports = router;
