const express = require("express");
const path = require("path");
const { initDb } = require("./src/db");

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" })); // limit สูงขึ้นเพราะรูป base64 ตัวใหญ่
app.use(express.text({ type: "text/csv", limit: "2mb" })); // import ทะเบียนเป็น CSV ดิบ ไม่ต้องลง multipart/csv parser
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // เสิร์ฟรูปที่ Pi ส่งมา

app.use("/api", require("./src/routes/auth"));
app.use("/api", require("./src/routes/oauth"));
app.use("/api", require("./src/routes/detections"));
app.use("/api", require("./src/routes/vehicles"));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

initDb().then(() => {
  app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
});
