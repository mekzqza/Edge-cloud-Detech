# Edge-cloud-Detech

```
.
├── docker-compose.yml     เปิดทุก service ด้วยคำสั่งเดียว
├── .env                   รหัส/ค่าจริง (ไม่ขึ้น git) — คัดลอกจาก .env.example
├── nginx/                 reverse proxy: รับ request จากภายนอก → ส่งต่อ backend
├── backend/               Node + Express + Postgres
│   ├── index.js           จุดเริ่ม: ต่อ middleware, mount routes, เปิดเซิร์ฟเวอร์
│   └── src/
│       ├── db.js          ท่อเชื่อม Postgres + สร้างตาราง
│       └── routes/        1 ไฟล์ = 1 feature  (add.js, notes.js, ...)
└── frontend/              React + TypeScript (Vite)
    └── src/               App.tsx = หน้าจอ; เรียก backend ผ่าน /api
```

## รัน

```bash
cp .env.example .env          # ครั้งแรก: ตั้งรหัส db ใน .env
docker compose up -d --build  # เปิด db + backend + nginx → http://localhost
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
