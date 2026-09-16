import { auth } from "@/auth";
import Tabs from "./tabs";

// จัดการระบบ — เช็ค admin ที่เดียวตรงนี้ หน้าลูกไม่ต้องเช็คซ้ำ (backend ยัง requireAdmin อีกชั้น)
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div>
      <h1 className="text-lg font-medium">จัดการระบบ</h1>
      {session?.user.role === "admin" ? (
        <>
          <Tabs />
          {children}
        </>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">
          ต้องเป็น admin จึงจะเข้าหน้านี้ได้
        </p>
      )}
    </div>
  );
}
