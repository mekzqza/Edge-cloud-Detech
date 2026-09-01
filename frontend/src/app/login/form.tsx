"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

// สำหรับเจ้าของที่ไม่มี Google — ใช้ username + รหัสที่ admin ตั้งให้
// รหัสที่ admin ตั้งจะโดนบังคับเปลี่ยนที่ /password ทันทีหลังเข้ามา (middleware)
export default function CredentialsForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      username: form.get("username"),
      password: form.get("password"),
      redirect: false,
    });
    setBusy(false);
    if (res?.error) setError("username หรือรหัสผ่านไม่ถูกต้อง");
    else window.location.href = "/";
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        name="username"
        required
        autoComplete="username"
        placeholder="ชื่อผู้ใช้"
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:border-info"
      />
      <input
        name="password"
        type="password"
        required
        autoComplete="current-password"
        placeholder="รหัสผ่าน"
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:border-info"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-ink px-3 py-2.5 text-sm font-medium text-page transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
