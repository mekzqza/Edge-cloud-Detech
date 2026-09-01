"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Lightbox from "@/app/Lightbox";
import Plate from "@/app/Plate";
import { pageList } from "@/lib/pagination";
import type { Detection } from "@/types";

/* ===== ตั้งค่าหน้านี้ ===== */
const PER_PAGE = 12; // จำนวนรูปต่อหน้า
const PAGE_WINDOW = 2; // แสดงเลขหน้ารอบหน้าปัจจุบันข้างละกี่เลข
const CARD_MIN_WIDTH = 220; // ความกว้างขั้นต่ำของการ์ด (px) — กริดจัดคอลัมน์เองตามจอ
/* ========================= */

// "–" = ไม่มีค่า (อ่านฟิลด์นั้นไม่ออก)
const pct = (c: number | null | undefined) =>
  c == null ? "–" : `${Math.round(c * 100)}%`;

type Page = { rows: Detection[]; total: number; denied: number };

// ตัวกรองผลอ่านป้าย — "" = ไม่กรอง
const plateFilters = [
  { key: "", label: "ทุกคัน" },
  { key: "ok", label: "อ่านป้ายได้" },
  { key: "unread", label: "อ่านไม่ออก" },
];

// รายการรถที่กล้องตรวจจับได้ เรียงล่าสุดก่อน แบ่งหน้าจาก backend
// direction: "out" = เฉพาะกล้องขาออก, ไม่ใส่ = ทุกทิศทาง (รวมแถวเก่าที่ยังเป็น unknown)
export default function RecordsList({
  direction,
  token,
}: {
  direction?: "in" | "out";
  /** token ของ backend — admin เท่านั้นที่จะได้ค่าดิบ (confidence/plate_raw) กลับมา */
  token: string;
}) {
  const noun = direction === "out" ? "การออก" : "การเข้า";
  const [data, setData] = useState<Page | null>(null);
  const [page, setPage] = useState(1);
  const [onlyDenied, setOnlyDenied] = useState(false);
  const [date, setDate] = useState(""); // "" = ทุกวัน
  const [plateFilter, setPlateFilter] = useState("");
  const [zoom, setZoom] = useState<string | null>(null); // รูปที่กำลังดูเต็มจอ
  const [busy, startTransition] = useTransition(); // busy = ระหว่างสลับหน้า/รีเฟรช

  const load = useCallback(() => {
    startTransition(async () => {
      const q = new URLSearchParams({
        limit: String(PER_PAGE),
        offset: String((page - 1) * PER_PAGE),
        ...(onlyDenied ? { denied: "1" } : {}),
        ...(date ? { date } : {}),
        ...(plateFilter ? { plate: plateFilter } : {}),
        ...(direction ? { direction } : {}),
      });
      const res = await fetch(`/api/detections?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.ok ? await res.json() : { rows: [], total: 0, denied: 0 });
    });
  }, [page, onlyDenied, date, plateFilter, direction, token]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.rows ?? [];
  const shownTotal = onlyDenied ? (data?.denied ?? 0) : (data?.total ?? 0);
  const lastPage = Math.max(1, Math.ceil(shownTotal / PER_PAGE));

  const tabs = [
    { key: false, label: "ทั้งหมด", count: data?.total },
    { key: true, label: "ไม่มีสิทธิ์", count: data?.denied },
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
          <h1 className="text-lg font-medium">บันทึก{noun}</h1>
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
                setOnlyDenied(t.key);
                setPage(1);
              }}
              className={`rounded-[6px] px-3 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                onlyDenied === t.key
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
          {onlyDenied
            ? "ทุกคันมีสิทธิ์เข้า"
            : date || plateFilter
              ? "ไม่มีรถที่ตรงกับตัวกรอง"
              : `ยังไม่มีบันทึก${noun}`}
        </p>
      ) : (
        <div
          className={`mt-6 grid gap-5 transition-opacity ${busy ? "opacity-50" : ""}`}
          style={{
            gridTemplateColumns: `repeat(auto-fill,minmax(min(${CARD_MIN_WIDTH}px,100%),1fr))`,
          }}
        >
          {rows.map((d) => (
            <figure
              key={d.id}
              className={`group overflow-hidden rounded-lg border bg-surface shadow-[0_1px_2px_rgba(31,30,26,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(31,30,26,0.10)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
                d.access_granted
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
                <span
                  className={`absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] ${
                    d.access_granted
                      ? "bg-success-soft text-success"
                      : "bg-danger-soft text-danger"
                  }`}
                >
                  {d.access_granted ? "มีสิทธิ์" : "ไม่มีสิทธิ์"}
                </span>

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
                    <Plate
                      plate={d.plate}
                      province={d.province}
                      raw={d.plate_raw}
                    />
                  ) : (
                    <span className="rounded border border-border bg-surface px-2 py-1.5 text-xs text-ink-muted">
                      {d.label || "อ่านป้ายไม่ออก"}
                    </span>
                  )}
                </div>
                {/* ponytail: <details> ของเบราว์เซอร์ — ไม่ต้องมี state เปิด/ปิด */}
                <details className="group relative mt-3 text-xs text-ink-muted">
                  <summary className="flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-0.5 marker:content-[''] hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
                    <time dateTime={d.created_at}>
                      {new Date(d.created_at).toLocaleString("th-TH", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </summary>
                  <dl className="absolute inset-x-0 bottom-full z-20 mb-1 space-y-0.5 rounded-md border border-border bg-surface p-2 shadow-[0_6px_16px_rgba(31,30,26,0.16)]">
                    {[
                      d.direction !== "unknown" && [
                        "ทิศทาง",
                        d.direction === "in" ? "เข้า" : "ออก",
                      ],
                      // มีค่าก็ต่อเมื่อเป็น admin — backend ตัดทิ้งให้คนอื่นไปแล้ว
                      d.confidence != null && ["กล่องป้าย", pct(d.confidence)],
                      d.confidence != null && [
                        "เลขทะเบียน",
                        pct(d.plate_confidence),
                      ],
                      d.confidence != null && [
                        "จังหวัด",
                        pct(d.province_confidence),
                      ],
                    ]
                      .filter((r): r is [string, string] => Array.isArray(r))
                      .map(([k, v]) => (
                        <div key={k} className="flex gap-1">
                          <dt>{k}</dt>
                          <dd className="font-mono text-ink">= {v}</dd>
                        </div>
                      ))}
                  </dl>
                </details>
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
