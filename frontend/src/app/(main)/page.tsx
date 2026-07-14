"use client";

import { useEffect, useState } from "react";
import type { Detection } from "@/types";

export default function OverviewPage() {
  const [detections, setDetections] = useState<Detection[] | null>(null);
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

  useEffect(() => {
    fetchDetections();
  }, []);

  const today = new Date().toDateString();
  const stats = [
    { label: "รถเข้าทั้งหมด", value: detections?.length },
    {
      label: "วันนี้",
      value: detections?.filter(
        (d) => new Date(d.created_at).toDateString() === today,
      ).length,
    },
    {
      label: "อ่านทะเบียนได้",
      value: detections?.filter((d) => d.plate && d.plate != "PENDING").length,
    },
    {
      label: "รถแปลกปลอม",
      value: detections?.filter((d) => !d.verified).length,
    },

    {
      label: "อ่านไม่ได้",
      value: detections?.filter((d) => (!d.plate && !d.plate) || "PENDING")
        .length,
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
    <div>
      <h1 className="text-lg font-medium">ภาพรวม</h1>
      <div className="mt-4 grid max-w-2xl grid-cols-3 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="text-2xl font-medium">{s.value ?? "—"}</div>
            <div className="mt-1 text-sm text-ink-muted">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 max-w-2xl rounded-lg border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-medium">รถเข้ารายชั่วโมง</h2>
          <span className="text-sm text-ink-muted">วันนี้</span>
        </div>
        <div className="mt-4 flex h-40 items-end">
          {hourly.map((h) => (
            <div
              key={h.hour}
              title={`${h.hour}:00 น. — ${h.count} คัน`}
              className="flex h-full flex-1 items-end justify-center"
            >
              <div
                className="w-2 rounded-t bg-success"
                style={{ height: `${(h.count / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
          <span className="h-3 w-3 rounded-sm bg-success" /> รถเข้า
        </div>
      </div>
      <input
        type="number"
        value={time}
        onChange={(e) => setTime(Number(e.target.value))}
      />
      <button onClick={() => detecTionIn(time)}>Fetch Detections</button>
    </div>
  );
}
