const { Router } = require("express");
const { pool } = require("../db");
const { signToken } = require("../auth");

const router = Router();

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
if (!INTERNAL_SECRET) throw new Error("INTERNAL_SECRET is not set");

const USERNAME_MIN_LEN = 3;
const USERNAME_MAX_LEN = 24;
const MAX_ATTEMPTS = 5;

function deriveUsername(emailLower) {
  const base = emailLower
    .split("@")[0]
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, USERNAME_MAX_LEN);
  return base.length >= USERNAME_MIN_LEN ? base : "user";
}

// POST /api/oauth  { email, name?, emailVerified } → { token, role }
router.post("/oauth", async (req, res) => {
  if (req.headers["x-internal-secret"] !== INTERNAL_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { email, emailVerified } = req.body;
  if (typeof email !== "string" || email.trim() === "") {
    return res.status(400).json({ error: "Invalid email" });
  }
  const emailLower = email.trim().toLowerCase();
  if (!emailLower.includes("@")) {
    return res.status(400).json({ error: "Invalid email format" });
  }
  if (emailVerified !== true) {
    return res.status(400).json({ error: "Email not verified" });
  }

  try {
    // 1) มีอยู่แล้ว → คืน token เลย
    const found = await pool.query(
      "SELECT username, role FROM users WHERE email = $1",
      [emailLower],
    );
    if (found.rows[0]) {
      const u = found.rows[0];
      return res.json({ token: signToken(u), role: u.role });
    }

    // 2) ยังไม่มี → สร้างใหม่ (password_hash = NULL, login ด้วยรหัสผ่านไม่ได้)
    const base = deriveUsername(emailLower);

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const username =
        i === 0 ? base : `${base}${Math.floor(Math.random() * 10000)}`;

      const inserted = await pool.query(
        `INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, NULL, 'user')
         ON CONFLICT DO NOTHING
         RETURNING username, role`,
        [username, emailLower],
      );
      if (inserted.rows[0]) {
        const u = inserted.rows[0];
        return res.status(201).json({ token: signToken(u), role: u.role });
      }

      // ชน แต่ไม่รู้ชนอะไร → ถ้าชน email แปลว่ามีคนสร้างพร้อมกัน ใช้ของเขา
      const again = await pool.query(
        "SELECT username, role FROM users WHERE email = $1",
        [emailLower],
      );
      if (again.rows[0]) {
        const u = again.rows[0];
        return res.json({ token: signToken(u), role: u.role });
      }
      // ไม่เจอ = ชน username → วนใหม่ด้วยชื่อ + เลขสุ่ม
    }

    return res.status(500).json({ error: "Failed to create user" });
  } catch (e) {
    console.error("Error in /oauth:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
