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
      plate      TEXT NOT NULL,          -- เลขทะเบียน
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

  await pool.query(`
    ALTER TABLE detections ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false`);

  await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE`);

  await pool.query(`
      ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id          serial PRIMARY KEY,
      plate       text NOT NULL,
      province    text,
      owner_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status      text NOT NULL DEFAULT 'pending',
      approved_by integer REFERENCES users(id) ON DELETE SET NULL,
      approved_at timestamptz,
      created_at  timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT vehicles_status_chk CHECK (status IN ('pending','approved','revoked')),
      CONSTRAINT vehicles_plate_province_key UNIQUE (plate, province)
    )`);

  await pool.query(`
    ALTER TABLE detections
      ADD COLUMN IF NOT EXISTS matched_vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS access_granted BOOLEAN NOT NULL DEFAULT false`);

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
