"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

const inputCls =
  "w-full rounded-md border border-border bg-surface-muted px-3 py-2 text-sm outline-none focus:border-info";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await signIn("credentials", { username, password, redirect: false });
    setBusy(false);
    if (res?.error) return setError("username หรือ password ไม่ถูกต้อง");
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-surface p-6"
      >
        <h1 className="text-lg font-medium">เข้าสู่ระบบ</h1>
        {error && (
          <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
        )}
        <input
          className={inputCls}
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className={inputCls}
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-info px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
        >
          {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
        <p className="text-center text-sm text-ink-muted">
          ยังไม่มีบัญชี?{" "}
          <Link href="/register" className="text-info hover:underline">
            สมัครสมาชิก
          </Link>
        </p>
      </form>
    </main>
  );
}
