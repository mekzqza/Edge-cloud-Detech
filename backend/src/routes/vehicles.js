const { Router } = require("express");
const { pool } = require("../db");
const { requireUser, requireAdmin } = require("../auth");

const router = Router();

// express 4 ไม่จับ async throw เอง — ไม่ห่อแล้ว query พังจะค้างจน timeout
const h = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// รูปแบบถูกอย่างเดียวไม่พอ — "2026-13-99" ผ่าน regex แต่ ::date ใน SQL จะระเบิดเป็น 500
const isDate = (s) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? "")) && !Number.isNaN(Date.parse(s));

// รับได้ทั้งไม่ส่ง (undefined) และ string ที่ไม่ว่าง; อย่างอื่นคือ error
function field(v) {
  if (v === undefined) return undefined;
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

router.post(
  "/vehicles",
  requireUser,
  h(async (req, res) => {
    const plate = field(req.body.plate);
    const province = field(req.body.province);
    if (!plate || !province) {
      return res
        .status(400)
        .json({ error: "ต้องมี plate และ province เป็นข้อความที่ไม่ว่าง" });
    }

    // UNIQUE (plate, province) กันซ้ำอยู่แล้ว — เช็คก่อน insert เปิดช่องให้แข่งกัน
    const { rows } = await pool.query(
      `INSERT INTO vehicles (plate, province, owner_id) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING RETURNING *`,
      [plate, province, req.user.id],
    );
    if (!rows[0]) return res.status(409).json({ error: "รถคันนี้มีอยู่แล้ว" });
    return res.status(201).json(rows[0]);
  }),
);

router.get(
  "/vehicles",
  requireUser,
  h(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM vehicles WHERE owner_id = $1 ORDER BY created_at DESC`,
      [req.user.id],
    );
    return res.json(rows);
  }),
);

router.delete(
  "/vehicles/:id",
  requireUser,
  h(async (req, res) => {
    const vehicleId = Number(req.params.id);
    if (!Number.isInteger(vehicleId)) {
      return res.status(400).json({ error: "vehicle id ต้องเป็นตัวเลข" });
    }

    // owner_id อยู่ใน WHERE = เช็คความเป็นเจ้าของกับลบในคิวรี่เดียว
    const { rows } = await pool.query(
      `DELETE FROM vehicles WHERE id = $1 AND owner_id = $2 RETURNING id`,
      [vehicleId, req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "ไม่พบรถคันนี้" });
    return res.json({ message: "ลบรถคันนี้เรียบร้อยแล้ว" });
  }),
);

router.patch(
  "/vehicles/:id",
  requireUser,
  h(async (req, res) => {
    const vehicleId = Number(req.params.id);
    if (!Number.isInteger(vehicleId)) {
      return res.status(400).json({ error: "vehicle id ต้องเป็นตัวเลข" });
    }
    const plate = field(req.body.plate);
    const province = field(req.body.province);
    if (plate === null || province === null) {
      return res.status(400).json({ error: "plate/province ต้องไม่ว่าง" });
    }

    // แก้ทะเบียนแล้วยังค้าง approved = ย้ายทะเบียนไปเป็นของคนอื่นแล้วได้สิทธิ์ฟรี
    // ponytail: reset ทุกครั้งที่ patch เพราะมีแค่ 2 ฟิลด์นี้ให้แก้ ไม่ต้องเทียบค่าเก่า
    const { rows } = await pool.query(
      `UPDATE vehicles
          SET plate = COALESCE($1, plate),
              province = COALESCE($2, province),
              status = 'pending', approved_by = NULL, approved_at = NULL
        WHERE id = $3 AND owner_id = $4
        RETURNING *`,
      [plate ?? null, province ?? null, vehicleId, req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "ไม่พบรถคันนี้" });
    return res.json(rows[0]);
  }),
);

/* ===== ฝั่ง admin: อนุมัติ/ปฏิเสธคำขอ ===== */

// GET /admin/vehicles?status=&date=YYYY-MM-DD&q=ชื่อผู้ใช้&plate=
router.get(
  "/admin/vehicles",
  requireAdmin,
  h(async (req, res) => {
    const cond = [];
    const params = [];
    const where = (sql, value) => {
      params.push(value);
      cond.push(sql.replace("$?", `$${params.length}`));
    };

    const { status, date, q, plate } = req.query;
    if (["pending", "approved", "revoked"].includes(status)) {
      where("v.status = $?", status);
    }
    if (isDate(date)) {
      where(
        "(v.created_at AT TIME ZONE 'Asia/Bangkok')::date = $?::date",
        date,
      );
    }
    if (typeof q === "string" && q.trim()) {
      where("u.username ILIKE $?", `%${q.trim()}%`);
    }
    if (typeof plate === "string" && plate.trim()) {
      where("v.plate ILIKE $?", `%${plate.trim()}%`);
    }

    // ponytail: LIMIT ตายตัวแทน pagination — คำขอค้างพร้อมกันเป็นร้อยค่อยว่ากัน
    const { rows } = await pool.query(
      `SELECT v.*, u.username AS owner_name, a.username AS approved_by_name
         FROM vehicles v
         JOIN users u ON u.id = v.owner_id
         LEFT JOIN users a ON a.id = v.approved_by
         ${cond.length ? `WHERE ${cond.join(" AND ")}` : ""}
        ORDER BY v.created_at DESC
        LIMIT 200`,
      params,
    );
    return res.json(rows);
  }),
);

// อนุมัติ = approved, ปฏิเสธ = revoked (ใช้สถานะเดิมใน schema ไม่เพิ่มค่าใหม่)
// approved_by/at เก็บ "ใครตัดสิน เมื่อไหร่" ทั้งสองทาง ไม่ใช่เฉพาะตอนอนุมัติ
router.patch(
  "/admin/vehicles/:id",
  requireAdmin,
  h(async (req, res) => {
    const vehicleId = Number(req.params.id);
    if (!Number.isInteger(vehicleId)) {
      return res.status(400).json({ error: "vehicle id ต้องเป็นตัวเลข" });
    }
    const { status } = req.body;
    if (status !== "approved" && status !== "revoked") {
      return res
        .status(400)
        .json({ error: "status ต้องเป็น approved หรือ revoked" });
    }

    const { rows } = await pool.query(
      `UPDATE vehicles SET status = $1, approved_by = $2, approved_at = now()
        WHERE id = $3 RETURNING *`,
      [status, req.user.id, vehicleId],
    );
    if (!rows[0]) return res.status(404).json({ error: "ไม่พบรถคันนี้" });
    return res.json(rows[0]);
  }),
);

// ponytail: split(",") พอสำหรับ ทะเบียน/จังหวัด/username ที่ไม่มีลูกน้ำ
// เจอ CSV ที่มี quote หรือ comma ในค่า ค่อยเปลี่ยนไปใช้ csv-parse
function parseCsv(text) {
  const lines = text
    .replace(/^﻿/, "") // Excel ใส่ BOM มาให้ ไม่ตัดทิ้งคอลัมน์แรกจะชื่อ "﻿plate"
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  if (!lines.length) return [];
  const cols = lines
    .shift()
    .split(",")
    .map((c) => c.trim().toLowerCase());
  return lines.map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(
      cols.map((c, i) => [c, (cells[i] ?? "").trim()]),
    );
  });
}

// POST /api/admin/vehicles/import  — body เป็น CSV ดิบ, Content-Type: text/csv
// header ต้องมี plate,province,username ; import แล้ว = approved เลย
router.post(
  "/admin/vehicles/import",
  requireAdmin,
  h(async (req, res) => {
    // express.text() ให้ string เสมอเมื่อ content-type ตรง; ไม่ตรงจะได้ {} จาก express.json()
    const text = typeof req.body === "string" ? req.body : "";
    if (!text.trim()) {
      return res
        .status(400)
        .json({ error: "ต้องส่ง CSV มาใน body พร้อม Content-Type: text/csv" });
    }

    const records = parseCsv(text);
    if (!records.length) {
      return res.status(400).json({ error: "ไม่มีข้อมูลในไฟล์ CSV" });
    }
    if (records.length > 5000) {
      return res.status(400).json({ error: "ไฟล์ CSV มีขนาดใหญ่เกินไป" });
    }

    const missingCols = ["plate", "province", "username"].filter(
      (c) => !(c in records[0]),
    );
    if (missingCols.length) {
      return res
        .status(400)
        .json({ error: `CSV ขาดคอลัมน์: ${missingCols.join(",")}` });
    }

    const plates = records.map((r) => r.plate);
    const provinces = records.map((r) => r.province);
    const usernames = records.map((r) => r.username);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `CREATE TEMP TABLE t (plate text, province text, username text)
         ON COMMIT DROP`,
      );
      await client.query(
        `INSERT INTO t (plate, province, username)
         SELECT * FROM unnest($1::text[], $2::text[], $3::text[])`,
        [plates, provinces, usernames],
      );

      // province ว่าง = ข้าม ไม่ใช่ insert เป็น NULL — UNIQUE (plate, province) ไม่จับ NULL
      // ปล่อยผ่านคือเปิดช่องให้ทะเบียนเดิมโผล่ซ้ำได้เรื่อยๆ
      const { rows: skipped } = await client.query(
        `SELECT t.plate, t.username,
                CASE WHEN t.plate = '' THEN 'ทะเบียนว่าง'
                     WHEN t.province = '' THEN 'จังหวัดว่าง'
                     ELSE 'ไม่พบผู้ใช้' END AS reason
           FROM t LEFT JOIN users u ON u.username = t.username
          WHERE t.plate = '' OR t.province = '' OR u.id IS NULL`,
      );

      const {
        rows: [{ inserted }],
      } = await client.query(
        `WITH ins AS (
           INSERT INTO vehicles (plate, province, owner_id, status, approved_by, approved_at)
           SELECT DISTINCT t.plate, t.province, u.id, 'approved', $1::int, now()
             FROM t JOIN users u ON u.username = t.username
            WHERE t.plate <> '' AND t.province <> ''
           ON CONFLICT (plate, province) DO NOTHING
           RETURNING 1
         )
         SELECT count(*)::int AS inserted FROM ins`,
        [req.user.id],
      );

      await client.query("COMMIT");
      return res.json({
        total: records.length,
        inserted,
        skipped,
        duplicated: records.length - inserted - skipped.length,
      });
    } catch (err) {
      // ROLLBACK เองก็พังได้ถ้า connection ตาย — กลืนไว้ ไม่งั้น error ตัวจริงหาย
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }),
);

// แก้ทะเบียนไปชนคันที่มีอยู่แล้ว = ผู้ใช้ทำผิด ไม่ใช่ 500
router.use((err, _req, res, next) =>
  err.code === "23505"
    ? res.status(409).json({ error: "รถคันนี้มีอยู่แล้ว" })
    : next(err),
);

module.exports = router;

// node src/routes/vehicles.js — เช็ค parser อย่างเดียว ส่วน SQL ต้องยิงจริงถึงจะรู้
if (require.main === module) {
  const assert = require("assert");
  const rows = parseCsv(
    "﻿plate,province,username\r\n1กก1234, กรุงเทพมหานคร ,somchai\r\n\r\n2ขข5678,,\r\n",
  );
  assert.deepStrictEqual(rows, [
    { plate: "1กก1234", province: "กรุงเทพมหานคร", username: "somchai" },
    { plate: "2ขข5678", province: "", username: "" },
  ]);
  assert.deepStrictEqual(parseCsv("plate,province,username\n"), []);
  assert.deepStrictEqual(parseCsv(""), []);
  console.log("parseCsv ok");
}
