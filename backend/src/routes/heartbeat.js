const crypto = require("crypto");
const { Router } = require("express");

const HEARTBEAT_TOKEN = process.env.HEARTBEAT_TOKEN;
if (!HEARTBEAT_TOKEN) throw new Error("HEARTBEAT_TOKEN is not set");
const TIMEOUT_MS = 45_000; // Pi ส่งทุก ~15 วิ → พลาดได้ 2 รอบก่อนแดง
const CAMERAS = ["IN", "OUT"];

// ponytail: เก็บใน memory อย่างเดียว — restart แล้วแดงไม่เกิน ~15 วิ จนกว่า heartbeat รอบถัดไปมา
// ถ้าวันหนึ่งรัน backend หลาย instance ต้องย้ายไป db/redis
const lastSeen = new Map(); // `${device}:${camera}` -> Date.now() ของ server

const router = Router();

router.post("/heartbeat", (req, res) => {
  const h = req.headers.authorization || "";
  const got = Buffer.from(h.startsWith("Bearer ") ? h.slice(7) : "");
  const want = Buffer.from(HEARTBEAT_TOKEN);
  // timingSafeEqual throw ถ้าความยาวไม่เท่า — เช็คความยาวก่อน
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want))
    return res.status(401).json({ error: "unauthorized" });

  const { device, camera } = req.body ?? {};
  if (typeof device !== "string" || !device || !CAMERAS.includes(camera))
    return res.status(400).json({ error: "device/camera ไม่ถูกต้อง" });

  lastSeen.set(`${device}:${camera}`, Date.now());
  res.sendStatus(204);
});

// คำนวณตอนมีคนเรียก ไม่มี timer
router.get("/device-status", (req, res) => {
  const device = String(req.query.device ?? "");
  const now = Date.now();
  const cameras = {};
  for (const cam of CAMERAS) {
    const t = lastSeen.get(`${device}:${cam}`);
    cameras[cam] =
      t == null
        ? { ok: false, lastSeenSecondsAgo: null }
        : { ok: now - t < TIMEOUT_MS, lastSeenSecondsAgo: Math.floor((now - t) / 1000) };
  }
  res.json({ device, online: cameras.IN.ok && cameras.OUT.ok, cameras });
});

module.exports = router;
