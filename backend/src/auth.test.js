// node backend/src/auth.test.js — เช็ค scrypt hash/verify ที่ /login กับ /password พึ่งพา
const assert = require("assert");
process.env.AUTH_SECRET ||= "test-secret";
const { hashPassword, verifyPassword } = require("./auth");

const stored = hashPassword("hunter2พาสเวิร์ด");
assert.ok(verifyPassword("hunter2พาสเวิร์ด", stored), "รหัสถูกต้องต้องผ่าน");
assert.ok(!verifyPassword("hunter3", stored), "รหัสผิดต้องไม่ผ่าน");
assert.notStrictEqual(
  hashPassword("x"),
  hashPassword("x"),
  "salt ต้องไม่ซ้ำกัน",
);

// บัญชี Google ล้วน (password_hash = NULL) ต้องล็อกอินด้วยรหัสไม่ได้
assert.ok(!verifyPassword("anything", null), "hash NULL ต้องไม่ผ่าน");
assert.ok(!verifyPassword("anything", ""), "hash ว่างต้องไม่ผ่าน");
assert.ok(!verifyPassword("anything", "ไม่มีโคลอน"), "hash เพี้ยนต้องไม่ผ่าน");

console.log("auth ok");
