import Link from "next/link";
import { auth, signOut } from "@/auth";
import NotificationBell from "@/app/NotificationBell";
import Nav from "./Nav";

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
      <aside className="w-56 shrink-0 overflow-hidden border-r border-border bg-surface transition-[width] peer-checked:w-12 max-sm:w-12 max-sm:peer-checked:w-56 motion-reduce:transition-none">
        <div className="flex h-full w-56 flex-col">
          <div className="border-b border-border py-4 pl-12 pr-4 font-medium">
            <span className="rail-hide">Edge Cloud Detech</span>
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
