# Edge-cloud-Detech

```
.
├── docker-compose.yml     เปิดทุก service ด้วยคำสั่งเดียว
├── .env                   รหัส/ค่าจริง (ไม่ขึ้น git) — คัดลอกจาก .env.example
├── backend/               Node + Express + Postgres (API ที่ /api)
│   ├── index.js           จุดเริ่ม: ต่อ middleware, mount routes, เปิดเซิร์ฟเวอร์
│   └── src/
│       ├── db.js          ท่อเชื่อม Postgres + สร้างตาราง
│       └── routes/        1 ไฟล์ = 1 feature  (add.js, notes.js, detections.js)
└── frontend/              React + TS (Vite) — Caddy build แล้วเสิร์ฟ + HTTPS อัตโนมัติ
    ├── Dockerfile         build React → เสิร์ฟด้วย Caddy + ส่งต่อ /api,/uploads
    ├── Caddyfile          ตั้งค่า Caddy (โดเมน + reverse proxy + TLS)
    └── src/               App.tsx = หน้าจอ
```

## รัน

```bash
cp .env.example .env          # ครั้งแรก: ตั้งรหัส db ใน .env
docker compose up -d --build  # เปิด db + backend + web → https://โดเมน (Caddy ขอ cert ให้เอง)
```

Frontend ตอนพัฒนา (hot reload):
```bash
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## จะเพิ่มของใหม่ วางตรงไหน

| เพิ่ม... | ทำที่ |
|---------|------|
| API endpoint ใหม่ | สร้างไฟล์ใน `backend/src/routes/` แล้ว mount ใน `backend/index.js` |
| ตารางใหม่ | เพิ่ม `CREATE TABLE` ใน `backend/src/db.js` |
| หน้าจอ/ปุ่มใหม่ | แก้ `frontend/src/App.tsx` (พอเริ่มเยอะ ค่อยแตกเป็น `src/components/`) |
```
