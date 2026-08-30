---
name: verify
description: วิธี build/รัน/ทดสอบ frontend (Next.js + NextAuth) ของ repo นี้แบบ end-to-end บนเครื่องที่ไม่มี Docker
---

# Verify frontend (Next.js + NextAuth)

เครื่อง dev นี้ไม่มี Docker/Postgres — ใช้ stub backend แทน (contract อยู่ที่
`backend/src/routes/oauth.js`: POST /api/oauth `{email, emailVerified}` +
header `x-internal-secret` → `{token, role}`)

**ล็อกอินมีทางเดียวคือ Google** — ไม่มี /api/login, /api/register, ไม่มีหน้า /register แล้ว

1. stub backend: node server ธรรมดาบนพอร์ต 4000 ตอบ /api/oauth, /api/detections
2. build + รัน production:
   ```powershell
   cd frontend
   $env:AUTH_SECRET = "test"; $env:BACKEND_URL = "http://localhost:4000"; $env:AUTH_TRUST_HOST = "true"
   $env:INTERNAL_SECRET = "test"; $env:AUTH_GOOGLE_ID = "..."; $env:AUTH_GOOGLE_SECRET = "..."
   npm run build; npx next start -p 5199
   ```
   `AUTH_TRUST_HOST=true` จำเป็นตอน production ไม่งั้น auth() โยน UntrustedHost → หน้า 500
3. ที่ curl ทดสอบได้โดยไม่ต้องมี Google จริง:
   - GET / (ไม่มี cookie) → 302 /login (middleware)
   - GET /login → 200 มีปุ่ม Google
   - GET /api/auth/providers → มี `google` ตัวเดียว
   - GET /api/auth/session → `null`
4. flow เต็ม (กด Google จริง) ต้องมี OAuth client จริง และเพิ่ม redirect URI
   `http://localhost:5199/api/auth/callback/google` ใน Google Cloud Console
   — เสร็จแล้ว GET /api/auth/session ต้องได้ `{user:{name, email, role, backendToken}}`

## กับดักที่เจอแล้ว

- rewrite `/api/:path*` ต้องอยู่ใน `fallback` ของ `rewrites()` — ไม่งั้นชนะ
  `/api/auth/[...nextauth]` (dynamic route) แล้ว NextAuth โดน proxy ไป backend
- rewrite destination ถูก bake ตอน `next build` (ไม่อ่าน env ตอน start) —
  ใน docker ไม่กระทบเพราะ nginx แยก /api ก่อนถึง Next
- backend โยน error ตอน boot ถ้าไม่ตั้ง `ADMIN_EMAIL` — ตั้งใจ ไม่งั้นไม่มีใครเป็น admin
