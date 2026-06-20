const { Pool } = require("pg");

// ท่อเชื่อม Postgres ใช้ร่วมกันทั้งแอป (อ่านที่อยู่จาก env ใน docker-compose)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// สร้างตารางตอนแอปเริ่ม — มีตารางใหม่ก็เพิ่ม CREATE TABLE ที่นี่
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id         SERIAL PRIMARY KEY,
      text       TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS detections (
      id         SERIAL PRIMARY KEY,
      filename   TEXT NOT NULL,
      label      TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log("DB ready");
}

module.exports = { pool, initDb };
