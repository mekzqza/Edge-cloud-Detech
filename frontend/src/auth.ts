import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";

// ที่อยู่ backend ฝั่ง server (dev: nginx บนเครื่อง / docker: http://backend:3000)
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost";

// เพิ่ม role + token ของ backend เข้า session ของ NextAuth
declare module "next-auth" {
  interface Session {
    user: {
      role: string;
      /** token ของ backend — แนบเป็น Bearer เวลาเรียก /api ที่ต้องใช้สิทธิ์ */
      backendToken: string;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 }, // เท่าอายุ token ฝั่ง backend
  pages: { signIn: "/login" },
  // Google อย่างเดียว — ไม่มีรหัสผ่านให้เก็บ/ให้รั่ว และได้อีเมลที่ verified มาฟรี
  // clientId/secret อ่านจาก env AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET เอง
  providers: [Google],
  callbacks: {
    signIn({ profile }) {
      return profile?.email_verified === true;
    },
    async jwt({ token, account, profile }) {
      if (account?.provider !== "google") return token; // รอบถัดไป: token มีค่าอยู่แล้ว

      // แลก email → token/role ของ backend (สร้าง user ให้ถ้ายังไม่มี)
      const res = await fetch(`${BACKEND_URL}/api/oauth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": process.env.INTERNAL_SECRET!,
        },
        body: JSON.stringify({
          email: profile?.email ?? token.email,
          emailVerified: true, // signIn callback กันมาแล้ว
        }),
      });
      // ไม่กลืน error — ให้ล็อกอินพังไปเลยดีกว่าได้ session ที่ไม่มีสิทธิ์
      if (!res.ok) throw new Error(`/api/oauth failed: ${res.status}`);
      const { token: backendToken, role } = await res.json();
      token.role = role;
      token.backendToken = backendToken;
      return token;
    },
    session({ session, token }) {
      session.user.role = token.role as string;
      session.user.backendToken = token.backendToken as string;
      return session;
    },
  },
});
