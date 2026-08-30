import { auth } from "@/auth";

// เปิดให้คนที่ยังไม่ล็อกอินดูได้แค่หน้าภาพรวม ("/") — ที่เหลือเด้งไป /login
export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname === "/login") {
    if (req.auth) return Response.redirect(new URL("/", req.nextUrl));
    return;
  }
  if (!req.auth && pathname !== "/") {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  // ข้าม /api (NextAuth + proxy ไป backend), static ของ Next และไฟล์ใน public/
  // (อะไรที่มีนามสกุล — ไม่งั้นรูปพื้นหลัง/ไอคอนโดนเด้งไป /login)
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
