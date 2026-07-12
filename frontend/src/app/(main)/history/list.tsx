"use client";

import { useEffect, useState } from "react";
import type { Detection } from "@/types";

// แกลเลอรีประวัติรถเข้า + ปุ่มแก้ไข/ลบสำหรับ admin (ย้ายมาจาก App.tsx เดิม)
export default function HistoryList({
  isAdmin,
  token,
}: {
  isAdmin: boolean;
  token: string;
}) {
  const [detections, setDetections] = useState<Detection[]>([]);

  const [q, setQ] = useState("");

  const shown = detections.filter(
    (d) => !q || d.plate?.includes(q) || d.province?.includes(q),
  );

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/detections");
    setDetections(await res.json());
  }

  async function remove(id: number) {
    if (!confirm("ลบรูปนี้?")) return;
    const res = await fetch(`/api/detections/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return alert("ลบไม่สำเร็จ");
    await load();
  }

  // ponytail: แก้ไขด้วย prompt() — ลาซี่สุด, upgrade เป็น inline form ถ้าต้องแก้บ่อย
  async function edit(d: Detection) {
    const plate = prompt("ทะเบียน:", d.plate ?? "");
    if (plate === null) return;
    const province = prompt("จังหวัด:", d.province ?? "");
    if (province === null) return;
    const res = await fetch(`/api/detections/${d.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ plate, province }),
    });
    if (!res.ok) return alert("แก้ไขไม่สำเร็จ");
    await load();
  }

  return (
    <div>
      <h1 className="text-lg font-medium">
        ประวัติรถเข้า ({detections.length})
      </h1>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหาทะเบียน / จังหวัด"
        className="mt-3 w-full max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-sm"
      />
      {detections.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">ยังไม่มีรายการ</p>
      ) : (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {shown.map((d) => (
            <figure
              key={d.id}
              className="overflow-hidden rounded-lg border border-border bg-surface"
            >
              <img
                src={`/uploads/${d.filename}`}
                alt={d.plate ?? d.label ?? ""}
                className="block h-40 w-full object-cover"
              />
              <figcaption className="p-3 text-sm">
                {d.plate ? (
                  <>
                    <span className="font-mono">{d.plate}</span>
                    <span className="text-ink-muted">
                      {" "}
                      · {d.province ?? ""}
                    </span>
                    {d.confidence != null && (
                      <span className="text-ink-faint">
                        {" "}
                        ({Math.round(d.confidence * 100)}%)
                      </span>
                    )}
                  </>
                ) : (
                  d.label || "—"
                )}
                {isAdmin && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => edit(d)}
                      className="rounded-md border border-border px-3 py-1 text-xs text-ink-muted hover:bg-surface-muted"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => remove(d.id)}
                      className="rounded-md bg-danger-soft px-3 py-1 text-xs text-danger hover:opacity-80"
                    >
                      ลบ
                    </button>
                  </div>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
