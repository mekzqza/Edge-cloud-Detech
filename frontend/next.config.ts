import type { NextConfig } from "next";

// ปลายทาง backend ตอน dev — บน docker Caddy จัดการ /api และ /uploads ให้ก่อนถึง Next อยู่แล้ว
const backend = process.env.BACKEND_URL || "http://localhost";

const nextConfig: NextConfig = {
  output: "standalone", // ให้ Dockerfile หยิบไปรันด้วย node server.js ได้
  async rewrites() {
    // ต้องเป็น fallback (เช็คหลัง route ทั้งหมด) — ไม่งั้น /api/auth/[...nextauth]
    // ซึ่งเป็น dynamic route จะแพ้ rewrite แล้ว NextAuth โดน proxy ไป backend
    return {
      fallback: [
        { source: "/api/:path*", destination: `${backend}/api/:path*` },
        { source: "/uploads/:path*", destination: `${backend}/uploads/:path*` },
      ],
    };
  },
};

export default nextConfig;
