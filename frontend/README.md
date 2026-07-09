# Frontend — Next.js (App Router) + Tailwind CSS v4

- `npm run dev` — dev server ที่ http://localhost:5173 (proxy `/api`, `/uploads` ไป `BACKEND_URL`)
- `npm run build && npm start` — production (Dockerfile ใช้ standalone output)
- auth: NextAuth (Credentials) — `authorize()` ตรวจกับ backend `/api/login` ดู `src/auth.ts`
- หน้า login/register เปิดได้เสมอ ที่เหลือถูก `src/middleware.ts` บังคับ login
- ตัวแปร env ที่ต้องตั้ง: ดู `.env.example`
