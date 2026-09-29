"use client";

import { useEffect, useState } from "react";
import ComplaintBadge, { complaintTime } from "@/app/ComplaintBadge";
import type { Complaint } from "@/types";

const MAX_LEN = 2000; // เท่ากับ MAX_MESSAGE_LEN ฝั่ง backend

export default function ComplainForm({ token }: { token: string }) {
  const [items, setItems] = useState<Complaint[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/complaints", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then(setItems)
      .catch(() => setItems([]));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        return setMsg({ ok: false, text: body?.error ?? "ส่งเรื่องไม่สำเร็จ" });
      }
      setItems((prev) => [body, ...(prev ?? [])]);
      setMessage("");
      setMsg({ ok: true, text: "ส่งเรื่องแล้ว — ผู้ดูแลระบบเห็นเรื่องนี้แล้ว" });
    } catch {
      setMsg({ ok: false, text: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <header className="border-b border-border pb-4">
        <h1 className="text-lg font-medium">ร้องเรียน</h1>
        <p className="mt-0.5 text-xs text-ink-faint">
          แจ้งปัญหา เช่น ประตูไม่เปิด หรือระบบอ่านป้ายผิด —
          ผู้ดูแลระบบจะเห็นชื่อคุณและเวลาที่ส่ง
        </p>
      </header>

      <form
        onSubmit={submit}
        className="mt-6 space-y-3 rounded-lg border border-border bg-surface p-4"
      >
        <label className="block text-sm">
          <span className="text-ink-muted">รายละเอียด</span>
          <textarea
            required
            rows={4}
            maxLength={MAX_LEN}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setMsg(null);
            }}
            placeholder="เช่น วันนี้ 08:15 ประตูขาเข้าไม่เปิดให้รถ กข 1234"
            className="mt-1 block w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button
            disabled={busy || !message.trim()}
            className="h-10 rounded-md border border-ink bg-ink px-4 text-sm text-surface transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40"
          >
            {busy ? "กำลังส่ง…" : "ส่งเรื่อง"}
          </button>
          <span className="font-mono text-xs text-ink-faint">
            {message.length}/{MAX_LEN}
          </span>
          {msg && (
            <p
              role={msg.ok ? "status" : "alert"}
              className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}
            >
              {msg.text}
            </p>
          )}
        </div>
      </form>

      <h2 className="mt-8 text-sm font-medium">เรื่องที่เคยส่ง</h2>
      {items === null ? (
        <p className="mt-3 text-sm text-ink-faint">กำลังโหลด…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">ยังไม่เคยส่งเรื่อง</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-border bg-surface p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <time
                  dateTime={c.created_at}
                  className="text-xs text-ink-muted"
                >
                  {complaintTime(c.created_at)}
                </time>
                <ComplaintBadge status={c.status} />
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words">
                {c.message}
              </p>
              {c.resolved_at && (
                <p className="mt-2 text-xs text-ink-faint">
                  จัดการแล้วเมื่อ {complaintTime(c.resolved_at)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
