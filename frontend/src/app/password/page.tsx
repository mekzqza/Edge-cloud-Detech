import { auth } from "@/auth";
import PasswordForm from "./form";

// เปลี่ยนรหัสผ่าน — ปลายทางที่ middleware บังคับมาหลัง admin สร้าง account ให้
export default async function PasswordPage() {
  const session = await auth();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-page p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-surface p-8 shadow-[0_6px_24px_rgba(31,30,26,0.08)]">
        <div className="space-y-1">
          <h1 className="text-lg font-medium">เปลี่ยนรหัสผ่าน</h1>
          <p className="text-sm text-ink-muted">
            {session?.user.mustChange
              ? "รหัสนี้ผู้ดูแลระบบเป็นคนตั้งให้ ตั้งรหัสใหม่ของคุณเองก่อนใช้งาน"
              : "ตั้งรหัสใหม่โดยยืนยันด้วยรหัสเดิม"}
          </p>
        </div>
        <PasswordForm token={session?.user.backendToken ?? ""} />
      </div>
    </main>
  );
}
