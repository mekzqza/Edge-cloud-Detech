"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

const inputCls =
  "w-full rounded-md border border-border bg-surface-muted px-3 py-2 text-sm outline-none focus:border-info";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPw) return setError("รหัสผ่านยืนยันไม่ตรงกัน");
    setBusy(true);
    setError("");
    // สร้าง user ที่ backend (backend เป็นคน hash รหัสผ่าน) แล้วค่อย signIn เอา session
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: null }));
      setBusy(false);
      return setError(error || "สมัครไม่สำเร็จ");
    }
    await signIn("credentials", { username, password, redirect: false });
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-surface p-6"
      >
        <h1 className="text-lg font-medium">สมัครสมาชิก</h1>
        {error && (
          <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
        )}
        <input
          className={inputCls}
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
        />
        <input
          className={inputCls}
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <input
          className={inputCls}
          type="password"
          placeholder="ยืนยันรหัสผ่าน"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-info px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
        >
          {busy ? "กำลังสมัคร..." : "สมัครสมาชิก"}
        </button>
        <p className="text-center text-sm text-ink-muted">
          มีบัญชีแล้ว?{" "}
          <Link href="/login" className="text-info hover:underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      </form>
    </main>
  );
}
