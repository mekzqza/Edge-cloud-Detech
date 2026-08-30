"use client";

// ponytail: ไม่มี state — สีทั้งหมดมาจาก light-dark() ใน CSS
// กดแล้วแค่เขียน data-theme + จำไว้ใน localStorage ให้ script ใน layout อ่านตอนโหลด
export default function ThemeToggle() {
  return (
    <button
      title="สลับโหมดสว่าง/มืด"
      aria-label="สลับโหมดสว่าง/มืด"
      onClick={() => {
        const el = document.documentElement;
        const dark = el.dataset.theme
          ? el.dataset.theme === "dark"
          : matchMedia("(prefers-color-scheme: dark)").matches;
        el.dataset.theme = dark ? "light" : "dark";
        try {
          localStorage.theme = el.dataset.theme;
        } catch {
          // โหมดส่วนตัว/ปิดคุกกี้ = สลับได้ แค่ไม่จำ
        }
      }}
      className="rounded-md p-1.5 text-ink-muted hover:bg-surface-muted hover:text-ink"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-5 w-5"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" />
      </svg>
    </button>
  );
}
