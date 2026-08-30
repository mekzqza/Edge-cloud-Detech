const crypto = require("crypto");

const SECRET = process.env.AUTH_SECRET;

const TOKEN_TTL_SEC = 7 * 24 * 60 * 60; // 7 วัน

const USERNAME_MAX_LEN = 24;

// ไม่มี username ให้กรอกแล้ว — ชื่อที่แสดงมาจาก local-part ของอีเมล
function deriveUsername(emailLower) {
  const base = emailLower
    .split("@")[0]
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, USERNAME_MAX_LEN);
  return base.length >= 3 ? base : "user";
}

function b64url(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payloadB64) {
  return b64url(
    crypto.createHmac("sha256", SECRET).update(payloadB64).digest(),
  );
}

function signToken({ username, role }) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
  const payloadB64 = b64url(
    Buffer.from(JSON.stringify({ username, role, exp })),
  );
  return `${payloadB64}.${sign(payloadB64)}`;
}

function verifyToken(token) {
  const [payloadB64, sig] = String(token).split(".");
  if (!payloadB64 || !sig) return null;
  const good = sign(payloadB64);
  if (
    sig.length !== good.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))
  ) {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64").toString());
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload; // { username, role, exp }
}

function authUser(req) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  return token ? verifyToken(token) : null;
}

// token มีแค่ { username, role } — route ที่ต้องใช้ id (owner_id/approved_by) เลยต้อง
// แลกเป็นแถวจริงใน DB ที่นี่ แถมได้ role ล่าสุดด้วย ไม่ใช่ role ตอนออก token
// ponytail: require ข้างในฟังก์ชันกัน circular (db.js require ไฟล์นี้ตอนโหลด)
async function loadUser(req) {
  const claims = authUser(req);
  if (!claims) return null;
  const { pool } = require("./db");
  const { rows } = await pool.query(
    "SELECT id, username, role FROM users WHERE username = $1",
    [claims.username],
  );
  return rows[0] ?? null;
}

// อ่าน role โดยไม่บังคับล็อกอิน — route ที่เปิดสาธารณะแต่ต้องซ่อนบางฟิลด์จากคนทั่วไป
async function isAdmin(req) {
  return (await loadUser(req))?.role === "admin";
}

async function requireUser(req, res, next) {
  try {
    const user = await loadUser(req);
    if (!user) return res.status(401).json({ error: "ต้อง login ก่อน" });
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

async function requireAdmin(req, res, next) {
  try {
    const user = await loadUser(req);
    if (!user) return res.status(401).json({ error: "ต้อง login ก่อน" });
    if (user.role !== "admin")
      return res.status(403).json({ error: "ต้องเป็น admin" });
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = {
  deriveUsername,
  isAdmin,
  signToken,
  verifyToken,
  requireAdmin,
  requireUser,
};
