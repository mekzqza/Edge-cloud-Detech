import Link from "next/link";
import { auth, signOut } from "@/auth";
import NotificationBell from "@/app/NotificationBell";

// guest เห็นครบทุกเมนู — กดแล้ว middleware เด้งไป /login ให้เอง
// (เมนูที่หายไปเลยทำให้ guest ไม่รู้ว่าล็อกอินแล้วได้อะไรเพิ่ม)
const nav = [
  { href: "/", label: "ภาพรวม", d: ["M3 3h7v9H3z", "M14 3h7v5h-7z", "M14 12h7v9h-7z", "M3 16h7v5H3z"] },
  { href: "/records", label: "บันทึกรถเข้า", d: ["M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4", "m10 17 5-5-5-5", "M15 12H3"] },
  { href: "/exits", label: "บันทึกรถออก", d: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"] },
  { href: "/history", label: "ค้นประวัติรถ", d: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m21 21-4.3-4.3"] },
  { href: "/vehicles", label: "รถของฉัน", d: ["M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2", "M9 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0", "M9 17h6", "M19 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0"] },
  { href: "/admin", label: "จัดการระบบ", d: ["M4 21v-7", "M4 10V3", "M12 21v-9", "M12 8V3", "M20 21v-5", "M20 12V3", "M2 14h4", "M10 8h4", "M18 16h4"] },
];

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="relative flex min-h-screen">
      {/* ponytail: checkbox + peer = พับ/กางเมนู โดยไม่ต้องมี client component
          พับแล้ว aside แคบลงแต่เนื้อข้างในยังกว้าง 14rem — overflow-hidden ตัดให้เอง */}
      <input
        id="sidebar"
        type="checkbox"
        className="peer sr-only"
        aria-label="พับ/กางเมนู"
      />
      <label
        htmlFor="sidebar"
        title="พับ/กางเมนู"
        className="absolute left-3 top-3.5 z-10 cursor-pointer rounded-md px-1.5 py-0.5 text-ink-muted hover:bg-surface-muted hover:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
      >
        ☰
      </label>
      <aside className="w-56 shrink-0 overflow-hidden border-r border-border bg-surface transition-[width] peer-checked:w-12 motion-reduce:transition-none">
        <div className="flex h-full w-56 flex-col">
          <div className="border-b border-border py-4 pl-12 pr-4 font-medium">
            <span className="rail-hide">Edge Cloud Detech</span>
          </div>
          {/* px ของ nav + ของ Link รวมกัน = 14px → ไอคอน 20px อยู่กลาง rail 48px พอดี */}
          <nav className="flex-1 space-y-1 px-1.5 py-3">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                title={n.label}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-ink-muted hover:bg-surface-muted hover:text-ink"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 shrink-0"
                >
                  {n.d.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>
                <span className="rail-hide">{n.label}</span>
              </Link>
            ))}
          </nav>
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
      <div className="flex flex-1 flex-col">
        <header className="flex min-h-11 items-center justify-end border-b border-border bg-surface px-6 py-2">
          {/* กระดิ่งเรียก /api/notifications ที่ต้องมี token — guest ไม่ต้องมี */}
          {session && <NotificationBell token={session.user.backendToken} />}
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
