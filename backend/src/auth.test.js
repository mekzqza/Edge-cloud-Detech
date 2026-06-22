// รัน: node src/auth.test.js  (ไม่ใช้ framework — assert ล้วน)
const assert = require("assert");
const { hashPassword, verifyPassword, signToken, verifyToken } = require("./auth");

// password: hash แล้ว verify ได้, รหัสผิด verify ไม่ผ่าน
const h = hashPassword("s3cret");
assert(verifyPassword("s3cret", h), "รหัสถูกต้องควรผ่าน");
assert(!verifyPassword("wrong", h), "รหัสผิดไม่ควรผ่าน");
assert(h !== hashPassword("s3cret"), "salt ต่างกันทุกครั้ง → hash ต่างกัน");

// token: เซ็นแล้ว verify คืน payload เดิม
const t = signToken({ username: "admin", role: "admin" });
const p = verifyToken(t);
assert(p && p.username === "admin" && p.role === "admin", "token ที่ถูกต้องต้อง decode ได้");

// token ที่ถูกแก้ signature ต้องถูก reject
assert(verifyToken(t.slice(0, -2) + "xx") === null, "token ปลอมต้องถูกปฏิเสธ");
assert(verifyToken("garbage") === null, "token มั่วต้องถูกปฏิเสธ");

// token หมดอายุต้องถูก reject
const expired = signToken({ username: "a", role: "user" });
const [payloadB64] = expired.split(".");
const decoded = JSON.parse(Buffer.from(payloadB64, "base64").toString());
assert(decoded.exp > Math.floor(Date.now() / 1000), "token สดต้องยังไม่หมดอายุ");

console.log("✅ auth tests passed");
