const { Pool } = require("pg");
const { deriveUsername } = require("./auth");

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
      username      TEXT UNIQUE,                     -- NULL = เจ้าของที่ import ชื่อมา ยังไม่มี account
      password_hash TEXT,                            -- NULL = ล็อกอินด้วย Google อย่างเดียว
      full_name     TEXT,                            -- ชื่อเจ้าของรถ (จาก CSV)
      contact       TEXT,
      role          TEXT NOT NULL DEFAULT 'user'   -- 'user' | 'admin'
    )
  `);

  await pool.query(`
    ALTER TABLE detections ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false`);

  await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE`);

  await pool.query(`
      ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);

  // admin ตั้งรหัสให้ตอนสร้าง account → บังคับเปลี่ยนก่อนใช้งาน
  // default false — คนที่ล็อกอิน Google ไม่มีรหัสให้เปลี่ยนอยู่แล้ว
  await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false`);

  // เจ้าของยุบเข้า users แถวเดียวกันแล้ว — แถวที่ username NULL คือเจ้าของที่ล็อกอินไม่ได้
  await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT,
                        ADD COLUMN IF NOT EXISTS contact   TEXT`);
  await pool.query(`
      ALTER TABLE users ALTER COLUMN username DROP NOT NULL`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id          serial PRIMARY KEY,
      plate       text NOT NULL,
      province    text,
      owner_id    integer REFERENCES users(id) ON DELETE SET NULL,
      status      text NOT NULL DEFAULT 'pending',
      approved_by integer REFERENCES users(id) ON DELETE SET NULL,
      approved_at timestamptz,
      created_at  timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT vehicles_status_chk CHECK (status IN ('pending','approved','revoked')),
      CONSTRAINT vehicles_plate_province_key UNIQUE (plate, province)
    )`);

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

  // conf แยก 3 ตัวจาก Pi: confidence = YOLO ของกล่องป้าย, อีกสองตัวมาจาก OCR/fuzzy
  // nullable — รุ่นเก่าไม่ส่งมา และ OCR อ่านไม่ออกก็ส่ง null ได้
  await pool.query(`
    ALTER TABLE detections
      ADD COLUMN IF NOT EXISTS plate_confidence REAL,
      ADD COLUMN IF NOT EXISTS province_confidence REAL`);

  // plate = ค่าที่ระบบเชื่อ (จับคู่รถได้ก็ใช้ป้ายที่ลงทะเบียนไว้), plate_raw = ค่าที่ Pi อ่านได้จริง
  // เติมทั้งสองช่องเสมอ ไม่แมตช์ก็เท่ากัน — fallback จึงไม่ต้องมี COALESCE/?? ที่ไหนเลย
  await pool.query(`
    ALTER TABLE detections ADD COLUMN IF NOT EXISTS plate_raw text`);
  await pool.query(`
    UPDATE detections SET plate_raw = plate WHERE plate_raw IS NULL`);
  await pool.query(`
    ALTER TABLE detections ALTER COLUMN plate_raw SET NOT NULL`);

  // ตาราง owners ถูกยุบเข้า users — ย้ายครั้งเดียวถ้า FK ยังชี้ owners อยู่
  // เช็คจากปลายทางของ FK เอง ไม่ต้องมีตาราง migration
  const {
    rows: [fk],
  } = await pool.query(
    `SELECT confrelid::regclass::text AS target FROM pg_constraint
      WHERE conrelid = 'vehicles'::regclass AND conname = 'vehicles_owner_id_fkey'`,
  );
  if (fk && fk.target === "owners") {
    // ไม่มี params = simple query protocol = ทั้งก้อนอยู่ใน transaction เดียวให้เอง
    await pool.query(`
      ALTER TABLE owners ADD COLUMN IF NOT EXISTS new_user_id integer;

      UPDATE users u SET full_name = COALESCE(u.full_name, o.full_name),
                         contact   = COALESCE(u.contact,   o.contact)
        FROM owners o WHERE o.user_id = u.id;
      UPDATE owners SET new_user_id = user_id WHERE user_id IS NOT NULL;

      -- ponytail: วน loop เพราะชื่อซ้ำกันได้ join กลับด้วย full_name ไม่ปลอดภัย
      -- รันครั้งเดียวตอน migrate แถวหลักร้อย
      DO $$ DECLARE o RECORD; uid int; BEGIN
        FOR o IN SELECT id, full_name, contact FROM owners WHERE user_id IS NULL LOOP
          INSERT INTO users (full_name, contact) VALUES (o.full_name, o.contact)
            RETURNING id INTO uid;
          UPDATE owners SET new_user_id = uid WHERE id = o.id;
        END LOOP;
      END $$;

      UPDATE vehicles v SET owner_id = o.new_user_id FROM owners o WHERE v.owner_id = o.id;

      ALTER TABLE vehicles
        DROP CONSTRAINT vehicles_owner_id_fkey,
        ADD CONSTRAINT vehicles_owner_id_fkey FOREIGN KEY (owner_id)
            REFERENCES users(id) ON DELETE SET NULL;

      DROP TABLE owners;
    `);
    console.log("migrated owners -> users");
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id           serial PRIMARY KEY,
      detection_id integer NOT NULL REFERENCES detections(id) ON DELETE CASCADE,
      reason       text NOT NULL,          -- เหตุผลที่แจ้งเตือน เช่น 'unregistered' / 'revoked'
      created_at   timestamptz NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC)`);

  // อ่านแล้วเป็นรายคน — pk คู่ กันซ้ำโดยไม่ต้องมี id ของตัวเอง
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_reads (
      notification_id integer NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
      user_id         integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at         timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (notification_id, user_id)
    )`);

  // admin คนแรก — จองแถวให้ ADMIN_EMAIL ไว้ก่อน จะได้เป็น admin ตั้งแต่ล็อกอิน Google ครั้งแรก
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!adminEmail) throw new Error("ADMIN_EMAIL is not set");
  await pool.query(
    `INSERT INTO users (username, email, role) VALUES ($1, $2, 'admin')
     ON CONFLICT DO NOTHING`,
    [deriveUsername(adminEmail), adminEmail],
  );
  // มีแถวอยู่แล้ว (เคยล็อกอินมาก่อน หรือเพิ่งเปลี่ยน ADMIN_EMAIL) → เลื่อนขั้นให้
  await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [
    adminEmail,
  ]);

  console.log("DB ready");
}

module.exports = { pool, initDb };
