"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

const INPUT =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:border-info";

export default function PasswordForm({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const next = String(form.get("next"));
    if (next !== String(form.get("confirm"))) {
      return setError("รหัสใหม่สองช่องไม่ตรงกัน");
    }

    setBusy(true);
    const res = await fetch("/api/password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ current: form.get("current"), next }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return setError(body.error ?? "เปลี่ยนรหัสไม่สำเร็จ");
    }
    // session เดิมยังจำ mustChange=true อยู่ — ออกแล้วเข้าใหม่ด้วยรหัสใหม่เลย ง่ายกว่าไปรีเฟรช JWT
    signOut({ callbackUrl: "/login" });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        name="current"
        type="password"
        required
        autoComplete="current-password"
        placeholder="รหัสผ่านเดิม"
        className={INPUT}
      />
      <input
        name="next"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)"
        className={INPUT}
      />
      <input
        name="confirm"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="ยืนยันรหัสผ่านใหม่"
        className={INPUT}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-ink px-3 py-2.5 text-sm font-medium text-page transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "กำลังบันทึก…" : "บันทึกรหัสใหม่"}
      </button>
    </form>
  );
}
