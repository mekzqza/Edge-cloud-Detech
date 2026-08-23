"use client";

import { useCallback, useEffect, useState } from "react";
import type { Notification } from "@/types";

const REASON_TEXT: Record<string, string> = {
  unregistered: "ตรวจพบรถที่ไม่ได้ลงทะเบียน",
};

// "2 นาที" / "3 วัน" — Intl มีให้แล้ว ไม่ต้องลง date lib
const UNITS = [
  [60, "second", 1],
  [3600, "minute", 60],
  [86400, "hour", 3600],
  [604800, "day", 86400],
  [Infinity, "week", 604800],
] as const;
const rtf = new Intl.RelativeTimeFormat("th", { numeric: "auto" });
function ago(iso: string) {
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  const [, unit, div] = UNITS.find(([max]) => sec < max)!;
  return rtf.format(-Math.max(1, Math.round(sec / div)), unit);
}

export default function NotificationBell({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notification[] | null>(null);

  const api = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(`/api/notifications${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token],
  );

  const loadCount = useCallback(async () => {
    const res = await api("/unread-count");
    if (res.ok) setCount((await res.json()).count);
  }, [api]);

  // ponytail: poll 30 วิ — ถ้าอยากได้ทันทีค่อยเปลี่ยนเป็น SSE
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCount();
    const t = setInterval(loadCount, 30_000);
    return () => clearInterval(t);
  }, [loadCount]);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(null);
    api(unreadOnly ? "?unread=1" : "").then(async (res) =>
      setItems(res.ok ? await res.json() : []),
    );
  }, [open, unreadOnly, api]);

  async function markRead(n: Notification) {
    if (n.read_at) return;
    await api(`/${n.id}/read`, { method: "POST" });
    setItems((prev) =>
      (prev ?? []).map((x) =>
        x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x,
      ),
    );
    setCount((c) => Math.max(0, c - 1));
  }

  async function markAll() {
    await api("/read-all", { method: "POST" });
    const now = new Date().toISOString();
    setItems((prev) => (prev ?? []).map((x) => ({ ...x, read_at: x.read_at ?? now })));
    setCount(0);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`การแจ้งเตือน${count ? ` (${count} รายการใหม่)` : ""}`}
        className="relative rounded-full p-2 text-ink-muted hover:bg-surface-muted hover:text-ink"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-danger px-1 text-[10px] font-medium leading-4 text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* คลิกที่อื่นเพื่อปิด */}
          <button
            type="button"
            aria-label="ปิดการแจ้งเตือน"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-border bg-surface shadow-lg sm:w-96">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-semibold">การแจ้งเตือน</h2>
              <button
                type="button"
                onClick={markAll}
                disabled={count === 0}
                className="text-xs text-info hover:underline disabled:text-ink-faint disabled:no-underline"
              >
                อ่านทั้งหมด
              </button>
            </div>

            <div className="flex gap-2 px-4 py-2">
              {[
                { label: "ทั้งหมด", value: false },
                { label: "ยังไม่ได้อ่าน", value: true },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => setUnreadOnly(t.value)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    unreadOnly === t.value
                      ? "bg-info-soft font-medium text-info"
                      : "text-ink-muted hover:bg-surface-muted"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <ul className="max-h-96 overflow-y-auto border-t border-border">
              {items === null && (
                <li className="px-4 py-6 text-center text-sm text-ink-muted">
                  กำลังโหลด…
                </li>
              )}
              {items?.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-ink-muted">
                  ไม่มีการแจ้งเตือน
                </li>
              )}
              {items?.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => markRead(n)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted"
                  >
                    <img
                      src={`/uploads/${n.filename}`}
                      alt=""
                      className="h-10 w-14 shrink-0 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">
                        {REASON_TEXT[n.reason] ?? n.reason}{" "}
                        <span className="font-mono font-medium">{n.plate}</span>{" "}
                        <span className="text-ink-muted">{n.province}</span>
                      </div>
                      <div className="text-xs text-info">
                        {ago(n.created_at)}
                      </div>
                    </div>
                    {!n.read_at && (
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-info" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
