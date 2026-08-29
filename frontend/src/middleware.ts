import { auth } from "@/auth";

// ทุกหน้าต้อง login ก่อน ยกเว้น /login
export default auth((req) => {
  const isPublic = req.nextUrl.pathname === "/login";
  if (!req.auth && !isPublic) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
  if (req.auth && isPublic) {
    return Response.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  // ข้าม /api (NextAuth + proxy ไป backend) และไฟล์ static ของ Next
  matcher: ["/((?!api|_next/static|_next/image|favicon.svg).*)"],
};
