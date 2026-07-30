import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

// ที่อยู่ backend ฝั่ง server (dev: nginx บนเครื่อง / docker: http://backend:3000)
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost";

// เพิ่ม role + token ของ backend เข้า session ของ NextAuth
declare module "next-auth" {
  interface User {
    role: string;
    backendToken: string;
  }
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
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      // ไม่เทียบรหัสผ่านเอง — ยิงไป backend /api/login ที่เก็บ hash ไว้ (scrypt) ที่เดียว
      async authorize(credentials) {
        const res = await fetch(`${BACKEND_URL}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: credentials.username,
            password: credentials.password,
          }),
        });
        if (!res.ok) return null; // NextAuth แปลงเป็น CredentialsSignin ให้เอง
        const { token, role } = await res.json();
        return {
          id: String(credentials.username),
          name: String(credentials.username),
          role,
          backendToken: token,
        };
      },
    }),
    // clientId/secret อ่านจาก env AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET เอง
    // linking ปลอดภัยเพราะ signIn callback บังคับ email_verified แล้ว
    Google({ allowDangerousEmailAccountLinking: true }),
  ],
  callbacks: {
    signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      return profile?.email_verified === true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google") {
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
      } else if (user) {
        token.role = user.role;
        token.backendToken = user.backendToken;
      }
      return token;
    },
    session({ session, token }) {
      session.user.role = token.role as string;
      session.user.backendToken = token.backendToken as string;
      return session;
    },
  },
});
