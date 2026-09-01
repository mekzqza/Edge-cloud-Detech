"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { AdminOwner } from "@/types";

// รหัสสุ่มให้ admin ก๊อปไปบอกเจ้าของ — เขาต้องเปลี่ยนเองทันทีที่ล็อกอินอยู่แล้ว
const randomPassword = () =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 12);

const INPUT =
  "rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus-visible:border-info";

// แจก account ให้เจ้าของที่ import ชื่อมาแล้ว — สร้าง user + ผูกกับ owner ในคำขอเดียว
export default function Accounts({ token }: { token: string }) {
  const [rows, setRows] = useState<AdminOwner[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const res = await fetch("/api/admin/owners", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRows(res.ok ? await res.json() : []);
    });
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function open(owner: AdminOwner) {
    setOpenId(owner.id);
    setError("");
    setCreated(null);
    setUsername("");
    setPassword(randomPassword());
  }

  async function create(ownerId: number) {
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username, password, ownerId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return setError(body.error ?? "สร้าง account ไม่สำเร็จ");
    }
    setCreated({ username, password });
    setOpenId(null);
    load();
  }

  return (
    <section className="mt-8">
      <header className="border-b border-border pb-4">
        <h2 className="text-lg font-medium">แจก account ให้เจ้าของรถ</h2>
        <p className="mt-1 text-sm text-ink-muted">
          ตั้งรหัสให้แล้วส่งไปให้เจ้าของ —
          ระบบจะบังคับให้เขาตั้งรหัสใหม่เองตอนล็อกอินครั้งแรก
        </p>
      </header>

      {created && (
        <p className="mt-4 rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          สร้างแล้ว — ชื่อผู้ใช้{" "}
          <span className="font-mono font-medium">{created.username}</span>{" "}
          รหัสผ่าน{" "}
          <span className="font-mono font-medium">{created.password}</span>{" "}
          (หน้านี้ไม่แสดงรหัสนี้อีก)
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-lg text-sm">
          <thead className="text-left text-xs text-ink-muted">
            <tr className="border-b border-border">
              <th className="py-2 font-normal">เจ้าของ</th>
              <th className="py-2 font-normal">ติดต่อ</th>
              <th className="py-2 font-normal">รถ</th>
              <th className="py-2 font-normal">account</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((o) => (
              <tr key={o.id} className="border-b border-border align-top">
                <td className="py-2">{o.full_name}</td>
                <td className="py-2 text-ink-muted">{o.contact ?? "—"}</td>
                <td className="py-2 text-ink-muted">{o.vehicle_count}</td>
                <td className="py-2">
                  {o.username ? (
                    <span className="font-mono text-ink-muted">
                      {o.username}
                    </span>
                  ) : openId === o.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="ชื่อผู้ใช้"
                        className={`${INPUT} w-32`}
                      />
                      {/* type=text ตั้งใจ — admin ต้องอ่านรหัสไปบอกเจ้าของ */}
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${INPUT} w-36 font-mono`}
                      />
                      <button
                        onClick={() => create(o.id)}
                        className="rounded-md bg-ink px-2 py-1 text-xs text-page hover:opacity-90"
                      >
                        สร้าง
                      </button>
                      <button
                        onClick={() => setOpenId(null)}
                        className="text-xs text-ink-muted hover:underline"
                      >
                        ยกเลิก
                      </button>
                      {error && (
                        <span className="text-xs text-danger">{error}</span>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => open(o)}
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-muted"
                    >
                      สร้าง account
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows?.length === 0 && (
          <p className="py-4 text-sm text-ink-muted">
            ยังไม่มีเจ้าของในระบบ — นำเข้า CSV ที่มีคอลัมน์ owner_name ก่อน
          </p>
        )}
      </div>
    </section>
  );
}
