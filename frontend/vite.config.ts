import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ปลายทาง backend ตอน dev: ใช้ nginx (port 80) ของ docker compose
// อยู่บนเซิร์ฟเวอร์อื่น? สั่ง  VITE_API_TARGET=http://your-server  npm run dev
const apiTarget = process.env.VITE_API_TARGET || "http://localhost"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // ทุก request ที่ขึ้นต้น /api ให้ Vite ส่งต่อไป backend ให้ (เลี่ยงปัญหา CORS)
    proxy: { "/api": apiTarget },
  },
})
