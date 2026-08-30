"use client";

import { useState, useTransition } from "react";
import Lightbox from "@/app/Lightbox";
import { groupVisits, type Visit } from "@/lib/visits";
import type { Detection } from "@/types";

/* ===== ตั้งค่าหน้านี้ ===== */
// ponytail: ค่าจากการเดา ยังไม่ได้จูนกับกล้องจริง — ดูภาพรัวจริงห่างกันเท่าไหร่แล้วปรับ
const BURST_MIN = 5; // ภาพรัวจากกล้องตัวเดิมที่ห่างไม่เกินนี้ = เหตุการณ์เดียว
const MAX_STAY_H = 24; // เข้าแล้วไม่เจอขาออกภายในนี้ = ถือว่าไม่ทราบเวลาออก
/* ========================= */

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// อยู่กี่นาที — ใช้ได้เฉพาะรอบที่มีทั้งเวลาเข้าและออก
function duration(enter: string, exit: string) {
  const min = Math.round((+new Date(exit) - +new Date(enter)) / 60_000);
  if (min < 1) return "< 1 นาที";
  return min < 60 ? `${min} นาที` : `${Math.floor(min / 60)} ชม. ${min % 60} นาที`;
}

// เข้ามานานเกินเพดานแล้วยังไม่เจอขาออก = กล้องขาออกพลาด ไม่ใช่ว่ายังจอดอยู่
const stale = (enter: string) =>
  Date.now() - +new Date(enter) > MAX_STAY_H * 3_600_000;

// ค้นประวัติรถ — พิมพ์ทะเบียนแล้วดูว่าคันนั้นเข้า-ออกตอนไหนบ้าง
export default function HistoryList({
  isAdmin,
  token,
}: {
  isAdmin: boolean;
  token: string;
}) {
  const [q, setQ] = useState("");
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [rows, setRows] = useState<Detection[]>([]);
  const [zoom, setZoom] = useState<string | null>(null); // รูปที่กำลังดูเต็มจอ
  const [busy, startTransition] = useTransition();

  function run(plate: string) {
    startTransition(async () => {
      const res = await fetch(
        `/api/detections/plate/${encodeURIComponent(plate)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const found: Detection[] = res.ok ? await res.json() : [];
      setRows(found);
      setVisits(groupVisits(found, BURST_MIN, MAX_STAY_H));
    });
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) run(q.trim());
  }

  // ponytail: ลบทั้งรอบ = ลบทีละภาพ — รอบละไม่กี่สิบภาพ ยังไม่ต้องมี endpoint ลบเป็นชุด
  async function removeVisit(v: Visit) {
    const from = +new Date((v.enter ?? v.exit)!);
    const to = +new Date((v.exit ?? v.enter)!);
    const ids = rows
      .filter((d) => {
        const t = +new Date(d.created_at);
        return d.plate === v.plate && t >= from && t <= to;
      })
      .map((d) => d.id);
    if (!confirm(`ลบรอบนี้ทั้งหมด ${ids.length} ภาพ?`)) return;
    for (const id of ids) {
      await fetch(`/api/detections/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    run(q.trim());
  }

  return (
    <div>
      <Lightbox src={zoom} onClose={() => setZoom(null)} />

      <header className="border-b border-border pb-4">
        <h1 className="text-lg font-medium">ค้นประวัติรถ</h1>
        <p className="mt-0.5 text-xs text-ink-faint">
          พิมพ์เลขทะเบียน (บางส่วนก็ได้) เพื่อดูเวลาเข้า-ออกของรถคันนั้น
        </p>

        <form onSubmit={search} className="mt-3 flex gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="เช่น กพ1687"
            className="w-full max-w-xs rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-ink px-4 py-2 text-sm text-surface transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "กำลังค้น…" : "ค้นหา"}
          </button>
        </form>
      </header>

      {visits === null ? (
        <p className="mt-8 text-sm text-ink-faint">ยังไม่ได้ค้นหา</p>
      ) : visits.length === 0 ? (
        <p className="mt-8 text-sm text-ink-muted">
          ไม่พบทะเบียนที่ตรงกับ “{q}”
        </p>
      ) : (
        <>
          <p className="mt-6 text-xs text-ink-faint">
            {visits.length} รอบ จาก {rows.length} ภาพ · จับคู่จากกล้องขาเข้า–ขาออก
          </p>

          <ul className={`mt-3 space-y-2 ${busy ? "opacity-50" : ""}`}>
            {visits.map((v) => (
              <li
                key={`${v.plate}-${v.enter ?? v.exit}`}
                className="flex items-center gap-4 rounded-lg border border-border bg-surface p-3"
              >
                <button
                  type="button"
                  onClick={() => setZoom(`/uploads/${v.filename}`)}
                  title="ดูรูปเต็มจอ"
                  className="shrink-0 cursor-zoom-in"
                >
                  <img
                    src={`/uploads/${v.filename}`}
                    alt={v.plate}
                    loading="lazy"
                    className="h-16 w-24 rounded-md bg-surface-muted object-cover"
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-mono text-base tracking-wide">
                      {v.plate}
                    </span>
                    <span className="text-xs text-ink-faint">
                      {day((v.enter ?? v.exit)!)}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
                    {v.enter ? (
                      <span className="text-success">เข้า {time(v.enter)}</span>
                    ) : (
                      <span className="text-ink-faint">ไม่พบเวลาเข้า</span>
                    )}
                    <span className="text-ink-faint">→</span>
                    {v.exit ? (
                      <span className="text-danger">ออก {time(v.exit)}</span>
                    ) : stale(v.enter!) ? (
                      <span className="text-ink-faint">ไม่พบเวลาออก</span>
                    ) : (
                      <span className="text-success">ยังอยู่ข้างใน</span>
                    )}
                    <span className="text-xs text-ink-faint">
                      ({v.enter && v.exit ? `${duration(v.enter, v.exit)} · ` : ""}
                      {v.shots} ภาพ)
                    </span>
                  </div>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => removeVisit(v)}
                    className="shrink-0 rounded-md bg-danger-soft px-3 py-1 text-xs text-danger hover:opacity-80"
                  >
                    ลบรอบนี้
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
