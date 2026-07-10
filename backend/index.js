const express = require("express");
const path = require("path");
const { initDb } = require("./src/db");

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" })); // limit สูงขึ้นเพราะรูป base64 ตัวใหญ่
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // เสิร์ฟรูปที่ Pi ส่งมา

// routes — เพิ่ม feature ใหม่: สร้างไฟล์ใน src/routes/ แล้วมา mount ตรงนี้
app.use("/api", require("./src/routes/auth"));
app.use("/api", require("./src/routes/detections"));
app.use("/api", require("./src/routes/mytest"));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// รอ db พร้อมก่อน ค่อยเปิดรับ request
initDb().then(() => {
  app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
});
