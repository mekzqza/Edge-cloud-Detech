const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = 3000;

// ต่อ Postgres: อ่านที่อยู่จาก env (ตั้งใน docker-compose.yml)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// สร้างตารางถ้ายังไม่มี (รันครั้งเดียวตอน backend เริ่ม)
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id    SERIAL PRIMARY KEY,
      text  TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  console.log("DB ready");
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/add", (req, res) => {
  const { a, b } = req.body;

  if (typeof a !== "number" || typeof b !== "number") {
    return res.status(400).json({ error: "a และ b ต้องเป็นตัวเลขทั้งคู่" });
  }

  console.log(`Received addition request: ${a} + ${b}`);
  console.log(`Message: ${req.body.message}`);

  return res.json({ a, b, result: a + b });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// PUSH: บันทึกข้อมูลลง db
app.post("/api/notes", async (req, res) => {
  const { text } = req.body;
  if (typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "text ต้องเป็นข้อความ" });
  }
  // $1 = ช่องเสียบค่า ป้องกัน SQL injection (ห้ามต่อ string เอง)
  const result = await pool.query(
    "INSERT INTO notes (text) VALUES ($1) RETURNING *",
    [text]
  );
  res.status(201).json(result.rows[0]); // ส่งแถวที่เพิ่งบันทึกกลับ
});

// PULL: ดึงข้อมูลทั้งหมดออกมา
app.get("/api/notes", async (req, res) => {
  const result = await pool.query("SELECT * FROM notes ORDER BY id DESC");
  res.json(result.rows);
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
});
