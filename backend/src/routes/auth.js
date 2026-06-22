const { Router } = require("express");
const { pool } = require("../db");
const { verifyPassword, signToken } = require("../auth");

const router = Router();

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
