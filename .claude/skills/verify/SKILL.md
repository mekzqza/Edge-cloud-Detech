---
name: verify
description: วิธี build/รัน/ทดสอบ frontend (Next.js + NextAuth) ของ repo นี้แบบ end-to-end บนเครื่องที่ไม่มี Docker
---

# Verify frontend (Next.js + NextAuth)

เครื่อง dev นี้ไม่มี Docker/Postgres — ใช้ stub backend แทน (contract อยู่ที่
`backend/src/routes/auth.js`: POST /api/login|/api/register → `{token, role}`)

1. stub backend: node server ธรรมดาบนพอร์ต 4000 ตอบ /api/login, /api/register, /api/detections
2. build + รัน production:
   ```powershell
   cd frontend
   $env:AUTH_SECRET = "test"; $env:BACKEND_URL = "http://localhost:4000"; $env:AUTH_TRUST_HOST = "true"
   npm run build; npx next start -p 5199
   ```
   `AUTH_TRUST_HOST=true` จำเป็นตอน production ไม่งั้น auth() โยน UntrustedHost → หน้า 500
3. ยิง flow ด้วย curl + cookie jar:
   - GET / (ไม่มี cookie) → 302 /login (middleware)
   - GET /api/auth/csrf → เอา csrfToken, แล้ว POST /api/auth/callback/credentials
     (form-urlencoded: csrfToken, username, password) → 302 + `authjs.session-token`
   - GET /api/auth/session → `{user:{name, role, backendToken}}`
   - POST /api/auth/signout (พร้อม csrfToken) → session เป็น null

## กับดักที่เจอแล้ว

- rewrite `/api/:path*` ต้องอยู่ใน `fallback` ของ `rewrites()` — ไม่งั้นชนะ
  `/api/auth/[...nextauth]` (dynamic route) แล้ว NextAuth โดน proxy ไป backend
- rewrite destination ถูก bake ตอน `next build` (ไม่อ่าน env ตอน start) —
  ใน docker ไม่กระทบเพราะ Caddy แยก /api ก่อนถึง Next
