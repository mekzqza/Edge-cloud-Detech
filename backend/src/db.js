const { Pool } = require("pg");
const { hashPassword } = require("./auth");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

  // เจ้าของ = entity ของตัวเอง; user_id เป็นของแถม (NULL = เจ้าของที่ไม่มี account)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS owners (
      id         serial PRIMARY KEY,
      full_name  text NOT NULL,
      contact    text,
      user_id    integer UNIQUE REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);

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

  // import CSV รับรถที่ยังไม่รู้เจ้าของได้ — owner_id NULL = ยังไม่ผูกผู้ใช้
  await pool.query(`
    ALTER TABLE vehicles ALTER COLUMN owner_id DROP NOT NULL`);

  // เลขในป้ายเป็น blocking key ของ fuzzy match — generated ไว้เลยไม่มีทางหลุด sync กับ plate
  await pool.query(`
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS plate_digits text
      GENERATED ALWAYS AS (regexp_replace(plate, '[^0-9]', '', 'g')) STORED`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS vehicles_plate_digits_idx ON vehicles (plate_digits)`);

  await pool.query(`
    ALTER TABLE detections
      ADD COLUMN IF NOT EXISTS matched_vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS access_granted BOOLEAN NOT NULL DEFAULT false`);

  // เข้า/ออก มาจาก pk กล้องที่ Pi ส่งมา — แถวเก่า (กล้องตัวเดียว) เป็น 'unknown'
  await pool.query(`
    ALTER TABLE detections
      ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'unknown'
      CHECK (direction IN ('in','out','unknown'))`);

  // plate = ค่าที่ระบบเชื่อ (จับคู่รถได้ก็ใช้ป้ายที่ลงทะเบียนไว้), plate_raw = ค่าที่ Pi อ่านได้จริง
  // เติมทั้งสองช่องเสมอ ไม่แมตช์ก็เท่ากัน — fallback จึงไม่ต้องมี COALESCE/?? ที่ไหนเลย
  await pool.query(`
    ALTER TABLE detections ADD COLUMN IF NOT EXISTS plate_raw text`);
  await pool.query(`
    UPDATE detections SET plate_raw = plate WHERE plate_raw IS NULL`);
  await pool.query(`
    ALTER TABLE detections ALTER COLUMN plate_raw SET NOT NULL`);

  // vehicles.owner_id เคยชี้ users — ย้ายไปชี้ owners ครั้งเดียว
  // เช็คจากปลายทางของ FK เอง ไม่ต้องมีตาราง migration
  const {
    rows: [fk],
  } = await pool.query(
    `SELECT confrelid::regclass::text AS target FROM pg_constraint
      WHERE conrelid = 'vehicles'::regclass AND conname = 'vehicles_owner_id_fkey'`,
  );
  if (fk && fk.target === "users") {
    // ไม่มี params = simple query protocol = ทั้งก้อนอยู่ใน transaction เดียวให้เอง
    await pool.query(`
      INSERT INTO owners (full_name, user_id)
      SELECT u.username, u.id FROM users u
       WHERE EXISTS (SELECT 1 FROM vehicles v WHERE v.owner_id = u.id)
      ON CONFLICT (user_id) DO NOTHING;

      UPDATE vehicles v SET owner_id = o.id FROM owners o WHERE o.user_id = v.owner_id;

      ALTER TABLE vehicles
        DROP CONSTRAINT vehicles_owner_id_fkey,
        ADD CONSTRAINT vehicles_owner_id_fkey FOREIGN KEY (owner_id)
            REFERENCES owners(id) ON DELETE SET NULL;
    `);
    console.log("migrated vehicles.owner_id -> owners");
  }

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
