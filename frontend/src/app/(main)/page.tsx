"use client";

import { useEffect, useState } from "react";
import type { Detection } from "@/types";
import DeviceStatusLight from "@/app/DeviceStatusLight";

// ตัดวันตามเวลาไทยให้ตรงกับ backend — server (UTC) กับ browser จะได้ render วันเดียวกันด้วย
const TZ = "Asia/Bangkok";

type Counts = { dir_in: number; dir_out: number };
// จาก GET /api/detections/overview — days = ช่วงของตัวเลขชุดนี้, totals = การ์ดสถิติ,
// chart = จำนวนต่อชั่วโมง/วัน (เฉพาะช่องที่มีรถ)
type Overview = {
  days: number;
  totals: Counts & { denied: number; read_ok: number; read_partial: number };
  chart: (Counts & { k: string })[];
};

export default function OverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [lastDetechtion, setLastDetection] = useState<Detection[] | null>(null);
  const [range, setRange] = useState<number>(1); // ช่วงกราฟ: 1/7/15/30 วัน

  async function fetchLastDetection(count: number) {
    const res = await fetch(`/api/detections/last/${count}`);
    if (!res.ok) {
      return setLastDetection([]);
    }
    const data = await res.json();
    setLastDetection(data);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLastDetection(4);
  }, []);

  // สลับช่วงรัว ๆ แล้วคำตอบของช่วงเก่ามาถึงทีหลัง — ห้ามทับของช่วงใหม่
  useEffect(() => {
    let stale = false;
    fetch(`/api/detections/overview?days=${range}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Overview | null) => {
        if (!stale) setOverview(data);
      });
    return () => {
      stale = true;
    };
  }, [range]);

  // ป้าย ตัวเลข และกราฟ ใช้ช่วงของข้อมูลที่ได้มาแล้ว ไม่ใช่ปุ่มที่เพิ่งกด —
  // ระหว่างรอคำตอบจะได้ไม่ขึ้นเลขของช่วงเก่าใต้ป้ายของช่วงใหม่ (แค่จางไว้บอกว่ากำลังโหลด)
  const days = overview?.days ?? range;
  const loading = overview?.days !== range;
  // ต่อท้ายชื่อการ์ด: "วันนี้" ติดคำ ตัวเลขเว้นวรรค → "รถเข้าวันนี้" / "รถเข้า 7 วัน"
  // ห่อ nowrap ตอน render — การ์ดแคบบนมือถือจะได้ไม่ตัดกลางคำเป็น "วัน / นี้"
  const period = days === 1 ? "วันนี้" : `${days} วัน`;
  const from = new Date();
  from.setTime(from.getTime() - (days - 1) * 86_400_000);

  // ponytail: icon/tone เป็นแค่ของตกแต่ง
  // ทุกใบนับตามช่วงที่เลือก (ตัดวันตามเวลาไทย) — ความหมายของ "อ่านได้/บางส่วน" อยู่ที่ backend
  const t = overview?.totals;
  const stats = [
    {
      label: "รถเข้า",
      value: t?.dir_in,
      icon: <CarIcon />,
      tone: "",
    },
    {
      label: "รถออก",
      value: t?.dir_out,
      icon: <CarIcon />,
      tone: "",
    },
    {
      label: "อ่านป้ายสำเร็จ",
      value: t?.read_ok,
      icon: <BadgeCheckIcon />,
      tone: "",
    },
    {
      label: "รถแปลกปลอม",
      value: t?.denied,
      icon: <AlertIcon />,
      tone: "text-danger",
    },
    {
      label: "อ่านได้บางส่วน",
      value: t?.read_partial,
      icon: <HelpIcon />,
      tone: "",
    },
  ];

  // จัด bucket กราฟ: 1 วัน = รายชั่วโมงของวันนี้, หลายวัน = รายวัน
  // backend ส่งมาเฉพาะช่องที่มีรถ — key ต้องสร้างแบบเดียวกับ to_char ฝั่ง backend ไม่งั้นได้ 0 ทั้งกราฟ
  const counts = new Map(overview?.chart.map((c) => [c.k, c] as const));
  const bucket = (k: string) => ({
    in: counts.get(k)?.dir_in ?? 0,
    out: counts.get(k)?.dir_out ?? 0,
  });
  const buckets =
    days === 1
      ? Array.from({ length: 24 }, (_, h) => ({
          label: `${h}:00`,
          ...bucket(String(h).padStart(2, "0")), // "HH24"
        }))
      : Array.from({ length: days }, (_, i) => {
          // ไทยไม่มี daylight saving — ถอยทีละ 24 ชม. = ถอยทีละวันพอดี
          const day = new Date();
          day.setTime(day.getTime() - (days - 1 - i) * 86_400_000);
          return {
            label: day.toLocaleDateString("th-TH", {
              day: "numeric",
              month: "short",
              timeZone: TZ,
            }),
            ...bucket(day.toLocaleDateString("sv-SE", { timeZone: TZ })), // "YYYY-MM-DD"
          };
        });
  const max = Math.max(1, ...buckets.flatMap((b) => [b.in, b.out]));
  const labelStep = Math.ceil(buckets.length / 8);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">ภาพรวมระบบ</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {/* วันเดียวได้ "30 ก.ย. 2569", หลายวันได้ "24–30 ก.ย. 2569" */}
            {new Intl.DateTimeFormat("th-TH", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: TZ,
            }).formatRange(from, new Date())}{" "}
            · ทางเข้า
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* ช่วงเวลาคุมทั้งหน้า (การ์ด + กราฟ) เลยอยู่บนสุด ไม่ได้อยู่ในกล่องกราฟ */}
          <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-sm">
            {[1, 7, 15, 30].map((n) => (
              <button
                key={n}
                onClick={() => setRange(n)}
                aria-pressed={range === n}
                className={`rounded-[6px] px-3 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  range === n
                    ? "bg-ink text-surface"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {n === 1 ? "วันนี้" : `${n} วัน`}
              </button>
            ))}
          </div>
          <DeviceStatusLight />
        </div>
      </div>

      <div
        className={`grid grid-cols-2 gap-3 transition-opacity md:grid-cols-3 md:gap-4 xl:grid-cols-5 ${loading ? "opacity-50" : ""}`}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex items-center gap-1.5 text-sm text-ink-muted">
              {s.icon}
              {/* span เดียวครอบ — ข้อความหลายชิ้นใน flex จะแยกเป็นหลาย item แล้วโดน gap คั่น */}
              <span>
                {s.label}
                {days > 1 && " "}
                <span className="whitespace-nowrap">{period}</span>
              </span>
            </div>
            <div className={`mt-2 text-3xl font-semibold ${s.tone}`}>
              {s.value ?? "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="font-medium">
            {days === 1 ? "รถเข้า-ออกรายชั่วโมง" : "รถเข้า-ออกรายวัน"}
          </h2>
          <div
            className={`mt-4 flex h-40 items-end transition-opacity sm:h-48 ${loading ? "opacity-50" : ""}`}
          >
            {buckets.map((b) => (
              <div
                key={b.label}
                title={`${b.label} — เข้า ${b.in} / ออก ${b.out} คัน`}
                className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5 rounded transition-colors hover:bg-surface-muted"
              >
                <div
                  className="w-full max-w-1.5 rounded-t bg-success md:max-w-2"
                  style={{ height: `${(b.in / max) * 100}%` }}
                />
                <div
                  className="w-full max-w-1.5 rounded-t bg-warn md:max-w-2"
                  style={{ height: `${(b.out / max) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex border-t border-border pt-1 text-[10px] text-ink-faint">
            {buckets.map((b, i) => (
              // ไม่ตัดเป็น "13 ก..." — ช่องข้าง ๆ ไม่มีป้ายอยู่แล้ว (labelStep) ล้นไปได้
              // flex + justify-center ล้นออกเท่ากันสองข้าง ป้ายเลยยังตรงกลางแท่งของมัน
              <div
                key={b.label}
                className="flex min-w-0 flex-1 justify-center whitespace-nowrap"
              >
                {i % labelStep === 0 ? b.label : ""}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
            <span className="h-3 w-3 rounded-sm bg-success" /> รถเข้า
            <span className="ml-2 h-3 w-3 rounded-sm bg-warn" /> รถออก
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">กิจกรรมล่าสุด</h2>
          <ul className="mt-3 space-y-2">
            {(lastDetechtion ?? []).map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 rounded-md bg-surface-muted px-3 py-2 text-sm"
              >
                <span className="shrink-0 font-mono text-xs text-ink-muted">
                  {new Date(d.created_at).toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="font-mono font-medium">{d.plate ?? "—"}</span>
                <span className="truncate text-ink-muted">
                  {d.province ?? ""}
                </span>
                <span
                  className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs ${
                    d.access_granted
                      ? "bg-success-soft text-success"
                      : "bg-danger-soft text-danger"
                  }`}
                >
                  {d.access_granted ? "ปกติ" : "แปลกปลอม"}
                </span>
              </li>
            ))}
            {lastDetechtion?.length === 0 && (
              <li className="text-sm text-ink-muted">ยังไม่มีข้อมูล</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
    >
      {children}
    </svg>
  );
}

function CarIcon() {
  return (
    <StatIcon>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </StatIcon>
  );
}

function BadgeCheckIcon() {
  return (
    <StatIcon>
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m9 12 2 2 4-4" />
    </StatIcon>
  );
}

function AlertIcon() {
  return (
    <StatIcon>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 20h16a2 2 0 0 0 1.73-2Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </StatIcon>
  );
}

function HelpIcon() {
  return (
    <StatIcon>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </StatIcon>
  );
}
