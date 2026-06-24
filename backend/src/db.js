const { Pool } = require("pg");
const { hashPassword } = require("./auth");

// ท่อเชื่อม Postgres ใช้ร่วมกันทั้งแอป (อ่านที่อยู่จาก env ใน docker-compose)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// สร้างตารางตอนแอปเริ่ม — มีตารางใหม่ก็เพิ่ม CREATE TABLE ที่นี่
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS detections (
      id         SERIAL PRIMARY KEY,
      filename   TEXT NOT NULL,
      plate      TEXT NOT NULL,           -- เลขทะเบียน
      province   TEXT NOT NULL,           -- จังหวัด
      confidence REAL NOT NULL,           -- ความแม่นยำ 0..1
      captured_at TIMESTAMPTZ,            -- เวลาที่ Pi ถ่าย/ส่ง (Pi เป็นคนส่งมา)
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'user'   -- 'user' | 'admin'
    )
  `);

  // seed admin จาก env ครั้งแรก (ถ้ายังไม่มี user ชื่อนี้) — เปลี่ยนรหัสผ่านทีหลังได้
  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPass = process.env.ADMIN_PASSWORD || "admin1234";
  await pool.query(
    `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin')
     ON CONFLICT (username) DO NOTHING`,
    [adminUser, hashPassword(adminPass)],
  );

  console.log("DB ready");
}

module.exports = { pool, initDb };
