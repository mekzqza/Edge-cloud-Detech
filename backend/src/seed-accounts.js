// แจก username/รหัสให้เจ้าของที่ import มาแล้วยังล็อกอินไม่ได้ (username IS NULL)
// รัน: docker compose exec backend node src/seed-accounts.js [รหัสเริ่มต้น] > accounts.csv
// ไม่ใส่รหัส = สุ่มให้คนละอัน; ใส่ = ใช้รหัสเดียวกันทุกคน (ง่ายตอนแจก แต่ใครเดา username
// ได้ก็เข้าบัญชีคนอื่นได้ก่อนเจ้าตัวจะเปลี่ยน)
const crypto = require("crypto");
const { pool } = require("./db");
const { hashPassword } = require("./auth");

const shared = process.argv[2] || null;

async function main() {
  const { rows } = await pool.query(
    "SELECT id, full_name FROM users WHERE username IS NULL ORDER BY id",
  );

  // ponytail: username = u<id> เพราะชื่อไทยแปลงเป็น ascii ไม่ได้ และ id การันตีไม่ซ้ำอยู่แล้ว
  console.log("id,full_name,username,password");
  for (const u of rows) {
    const username = `u${u.id}`;
    const password = shared ?? crypto.randomBytes(6).toString("base64url");
    const { rowCount } = await pool.query(
      `UPDATE users SET username = $1, password_hash = $2, must_change_password = true
        WHERE id = $3 AND username IS NULL`,
      [username, hashPassword(password), u.id],
    );
    if (rowCount) console.log(`${u.id},${u.full_name},${username},${password}`);
  }
  await pool.end();
}

main();
