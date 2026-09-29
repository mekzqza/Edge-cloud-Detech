import Link from "next/link";
import { auth, signOut } from "@/auth";
import NotificationBell from "@/app/NotificationBell";
import ComplaintWidget from "@/app/ComplaintWidget";
import Nav from "./Nav";
import ThemeToggle from "@/app/ThemeToggle";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    // ≥640px: dashboard เป็นกรอบมุมโค้งลอยบนพื้น page (สี "นอก dashboard") — มือถือเต็มจอเหมือนเดิม ไม่เสียพื้นที่
    // กรอบสูงเต็มจอลบ padding ได้เองจาก flex stretch ไม่ต้อง calc
    <div className="flex min-h-dvh sm:p-3">
      {/* ไม่ใส่ overflow-hidden ตัดมุม — จะตัดกล่องแจ้งเตือนตอนจอเตี้ย (มือถือแนวนอน) ให้ aside โค้งมุมเองแทน */}
      <div className="relative flex min-w-0 flex-1 bg-canvas sm:rounded-2xl sm:border sm:border-border">
        {/* ponytail: checkbox + peer = พับ/กางเมนู โดยไม่ต้องมี client component
            พับแล้ว aside แคบลงแต่เนื้อข้างในยังกว้าง 14rem — overflow-hidden ตัดให้เอง */}
        <input
          id="sidebar"
          type="checkbox"
          className="peer sr-only"
          aria-label="พับ/กางเมนู"
        />
        {/* กล่อง 32px ตายตัว: left-2 = กลาง rail 48px ตรงแนวไอคอนเมนู, top-3 = กลางหัวแถบ h-14
            ไม่ขึ้นกับความกว้างของตัว ☰ ที่แต่ละเครื่องใช้ฟอนต์ต่างกัน */}
        <label
          htmlFor="sidebar"
          title="พับ/กางเมนู"
          className="absolute left-2 top-3 z-30 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
        >
          ☰
        </label>
        {/* rounded-l-[15px] = มุมกรอบ 16px ลบเส้นขอบ 1px — พื้น sidebar จะได้ไม่ล้นมุมโค้งของกรอบ */}
        <aside className="w-56 shrink-0 overflow-hidden border-r border-border bg-sidebar transition-[width] sm:rounded-l-[15px] peer-checked:w-12 max-sm:w-12 max-sm:peer-checked:fixed max-sm:peer-checked:inset-y-0 max-sm:peer-checked:left-0 max-sm:peer-checked:z-20 max-sm:peer-checked:w-56 max-sm:peer-checked:shadow-lg motion-reduce:transition-none">
          <div className="flex h-full w-56 flex-col">
            {/* h-14 ตายตัว — ตอนพับ ชื่อเว็บถูกซ่อน ถ้าสูงตามเนื้อหาจะเหลือ 32px แล้วเส้นขอบล่างผ่ากลาง ☰
                และสูงเท่า header ฝั่งขวา เส้นขอบสองฝั่งเลยต่อกันเป็นเส้นเดียว */}
            <div className="flex h-14 items-center border-b border-border pl-12 pr-4 font-medium">
              <span className="rail-hide">GateVision</span>
            </div>
            <Nav />
            <div className="rail-hide border-t border-border p-4 text-sm">
              {session ? (
                <>
                  <div>{session.user.name}</div>
                  <div className="text-ink-faint">{session.user.role}</div>
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/" });
                    }}
                  >
                    <button className="mt-3 w-full rounded-md border border-border px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-muted hover:text-ink">
                      ออกจากระบบ
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/login"
                  className="block rounded-md bg-info px-3 py-1.5 text-center text-sm font-medium text-surface"
                >
                  เข้าสู่ระบบ
                </Link>
              )}
            </div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          {/* ไม่มีพื้นของตัวเอง — ใช้ canvas ของกรอบ แถบบนกับเนื้อหาเป็นพื้นเดียวกัน */}
          <header className="flex h-14 items-center justify-end gap-2 border-b border-border px-4 sm:px-6">
            {/* กระดิ่งเรียก /api/notifications ที่ต้องมี token — guest ไม่ต้องมี */}
            {session && <NotificationBell token={session.user.backendToken} />}
            <ThemeToggle />
          </header>
          {/* pb-24 เผื่อที่ให้ปุ่มร้องเรียนที่ลอยมุมขวาล่าง — เลื่อนสุดแล้วปุ่มไม่บังเนื้อหาท้ายหน้า */}
          <main
            className={`min-w-0 flex-1 p-4 sm:p-6 ${session ? "pb-24 sm:pb-24" : ""}`}
          >
            {children}
          </main>
        </div>
        {/* ร้องเรียนต้องรู้ว่าใครส่ง — แสดงเฉพาะคนที่ล็อกอินแล้ว */}
        {session && <ComplaintWidget token={session.user.backendToken} />}
      </div>
    </div>
  );
}
