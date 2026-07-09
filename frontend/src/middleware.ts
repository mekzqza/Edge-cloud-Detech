import { auth } from "@/auth";

// ทุกหน้าต้อง login ก่อน ยกเว้น /login กับ /register
export default auth((req) => {
  const isPublic = ["/login", "/register"].includes(req.nextUrl.pathname);
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
