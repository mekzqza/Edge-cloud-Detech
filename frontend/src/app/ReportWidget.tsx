"use client";

import { useEffect, useRef, useState } from "react";
import ReportBadge, { reportTime } from "@/app/ReportBadge";
import type { Report } from "@/types";

const MAX_LEN = 2000; // เท่ากับ MAX_MESSAGE_LEN ฝั่ง backend
const TIP_KEY = "reportTipDismissed";

function Icon({ d }: { d: string[] }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-6 w-6"
    >
      {d.map((p) => (
        <path key={p} d={p} />
      ))}
    </svg>
  );
}

// ปุ่มลอยมุมขวาล่างทุกหน้า (แบบปุ่มแชท) — กดแล้วเปิดฟอร์มร้องเรียน + เรื่องที่เคยส่ง
// admin ดูเรื่องทั้งหมดที่ /admin/report
export default function ReportWidget({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(false); // ฟองชวนกดเหนือปุ่ม — กดปิดแล้วจำไว้ในเครื่อง
  const [items, setItems] = useState<Report[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // อ่าน localStorage หลัง mount — ตอน server render ไม่มี ถ้าอ่านตอน render จะ hydrate ไม่ตรง
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTip(localStorage.getItem(TIP_KEY) !== "1");
    } catch {
      // โหมดส่วนตัว/ปิด storage = ไม่แสดงฟอง ปุ่มยังใช้ได้ปกติ
    }
  }, []);

  function dismissTip() {
    setTip(false);
    try {
      localStorage.setItem(TIP_KEY, "1");
    } catch {
      // จำไม่ได้ก็แค่ฟองโผล่อีกรอบตอนโหลดหน้าใหม่
    }
  }

  // โหลดเรื่องที่เคยส่งตอนเปิดครั้งแรก — ไม่ยิง API ทุกหน้าที่เปิด
  useEffect(() => {
    if (!open || items) return;
    fetch("/api/reports", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then(setItems)
      .catch(() => setItems([]));
  }, [open, items, token]);

  // เปิดแล้วพร้อมพิมพ์ทันที, Esc ปิด
  useEffect(() => {
    if (!open) return;
    textRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function toggle() {
    setOpen((o) => !o);
    dismissTip(); // เปิดดูแล้ว = รู้จักปุ่มนี้แล้ว ไม่ต้องชวนอีก
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reports", {
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
    <>
      {/* คลิกที่อื่นเพื่อปิด — แบบเดียวกับกล่องแจ้งเตือน */}
      {open && (
        <button
          type="button"
          aria-label="ปิดหน้าต่างร้องเรียน"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 cursor-default"
        />
      )}

      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
        {open && (
          <section
            role="dialog"
            aria-label="แจ้งเรื่องร้องเรียน"
            className="flex max-h-[min(36rem,calc(100dvh-7rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
          >
            <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 className="font-medium">แจ้งเรื่องร้องเรียน</h2>
                <p className="text-xs text-ink-faint">
                  ผู้ดูแลระบบจะเห็นชื่อคุณและเวลาที่ส่ง
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="ปิด"
                className="rounded-md px-1.5 text-lg leading-none text-ink-muted hover:bg-surface-muted hover:text-ink"
              >
                ×
              </button>
            </header>

            <div className="overflow-y-auto">
              <form onSubmit={submit} className="space-y-2 p-4">
                <textarea
                  ref={textRef}
                  required
                  rows={3}
                  maxLength={MAX_LEN}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setMsg(null);
                  }}
                  placeholder="เช่น วันนี้ 08:15 ประตูขาเข้าไม่เปิดให้รถ กข 1234"
                  aria-label="รายละเอียดเรื่องร้องเรียน"
                  className="block w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                />
                <div className="flex items-center gap-3">
                  <button
                    disabled={busy || !message.trim()}
                    className="h-9 rounded-md bg-ink px-4 text-sm text-surface transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40"
                  >
                    {busy ? "กำลังส่ง…" : "ส่งเรื่อง"}
                  </button>
                  <span className="font-mono text-xs text-ink-faint">
                    {message.length}/{MAX_LEN}
                  </span>
                </div>
                {msg && (
                  <p
                    role={msg.ok ? "status" : "alert"}
                    className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}
                  >
                    {msg.text}
                  </p>
                )}
              </form>

              <div className="border-t border-border px-4 py-3">
                <h3 className="text-xs font-medium text-ink-muted">
                  เรื่องที่เคยส่ง
                </h3>
                {items === null ? (
                  <p className="mt-2 text-sm text-ink-faint">กำลังโหลด…</p>
                ) : items.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-muted">ยังไม่เคยส่งเรื่อง</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {items.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-md bg-surface-muted px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <time
                            dateTime={c.created_at}
                            className="text-[11px] text-ink-muted"
                          >
                            {reportTime(c.created_at)}
                          </time>
                          <ReportBadge status={c.status} />
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words">
                          {c.message}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {tip && !open && (
          <div className="relative max-w-[16rem] rounded-2xl bg-surface p-3 pr-8 text-sm shadow-lg ring-1 ring-border">
            <p>ประตูไม่เปิดหรืออ่านป้ายผิด? แจ้งเรื่องได้ที่นี่</p>
            <button
              type="button"
              onClick={toggle}
              className="mt-1 font-medium text-info hover:underline"
            >
              แจ้งเรื่อง
            </button>
            <button
              type="button"
              onClick={dismissTip}
              aria-label="ไม่ต้องแสดงอีก"
              className="absolute right-2 top-1.5 px-1 text-ink-faint hover:text-ink"
            >
              ×
            </button>
            {/* หางชี้ลงหาปุ่ม — สี่เหลี่ยมหมุน 45° โชว์แค่ขอบล่าง/ขวา */}
            <span
              aria-hidden
              className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-border bg-surface"
            />
          </div>
        )}

        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? "ปิดหน้าต่างร้องเรียน" : "แจ้งเรื่องร้องเรียน"}
          title="แจ้งเรื่องร้องเรียน"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-info text-surface shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none motion-reduce:hover:scale-100"
        >
          <Icon
            d={
              open
                ? ["M18 6 6 18", "m6 6 12 12"]
                : [
                    "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
                    "M12 7v2",
                    "M12 13h.01",
                  ]
            }
          />
        </button>
      </div>
    </>
  );
}
