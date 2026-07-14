"use client";

import { useEffect, useState } from "react";
import type { Detection } from "@/types";

export default function OverviewPage() {
  const [detections, setDetections] = useState<Detection[] | null>(null);
  const [lastDetechtion, setLastDetection] = useState<Detection[] | null>(null);
  const [time, setTime] = useState<number>(24);

  // Fetch detections from the API for a specific time 1H/24H/1D
  async function detecTionIn(hours: number) {
    const res = await fetch(`/api/detections/time/${hours}`);
    if (!res.ok) {
      return [];
    }
    console.log("fetching detections in", hours, "hours");
  }
  async function fetchDetections() {
    const res = await fetch(`/api/detections/`);
    if (!res.ok) {
      return [];
    }
    setDetections(await res.json());
  }

  async function fetchLastDetection(count: number) {
    const res = await fetch(`/api/detections/last/${count}`);
    if (!res.ok) {
      return null;
    }
    setLastDetection(await res.json());
    console.log("fetching last detections", count);
  }

  useEffect(() => {
    fetchDetections();
    fetchLastDetection(4);
  }, []);

  const today = new Date().toDateString();
  // ponytail: icon/tone เป็นแค่ของตกแต่ง — value/filter แก้ได้ตามสบาย
  const stats = [
    {
      label: "รถเข้าวันนี้",
      value: detections?.filter((d) => d.plate && d.plate != "PENDING").length,
      icon: <CarIcon />,
      tone: "",
    },
    {
      label: "อ่านป้ายสำเร้จ",
      value: detections?.filter((d) => d.plate && d.plate != "PENDING").length,
      icon: <BadgeCheckIcon />,
      tone: "",
    },
    {
      label: "รถแปลกปลอม",
      value: detections?.filter((d) => !d.verified).length,
      icon: <AlertIcon />,
      tone: "text-danger",
    },

    {
      label: "อ่านไม่ได้",
      value: detections?.filter((d) => (!d.plate && !d.plate) || "PENDING")
        .length,
      icon: <HelpIcon />,
      tone: "text-warn",
    },
  ];

  const todayHours = (detections ?? [])
    .filter((d) => new Date(d.created_at).toDateString() === today)
    .map((d) => new Date(d.created_at).getHours());
  const hourly = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: todayHours.filter((x) => x === h).length,
  }));
  const max = Math.max(1, ...hourly.map((h) => h.count));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">ภาพรวมระบบ</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {new Date().toLocaleDateString("th-TH", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            · ทางเข้า
          </p>
        </div>
        <span className="flex items-center gap-2 text-sm text-success">
          <span className="h-2 w-2 rounded-full bg-success" /> กล้องออนไลน์
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex items-center gap-1.5 text-sm text-ink-muted">
              {s.icon}
              {s.label}
            </div>
            <div className={`mt-2 text-3xl font-semibold ${s.tone}`}>
              {s.value ?? "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4 lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">รถเข้ารายชั่วโมง</h2>
            <span className="text-sm text-ink-muted">วันนี้</span>
          </div>
          <div className="mt-4 flex h-40 items-end sm:h-48">
            {hourly.map((h) => (
              <div
                key={h.hour}
                title={`${h.hour}:00 น. — ${h.count} คัน`}
                className="flex h-full flex-1 items-end justify-center rounded transition-colors hover:bg-surface-muted"
              >
                <div
                  className="w-2 rounded-t bg-success md:w-2.5"
                  style={{ height: `${(h.count / max) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex border-t border-border pt-1 text-[10px] text-ink-faint">
            {hourly.map((h) => (
              <div key={h.hour} className="flex-1 text-center">
                {h.hour % 6 === 0 ? `${h.hour}:00` : ""}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
            <span className="h-3 w-3 rounded-sm bg-success" /> รถเข้า
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">รถเข้าล่าสุด</h2>
          <ul className="mt-3 space-y-2">
            {(lastDetechtion ?? []).map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 rounded-md bg-surface-muted px-3 py-2 text-sm"
              >
                <span className="font-mono font-medium">{d.plate ?? "—"}</span>
                <span className="truncate text-ink-muted">
                  {d.province ?? ""}
                </span>
                <span
                  className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs ${
                    d.verified
                      ? "bg-success-soft text-success"
                      : "bg-danger-soft text-danger"
                  }`}
                >
                  {d.verified ? "ปกติ" : "แปลกปลอม"}
                </span>
              </li>
            ))}
            {lastDetechtion?.length === 0 && (
              <li className="text-sm text-ink-muted">ยังไม่มีข้อมูล</li>
            )}
          </ul>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          value={time}
          onChange={(e) => setTime(Number(e.target.value))}
          className="w-24 rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
        />
        <button
          onClick={() => detecTionIn(time)}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted"
        >
          Fetch Detections
        </button>
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
