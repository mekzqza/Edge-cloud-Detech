"use client";

import { useEffect, useState } from "react";
import type { Detection } from "@/types";

export default function OverviewPage() {
  const [detections, setDetections] = useState<Detection[] | null>(null);

  useEffect(() => {
    fetch("/api/detections")
      .then((r) => r.json())
      .then(setDetections)
      .catch(() => setDetections([]));
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
      value: detections?.filter((d) => d.plate != "PENDING").length,
    },
    {
      label: "รถแปลกปลอม",
      value: detections?.filter((d) => !d.verified).length,
    },

    {
      label: "อ่านไม่ได้",
      value: detections?.filter((d) => !d.plate || "PENDING").length,
    },
  ];

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
    </div>
  );
}
