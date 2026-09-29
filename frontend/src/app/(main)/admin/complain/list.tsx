"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import ComplaintBadge, { complaintTime } from "@/app/ComplaintBadge";
import type { Complaint } from "@/types";

const TABS: { key: string; label: string }[] = [
  { key: "open", label: "รอดำเนินการ" },
  { key: "resolved", label: "จัดการแล้ว" },
  { key: "", label: "ทั้งหมด" },
];

// เรื่องร้องเรียนทั้งหมด — เรื่องที่ยังไม่ปิดขึ้นเป็นแท็บแรก
export default function Complaints({ token }: { token: string }) {
  const [rows, setRows] = useState<Complaint[] | null>(null);
  const [status, setStatus] = useState("open");
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const q = status ? `?status=${status}` : "";
      const res = await fetch(`/api/admin/complaints${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRows(res.ok ? await res.json() : []);
    });
  }, [token, status]);

  useEffect(() => {
    load();
  }, [load]);

  // ปิดเรื่อง = resolved (จำว่าใครปิด เมื่อไหร่), เปิดใหม่ = open
  async function decide(c: Complaint, next: Complaint["status"]) {
    setError("");
    const res = await fetch(`/api/admin/complaints/${c.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return setError(body?.error ?? "บันทึกไม่สำเร็จ");
    }
    load();
  }

  return (
    <section className="mt-8">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border pb-4">
        <h2 className="text-lg font-medium">เรื่องร้องเรียน</h2>
        <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              aria-pressed={status === t.key}
              className={`rounded-[6px] px-3 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                status === t.key
                  ? "bg-ink text-surface"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      {rows === null ? (
        <p className="mt-8 text-sm text-ink-faint">กำลังโหลด…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-ink-muted">
          {status === "open" ? "ไม่มีเรื่องที่รอดำเนินการ" : "ไม่มีเรื่องร้องเรียน"}
        </p>
      ) : (
        <ul className={`mt-4 space-y-3 ${busy ? "opacity-50" : ""}`}>
          {rows.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-border bg-surface p-4 text-sm"
            >
              {/* ใคร + ติดต่อทางไหน | เมื่อไหร่ */}
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">
                    {c.user_name ?? (
                      <span className="text-ink-faint">ผู้ใช้ที่ถูกลบ</span>
                    )}
                  </span>
                  {c.username && c.username !== c.user_name && (
                    <span className="font-mono text-xs text-ink-faint">
                      {c.username}
                    </span>
                  )}
                  {c.contact && (
                    <span className="text-xs text-ink-muted">
                      · {c.contact}
                    </span>
                  )}
                </div>
                <time
                  dateTime={c.created_at}
                  className="text-xs text-ink-muted"
                >
                  {complaintTime(c.created_at)}
                </time>
              </div>

              <p className="mt-2 whitespace-pre-wrap break-words">
                {c.message}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ComplaintBadge status={c.status} />
                {c.status === "resolved" && c.resolved_at && (
                  <span className="text-xs text-ink-faint">
                    โดย {c.resolved_by_name ?? "—"} ·{" "}
                    {complaintTime(c.resolved_at)}
                  </span>
                )}
                <button
                  onClick={() =>
                    decide(c, c.status === "open" ? "resolved" : "open")
                  }
                  className={`ml-auto rounded-md px-3 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                    c.status === "open"
                      ? "border border-success bg-success-soft text-success hover:bg-success hover:text-surface"
                      : "border border-border text-ink-muted hover:bg-surface-muted"
                  }`}
                >
                  {c.status === "open" ? "ปิดเรื่อง" : "เปิดใหม่"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
