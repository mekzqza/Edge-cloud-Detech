"use client";

import { useEffect, useState } from "react";

type Stats = {
  total: number;
  confidence: number | null;
  plate_confidence: number | null;
  plate_confidence_n: number;
  province_confidence: number | null;
  province_confidence_n: number;
  granted: number;
  corrected: number;
  dir_in: number;
  dir_out: number;
  dir_unknown: number;
};

// ค่า 0..1 → "91.2%" ; ไม่มีข้อมูล (avg ของแถวว่าง = null) → "—"
const pct = (v: number | null) =>
  v == null ? "—" : `${(v * 100).toFixed(1)}%`;
const share = (n: number, total: number) => pct(total ? n / total : null);

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="mt-1 font-mono text-2xl text-ink">{value}</div>
      <div className="mt-1 text-xs text-ink-faint">{note}</div>
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

// ภาพรวมการตรวจจับทั้งหมด — เฉลี่ยจากทุกแถวใน detections ไม่มีตัวกรองวันที่
export default function Stats({ token }: { token: string }) {
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setS)
      .catch(() => setError("โหลดสถิติไม่สำเร็จ"));
  }, [token]);

  if (error)
    return (
      <p role="alert" className="mt-8 text-sm text-danger">
        {error}
      </p>
    );
  if (!s) return <p className="mt-8 text-sm text-ink-muted">กำลังโหลด…</p>;

  const denied = s.total - s.granted;

  return (
    <section className="mt-8 space-y-8">
      <p className="text-sm text-ink-muted">
        จากการตรวจจับทั้งหมด{" "}
        <span className="font-mono text-ink">{s.total}</span> ครั้ง
      </p>

      <Group title="ความมั่นใจเฉลี่ย">
        <Tile
          label="ตรวจจับป้าย (YOLO)"
          value={pct(s.confidence)}
          note={`จาก ${s.total} ครั้ง`}
        />
        <Tile
          label="อ่านเลขทะเบียน (OCR)"
          value={pct(s.plate_confidence)}
          note={`จาก ${s.plate_confidence_n} ครั้งที่ Pi ส่งค่ามา`}
        />
        <Tile
          label="อ่านจังหวัด"
          value={pct(s.province_confidence)}
          note={`จาก ${s.province_confidence_n} ครั้งที่ Pi ส่งค่ามา`}
        />
      </Group>

      <Group title="ผลการจับคู่">
        <Tile
          label="อนุญาตให้ผ่าน"
          value={share(s.granted, s.total)}
          note={`${s.granted} ครั้ง`}
        />
        <Tile
          label="ไม่อนุญาต"
          value={share(denied, s.total)}
          note={`${denied} ครั้ง`}
        />
        <Tile
          label="ป้ายถูกแก้โดย post-processing"
          value={share(s.corrected, s.total)}
          note={`${s.corrected} ครั้ง (plate ≠ plate_raw)`}
        />
      </Group>

      <Group title="ทิศทาง">
        <Tile
          label="เข้า"
          value={share(s.dir_in, s.total)}
          note={`${s.dir_in} ครั้ง`}
        />
        <Tile
          label="ออก"
          value={share(s.dir_out, s.total)}
          note={`${s.dir_out} ครั้ง`}
        />
        <Tile
          label="ไม่ทราบ"
          value={share(s.dir_unknown, s.total)}
          note={`${s.dir_unknown} ครั้ง`}
        />
      </Group>
    </section>
  );
}
