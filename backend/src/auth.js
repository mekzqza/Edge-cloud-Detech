const crypto = require("crypto");

// ponytail: ใช้ crypto ของ node ล้วน (scrypt + HMAC) ไม่เพิ่ม bcrypt/jsonwebtoken
// upgrade path: ถ้ามี user เยอะ/ต้อง revoke token → ย้ายไป session store หรือ jsonwebtoken
const SECRET = process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me";
if (SECRET === "dev-only-insecure-secret-change-me") {
  console.warn("⚠️  AUTH_SECRET ไม่ได้ตั้ง — ใช้ค่า default (อย่าใช้ตอน production)");
}
const TOKEN_TTL_SEC = 7 * 24 * 60 * 60; // 7 วัน

// --- password: scrypt, เก็บเป็น "salt:hash" (hex) ---
function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(plain, stored) {
  const [saltHex, hashHex] = String(stored).split(":");
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(plain, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return hash.length === expected.length && crypto.timingSafeEqual(hash, expected);
}

// --- token: base64url(payload).hmac — stateless, เซ็นด้วย SECRET ---
function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sign(payloadB64) {
  return b64url(crypto.createHmac("sha256", SECRET).update(payloadB64).digest());
}

function signToken({ username, role }) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
  const payloadB64 = b64url(Buffer.from(JSON.stringify({ username, role, exp })));
  return `${payloadB64}.${sign(payloadB64)}`;
}

function verifyToken(token) {
  const [payloadB64, sig] = String(token).split(".");
  if (!payloadB64 || !sig) return null;
  const good = sign(payloadB64);
  // เทียบ signature แบบ constant-time
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) {
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

// --- middleware ---
function authUser(req) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  return token ? verifyToken(token) : null;
}

function requireAdmin(req, res, next) {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: "ต้อง login ก่อน" });
  if (user.role !== "admin") return res.status(403).json({ error: "ต้องเป็น admin" });
  req.user = user;
  next();
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, requireAdmin };
