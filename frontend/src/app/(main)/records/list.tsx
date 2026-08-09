"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Lightbox from "@/app/Lightbox";
import { pageList } from "@/lib/pagination";
import type { Detection } from "@/types";

/* ===== ตั้งค่าหน้านี้ ===== */
const PER_PAGE = 12; // จำนวนรูปต่อหน้า
const PAGE_WINDOW = 2; // แสดงเลขหน้ารอบหน้าปัจจุบันข้างละกี่เลข
const CARD_MIN_WIDTH = 220; // ความกว้างขั้นต่ำของการ์ด (px) — กริดจัดคอลัมน์เองตามจอ
/* ========================= */

type Page = { rows: Detection[]; total: number; unverified: number };

// ตัวกรองผลอ่านป้าย — "" = ไม่กรอง
const plateFilters = [
  { key: "", label: "ทุกคัน" },
  { key: "ok", label: "อ่านป้ายได้" },
  { key: "unread", label: "อ่านไม่ออก" },
];

// ป้ายทะเบียนจำลอง — เลขทะเบียนบรรทัดบน จังหวัดบรรทัดล่าง กรอบดำพื้นขาวเหมือนป้ายจริง
function Plate({ plate, province }: { plate: string; province: string | null }) {
  return (
    <span className="inline-flex flex-col items-center rounded-[5px] border-2 border-ink bg-white px-3 py-1 leading-none shadow-[inset_0_0_0_2px_#fff]">
      <span className="font-mono text-base font-medium tracking-[0.12em] text-ink">
        {plate}
      </span>
      {province && <span className="mt-1 text-[10px] text-ink">{province}</span>}
    </span>
  );
}

// บันทึกรถเข้า — รายการรถที่กล้องตรวจจับได้ เรียงล่าสุดก่อน แบ่งหน้าจาก backend
export default function RecordsList({
  isAdmin,
  token,
}: {
  isAdmin: boolean;
  token: string;
}) {
  const [data, setData] = useState<Page | null>(null);
  const [page, setPage] = useState(1);
  const [onlyUnverified, setOnlyUnverified] = useState(false);
  const [date, setDate] = useState(""); // "" = ทุกวัน
  const [plateFilter, setPlateFilter] = useState("");
  const [zoom, setZoom] = useState<string | null>(null); // รูปที่กำลังดูเต็มจอ
  const [busy, startTransition] = useTransition(); // busy = ระหว่างสลับหน้า/รีเฟรช

  const load = useCallback(() => {
    startTransition(async () => {
      const q = new URLSearchParams({
        limit: String(PER_PAGE),
        offset: String((page - 1) * PER_PAGE),
        ...(onlyUnverified ? { unverified: "1" } : {}),
        ...(date ? { date } : {}),
        ...(plateFilter ? { plate: plateFilter } : {}),
      });
      const res = await fetch(`/api/detections?${q}`);
      setData(res.ok ? await res.json() : { rows: [], total: 0, unverified: 0 });
    });
  }, [page, onlyUnverified, date, plateFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // ยืนยัน/ยกเลิกยืนยัน (admin เท่านั้น — backend เช็คซ้ำด้วย requireAdmin)
  async function setVerified(id: number, verified: boolean) {
    const res = await fetch(`/api/detections/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ verified }),
    });
    if (!res.ok) return alert("บันทึกไม่สำเร็จ");
    load();
  }

  const rows = data?.rows ?? [];
  const shownTotal = onlyUnverified ? (data?.unverified ?? 0) : (data?.total ?? 0);
  const lastPage = Math.max(1, Math.ceil(shownTotal / PER_PAGE));

  const tabs = [
    { key: false, label: "ทั้งหมด", count: data?.total },
    { key: true, label: "ยังไม่ยืนยัน", count: data?.unverified },
  ];

  function go(p: number) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div>
      <Lightbox src={zoom} onClose={() => setZoom(null)} />

      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border pb-4">
        <div>
          <h1 className="text-lg font-medium">บันทึกรถเข้า</h1>
          <p className="mt-0.5 text-xs text-ink-faint">
            {shownTotal > 0
              ? `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, shownTotal)} จาก ${shownTotal} คัน`
              : " "}
          </p>
        </div>

        <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-sm">
          {tabs.map((t) => (
            <button
              key={String(t.key)}
              onClick={() => {
                setOnlyUnverified(t.key);
                setPage(1);
              }}
              className={`rounded-[6px] px-3 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                onlyUnverified === t.key
                  ? "bg-ink text-surface"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
              {t.count != null && (
                <span className="ml-1.5 font-mono text-xs opacity-70">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-sm">
          {plateFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setPlateFilter(f.key);
                setPage(1);
              }}
              className={`rounded-[6px] px-3 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                plateFilter === f.key
                  ? "bg-ink text-surface"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ponytail: input type=date ของเบราว์เซอร์เอง — ไม่ต้องลง date picker */}
        <input
          type="date"
          value={date}
          max={new Date().toLocaleDateString("sv-SE")}
          onChange={(e) => {
            setDate(e.target.value);
            setPage(1);
          }}
          aria-label="ดูเฉพาะวันที่"
          className="rounded-md border border-border bg-surface px-3 py-1.5 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
        {date && (
          <button
            onClick={() => {
              setDate("");
              setPage(1);
            }}
            className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            ทุกวัน
          </button>
        )}

        <button
          onClick={() => load()}
          className="ml-auto text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          รีเฟรช
        </button>
      </header>

      {data === null ? (
        <p className="mt-8 text-sm text-ink-faint">กำลังโหลด…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-ink-muted">
          {onlyUnverified
            ? "ยืนยันครบทุกคันแล้ว"
            : date || plateFilter
              ? "ไม่มีรถที่ตรงกับตัวกรอง"
              : "ยังไม่มีรถเข้า"}
        </p>
      ) : (
        <div
          className={`mt-6 grid gap-5 transition-opacity ${busy ? "opacity-50" : ""}`}
          style={{
            gridTemplateColumns: `repeat(auto-fill,minmax(${CARD_MIN_WIDTH}px,1fr))`,
          }}
        >
          {rows.map((d) => (
            <figure
              key={d.id}
              className={`group overflow-hidden rounded-lg border bg-surface shadow-[0_1px_2px_rgba(31,30,26,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(31,30,26,0.10)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
                d.verified
                  ? "border-border"
                  : "border-border border-l-2 border-l-danger"
              }`}
            >
              <div className="relative overflow-hidden">
                <button
                  type="button"
                  onClick={() => setZoom(`/uploads/${d.filename}`)}
                  title="ดูรูปเต็มจอ"
                  className="block w-full cursor-zoom-in"
                >
                  <img
                    src={`/uploads/${d.filename}`}
                    alt={d.plate ?? d.label ?? "ภาพรถที่ตรวจจับได้"}
                    loading="lazy"
                    className="block aspect-[4/3] w-full bg-surface-muted object-cover"
                  />
                </button>
                {!d.verified && (
                  <span className="absolute left-2 top-2 rounded bg-danger-soft px-1.5 py-0.5 text-[10px] text-danger">
                    ยังไม่ยืนยัน
                  </span>
                )}

                {/* โหลดรูปลงเครื่อง — /uploads เป็น origin เดียวกัน แอตทริบิวต์ download เลยใช้ได้เลย */}
                <a
                  href={`/uploads/${d.filename}`}
                  download={`${d.plate ?? d.id}-${d.created_at.slice(0, 10)}.jpg`}
                  title="ดาวน์โหลดรูป"
                  className="absolute right-2 top-2 rounded bg-surface/85 px-2 py-1 text-[11px] text-ink-muted opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                >
                  ↓
                </a>
              </div>

              <figcaption className="px-3 pb-3">
                {/* z-10: ป้ายเกยขอบล่างของรูป ถ้าไม่ยกชั้น รูป (position:relative) จะทับป้าย */}
                <div className="relative z-10 -mt-5 flex justify-center">
                  {d.plate ? (
                    <Plate plate={d.plate} province={d.province} />
                  ) : (
                    <span className="rounded border border-border bg-surface px-2 py-1.5 text-xs text-ink-muted">
                      {d.label || "อ่านป้ายไม่ออก"}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-baseline justify-between text-xs text-ink-muted">
                  <time dateTime={d.created_at}>
                    {new Date(d.created_at).toLocaleString("th-TH", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  {d.confidence != null && (
                    <span className="font-mono text-ink-faint">
                      {Math.round(d.confidence * 100)}%
                    </span>
                  )}
                </div>

                {isAdmin && (
                  <button
                    onClick={() => setVerified(d.id, !d.verified)}
                    className={`mt-3 w-full rounded-md border px-2 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                      d.verified
                        ? "border-border bg-surface text-ink-faint hover:text-ink"
                        : "border-success bg-success-soft text-success hover:bg-success hover:text-surface"
                    }`}
                  >
                    {d.verified ? "✓ ยืนยันแล้ว" : "ยืนยัน"}
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {lastPage > 1 && (
        <nav
          aria-label="หน้า"
          className="mt-8 flex flex-wrap items-center justify-center gap-1 text-sm"
        >
          <button
            onClick={() => go(page - 1)}
            disabled={page === 1}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-ink-muted transition-colors hover:text-ink disabled:opacity-40 disabled:hover:text-ink-muted"
          >
            ก่อนหน้า
          </button>

          {pageList(page, lastPage, PAGE_WINDOW).map((p, i) =>
            p === "…" ? (
              <span key={`gap${i}`} className="px-1.5 text-ink-faint">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => go(p)}
                aria-current={p === page ? "page" : undefined}
                className={`min-w-9 rounded-md border px-2.5 py-1.5 font-mono transition-colors ${
                  p === page
                    ? "border-ink bg-ink text-surface"
                    : "border-border bg-surface text-ink-muted hover:text-ink"
                }`}
              >
                {p}
              </button>
            ),
          )}

          <button
            onClick={() => go(page + 1)}
            disabled={page === lastPage}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-ink-muted transition-colors hover:text-ink disabled:opacity-40 disabled:hover:text-ink-muted"
          >
            ถัดไป
          </button>
        </nav>
      )}
    </div>
  );
}
