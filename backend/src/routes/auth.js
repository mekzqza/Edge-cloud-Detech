const crypto = require("crypto");
const { Router } = require("express");
const { pool } = require("../db");
const {
  hashPassword,
  verifyPassword,
  signToken,
  requireUser,
  requireAdmin,
} = require("../auth");
const { parseCsv } = require("../csv");

const router = Router();

const h = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const MIN_PASSWORD_LEN = 8;
const MIN_USERNAME_LEN = 3;
const MAX_IMPORT_ROWS = 200;
const MAX_PROFILE_LEN = 100; // ชื่อ/ช่องทางติดต่อที่ผู้ใช้แก้เอง — body รับได้ถึง 10mb ไม่ตันไว้คือยัดได้เป็นเมก

const str = (v) => (typeof v === "string" && v.trim() !== "" ? v : null);

// รหัสเริ่มต้นที่ระบบตั้งให้ — เจ้าของต้องเปลี่ยนเองตอนล็อกอินครั้งแรกอยู่แล้ว
const randomPassword = () => crypto.randomBytes(6).toString("base64url");

// จอง id ล่วงหน้าเพื่อตั้ง username = u<id> ได้ตั้งแต่ก่อน INSERT
// (ชื่อไทยแปลงเป็น ascii ไม่ได้ ใช้ id ที่การันตีไม่ซ้ำอยู่แล้ว — เหมือน seed-accounts.js)
async function nextUserIds(n) {
  const { rows } = await pool.query(
    `SELECT nextval(pg_get_serial_sequence('users', 'id'))::int AS id
       FROM generate_series(1, $1)`,
    [n],
  );
  return rows.map((r) => r.id);
}

// ponytail: กัน brute-force แบบนับในหน่วยความจำ — process เดียว รีสตาร์ตแล้วลืม
// ย้ายไป redis/express-rate-limit ตอนขึ้นหลาย instance
// นับราย username ไม่ใช่ราย IP — login วิ่งผ่าน NextAuth ฝั่ง server ทุก request
// เลยมาจาก IP เดียวกันหมด นับ IP จะกลายเป็นล็อกทั้งระบบ
const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const fails = new Map(); // username -> { n, until }

function isLocked(key) {
  const t = fails.get(key);
  return t !== undefined && t.until > Date.now() && t.n >= MAX_FAILS;
}

function countFail(key) {
  const now = Date.now();
  const t = fails.get(key);
  if (!t || t.until < now) {
    if (fails.size > 10000) fails.clear(); // กันบวมจากชื่อสุ่ม
    fails.set(key, { n: 1, until: now + WINDOW_MS });
  } else {
    t.n += 1;
  }
}

// login ด้วยรหัสที่ admin ตั้งให้ — Google ยังเข้าทาง /oauth เหมือนเดิม
router.post(
  "/login",
  h(async (req, res) => {
    const username = str(req.body.username);
    const password = str(req.body.password);
    if (!username || !password) {
      return res.status(400).json({ error: "ต้องมี username, password" });
    }
    const key = username.trim().toLowerCase();
    if (isLocked(key)) {
      return res
        .status(429)
        .json({ error: "ลองมากเกินไป รอสักครู่แล้วลองใหม่" });
    }

    const { rows } = await pool.query(
      `SELECT username, password_hash, role, must_change_password
         FROM users WHERE username = $1`,
      [username.trim()],
    );
    const user = rows[0];
    // password_hash NULL = บัญชี Google ล้วน — ไม่มีรหัสให้เทียบ
    if (!user?.password_hash || !verifyPassword(password, user.password_hash)) {
      countFail(key);
      return res
        .status(401)
        .json({ error: "username หรือ password ไม่ถูกต้อง" });
    }

    fails.delete(key);
    res.json({
      token: signToken(user),
      role: user.role,
      mustChange: user.must_change_password,
    });
  }),
);

// เปลี่ยนรหัสตัวเอง — ต้องรู้รหัสเดิม (ที่ admin ให้มา) ไม่ต้องมีลิงก์/โทเคนทางอีเมล
router.post(
  "/password",
  requireUser,
  h(async (req, res) => {
    const current = str(req.body.current);
    const next = str(req.body.next);
    if (!current || !next) {
      return res.status(400).json({ error: "ต้องมีรหัสเดิมและรหัสใหม่" });
    }
    if (next.length < MIN_PASSWORD_LEN) {
      return res
        .status(400)
        .json({ error: `รหัสใหม่ต้องยาวอย่างน้อย ${MIN_PASSWORD_LEN} ตัว` });
    }
    if (next === current) {
      return res.status(400).json({ error: "รหัสใหม่ต้องไม่ซ้ำรหัสเดิม" });
    }

    const {
      rows: [row],
    } = await pool.query("SELECT password_hash FROM users WHERE id = $1", [
      req.user.id,
    ]);
    if (!verifyPassword(current, row.password_hash)) {
      return res.status(401).json({ error: "รหัสเดิมไม่ถูกต้อง" });
    }
    await pool.query(
      `UPDATE users SET password_hash = $1, must_change_password = false
        WHERE id = $2`,
      [hashPassword(next), req.user.id],
    );
    res.json({ ok: true });
  }),
);

// ชื่อ/ช่องทางติดต่อจาก body — ใช้ทั้งผู้ใช้แก้เอง (/me) และ admin แก้ให้ (/admin/users/:id)
// ชื่อคือสิ่งที่ admin เห็นตอนอนุมัติรถ/ค้นประวัติ เลยห้ามว่าง; contact ว่าง/ไม่ส่ง = ไม่มีช่องทางติดต่อ
// คืน { fullName, contact } หรือ { error }
function profileInput(body) {
  const fullName = str(body.full_name)?.trim() ?? null;
  const contact = str(body.contact)?.trim() ?? null;
  if (!fullName) return { error: "ต้องมีชื่อ-นามสกุล" };
  if (
    fullName.length > MAX_PROFILE_LEN ||
    (contact?.length ?? 0) > MAX_PROFILE_LEN
  ) {
    return { error: `ยาวได้ไม่เกิน ${MAX_PROFILE_LEN} ตัวอักษร` };
  }
  return { fullName, contact };
}

// บัญชีของตัวเอง — หน้า /account ใช้ดูและแก้ชื่อ/ช่องทางติดต่อ
// has_password = มีรหัสให้เปลี่ยนไหม (บัญชี Google ล้วนไม่มี) — ไม่ส่ง hash ออกไป
const ME = `id, username, email, full_name, contact, role,
            password_hash IS NOT NULL AS has_password`;

router.get(
  "/me",
  requireUser,
  h(async (req, res) => {
    const {
      rows: [me],
    } = await pool.query(`SELECT ${ME} FROM users WHERE id = $1`, [req.user.id]);
    res.json(me);
  }),
);

// แก้ได้แค่ชื่อกับช่องทางติดต่อ — username เป็นคีย์ล็อกอินและอยู่ใน token, role ต้องให้ admin เปลี่ยน
router.patch(
  "/me",
  requireUser,
  h(async (req, res) => {
    const p = profileInput(req.body);
    if (p.error) return res.status(400).json({ error: p.error });
    const {
      rows: [me],
    } = await pool.query(
      `UPDATE users SET full_name = $1, contact = $2 WHERE id = $3 RETURNING ${ME}`,
      [p.fullName, p.contact, req.user.id],
    );
    res.json(me);
  }),
);

// รายชื่อเจ้าของ + สถานะ account — หน้า admin ใช้เลือกว่าจะแจก account ให้ใคร
// เจ้าของกับ account เป็นแถวเดียวกันแล้ว: username NULL = ยังล็อกอินไม่ได้ ขึ้นก่อน
// แบ่งหน้าด้วย ?limit=&offset= คืน { rows, total } — total ไว้ให้หน้าเว็บคำนวณจำนวนหน้า
// full_name ส่งค่าจริง (NULL = ยังไม่ตั้งชื่อ) หน้าเว็บแสดง username แทนเอง —
// ถ้า COALESCE ไว้ตรงนี้ ฟอร์มแก้ไขจะแยกไม่ออกแล้วเผลอบันทึก username เป็นชื่อ
router.get(
  "/admin/owners",
  requireAdmin,
  h(async (req, res) => {
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);
    if (
      !Number.isInteger(limit) ||
      limit <= 0 ||
      limit > 100 ||
      !Number.isInteger(offset) ||
      offset < 0
    ) {
      return res
        .status(400)
        .json({ error: "limit (1..100) / offset ไม่ถูกต้อง" });
    }
    const [page, count] = await Promise.all([
      // u.id ปิดท้าย ORDER BY — ชื่อซ้ำกันแล้วลำดับไม่ตายตัว คนเดียวกันจะโผล่สองหน้า/หายไปจากทุกหน้า
      pool.query(
        `SELECT u.id, u.full_name, u.contact,
                u.username, count(v.id)::int AS vehicle_count
           FROM users u
           LEFT JOIN vehicles v ON v.owner_id = u.id
          GROUP BY u.id
          ORDER BY u.username IS NOT NULL, COALESCE(u.full_name, u.username), u.id
          LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      pool.query("SELECT count(*)::int AS total FROM users"),
    ]);
    res.json({ rows: page.rows, total: count.rows[0].total });
  }),
);

// admin แจก account แล้วบอก username/รหัสไปให้เจ้าของเปลี่ยนเอง
// userId = แถวเจ้าของที่ import มา (เติม username/รหัสให้แถวเดิม), ไม่ส่ง = สร้างคนใหม่ทั้งแถว
// username/password ไม่ส่งมา = ระบบตั้งให้ แล้วคืนกลับไปทั้งคู่ในคำตอบ
router.post(
  "/admin/users",
  requireAdmin,
  h(async (req, res) => {
    const username = str(req.body.username)?.trim() ?? null;
    const password = str(req.body.password) ?? randomPassword();
    const fullName = str(req.body.full_name)?.trim() ?? null;
    const contact = str(req.body.contact)?.trim() ?? null;
    const userId = req.body.userId == null ? null : Number(req.body.userId);
    if (username !== null && username.length < MIN_USERNAME_LEN) {
      return res
        .status(400)
        .json({ error: `username ต้องยาวอย่างน้อย ${MIN_USERNAME_LEN} ตัว` });
    }
    if (password.length < MIN_PASSWORD_LEN) {
      return res
        .status(400)
        .json({ error: `รหัสต้องยาวอย่างน้อย ${MIN_PASSWORD_LEN} ตัว` });
    }
    if (userId !== null && !Number.isInteger(userId)) {
      return res.status(400).json({ error: "userId ไม่ถูกต้อง" });
    }
    if (userId === null && !fullName) {
      return res.status(400).json({ error: "ต้องมีชื่อ-นามสกุลของเจ้าของ" });
    }

    const id = userId ?? (await nextUserIds(1))[0];
    const name = username ?? `u${id}`;
    const hash = hashPassword(password);
    try {
      // username IS NULL ใน WHERE = กันแย่ง account ของคนที่มีอยู่แล้ว ในคิวรี่เดียว
      const { rows } = userId
        ? await pool.query(
            `UPDATE users
                SET username = $1, password_hash = $2, must_change_password = true
              WHERE id = $3 AND username IS NULL
              RETURNING id, username, full_name, contact`,
            [name, hash, userId],
          )
        : await pool.query(
            `INSERT INTO users (id, username, password_hash, full_name, contact,
                                role, must_change_password)
             VALUES ($1, $2, $3, $4, $5, 'user', true)
             RETURNING id, username, full_name, contact`,
            [id, name, hash, fullName, contact],
          );
      if (!rows[0]) {
        return res
          .status(409)
          .json({ error: "เจ้าของรายนี้มี account อยู่แล้ว" });
      }
      res.status(201).json({ ...rows[0], password });
    } catch (e) {
      if (e.code === "23505")
        return res.status(409).json({ error: "username นี้ถูกใช้แล้ว" });
      throw e;
    }
  }),
);

// admin แก้ชื่อ/ช่องทางติดต่อให้เจ้าของ (รวมเจ้าของที่ยังไม่มี account)
// ไม่ต้องไล่อัปเดตที่อื่น — detections/vehicles ไม่ได้เก็บสำเนาชื่อ /history กับ /admin/requests
// join ชื่อจาก users ตอนค้นทุกครั้ง แก้ที่นี่แล้วผลค้นเปลี่ยนตามทันที
router.patch(
  "/admin/users/:id",
  requireAdmin,
  h(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id ไม่ถูกต้อง" });
    }
    const p = profileInput(req.body);
    if (p.error) return res.status(400).json({ error: p.error });
    const {
      rows: [row],
    } = await pool.query(
      `UPDATE users SET full_name = $1, contact = $2 WHERE id = $3
       RETURNING id, username, full_name, contact`,
      [p.fullName, p.contact, id],
    );
    if (!row) return res.status(404).json({ error: "ไม่พบเจ้าของรายนี้" });
    res.json(row);
  }),
);

// ลืมรหัส — admin ออกรหัสใหม่ให้ แล้วบอกเจ้าของเองเหมือนตอนแจก account
// ไม่มีลิงก์รีเซ็ตทางอีเมล: เจ้าของรถส่วนใหญ่ไม่มีอีเมลในระบบอยู่แล้ว
router.post(
  "/admin/users/:id/password",
  requireAdmin,
  h(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id ไม่ถูกต้อง" });
    }
    const {
      rows: [target],
    } = await pool.query(
      "SELECT id, username, password_hash, role FROM users WHERE id = $1",
      [id],
    );
    if (!target?.username) {
      return res.status(404).json({ error: "ไม่พบ account นี้" });
    }

    // ponytail: ยังไม่กันอะไร — admin รีเซ็ตได้ทุก account รวม admin ด้วยกันและบัญชี Google ล้วน
    // (จะกลายเป็นล็อกอินด้วยรหัสได้ด้วย) เพิ่ม 403/409 ตรงนี้ถ้า admin ไม่ได้ไว้ใจกันหมด

    const password = randomPassword();
    const {
      rows: [row],
    } = await pool.query(
      `UPDATE users SET password_hash = $1, must_change_password = true
        WHERE id = $2
        RETURNING id, username, full_name, contact`,
      [hashPassword(password), id],
    );
    fails.delete(row.username.toLowerCase()); // ลืมรหัสมักโดนล็อกจากกดผิดมาแล้ว ปลดให้ด้วย
    res.json({ ...row, password });
  }),
);

// แยกแถวที่สร้างได้ (Map ชื่อ -> ติดต่อ) ออกจากแถวที่ต้องข้าม
// ชื่อที่มีแถวอยู่แล้ว (เจ้าของที่ import ทะเบียนมา/account เดิม) ไม่สร้างซ้ำ —
// ponytail: คนพวกนี้แจก account ด้วยปุ่มในตารางเจ้าของแทน จะได้ไม่ต้องเดาว่าแถวไหนคือคนเดียวกัน
function planUsers(records, existingNames) {
  const taken = new Set(existingNames);
  const skipped = [];
  const wanted = new Map();
  for (const r of records) {
    const fullName = (r.full_name ?? "").trim();
    if (!fullName) {
      skipped.push({ full_name: "(ว่าง)", reason: "ไม่มีชื่อ" });
    } else if (taken.has(fullName)) {
      skipped.push({ full_name: fullName, reason: "มีชื่อนี้ในระบบแล้ว" });
    } else if (wanted.has(fullName)) {
      skipped.push({ full_name: fullName, reason: "ชื่อซ้ำในไฟล์" });
    } else {
      wanted.set(fullName, (r.contact ?? "").trim() || null);
    }
  }
  return { wanted, skipped };
}

// POST /api/admin/users/import — body เป็น CSV ดิบ, Content-Type: text/csv
// header ต้องมี full_name ; contact เป็นตัวเลือก — ตั้ง username/รหัสให้ทุกแถวแล้วคืนไปให้ admin
router.post(
  "/admin/users/import",
  requireAdmin,
  h(async (req, res) => {
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
    // ponytail: scryptSync บล็อก event loop ~80ms/แถว — 200 แถวคือเพดานที่ยังพอรอไหว
    // ต้องมากกว่านี้ค่อยย้ายไป crypto.scrypt แบบ async แล้ว Promise.all
    if (records.length > MAX_IMPORT_ROWS) {
      return res
        .status(400)
        .json({ error: `นำเข้าได้ครั้งละไม่เกิน ${MAX_IMPORT_ROWS} แถว` });
    }
    if (!("full_name" in records[0])) {
      return res.status(400).json({ error: "CSV ขาดคอลัมน์: full_name" });
    }

    const inFile = records
      .map((r) => (r.full_name ?? "").trim())
      .filter(Boolean);
    const { rows: existing } = await pool.query(
      "SELECT full_name FROM users WHERE full_name = ANY($1::text[])",
      [inFile],
    );
    const { wanted, skipped } = planUsers(
      records,
      existing.map((e) => e.full_name),
    );
    if (!wanted.size) {
      return res.json({ total: records.length, created: [], skipped });
    }

    const names = [...wanted.keys()];
    const ids = await nextUserIds(names.length);
    const accounts = names.map((full_name, i) => ({
      id: ids[i],
      full_name,
      contact: wanted.get(full_name),
      username: `u${ids[i]}`,
      password: randomPassword(),
    }));

    const { rows: inserted } = await pool.query(
      `INSERT INTO users (id, username, password_hash, full_name, contact,
                          role, must_change_password)
       SELECT id, un, h, fn, c, 'user', true
         FROM unnest($1::int[], $2::text[], $3::text[], $4::text[], $5::text[])
              AS x(id, un, h, fn, c)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        ids,
        accounts.map((a) => a.username),
        accounts.map((a) => hashPassword(a.password)),
        names,
        accounts.map((a) => a.contact),
      ],
    );

    const ok = new Set(inserted.map((r) => r.id));
    for (const a of accounts) {
      if (!ok.has(a.id)) {
        skipped.push({
          full_name: a.full_name,
          reason: "username ซ้ำกับของเดิม",
        });
      }
    }
    res.json({
      total: records.length,
      created: accounts.filter((a) => ok.has(a.id)),
      skipped,
    });
  }),
);

module.exports = router;

// node src/routes/auth.js — เช็คการคัดแถวอย่างเดียว ส่วน SQL ต้องยิงจริงถึงจะรู้
if (require.main === module) {
  const assert = require("assert");
  const { wanted, skipped } = planUsers(
    [
      { full_name: "สมชาย", contact: "081" },
      { full_name: " สมชาย ", contact: "" }, // ซ้ำในไฟล์ (parseCsv trim มาแล้ว แต่เผื่อไว้)
      { full_name: "สมหญิง" },
      { full_name: "" },
    ],
    ["สมหญิง"],
  );
  assert.deepStrictEqual([...wanted], [["สมชาย", "081"]]);
  assert.deepStrictEqual(
    skipped.map((s) => s.reason),
    ["ชื่อซ้ำในไฟล์", "มีชื่อนี้ในระบบแล้ว", "ไม่มีชื่อ"],
  );
  console.log("planUsers ok");
}
