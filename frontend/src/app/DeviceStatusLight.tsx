"use client";

import { useEffect, useState } from "react";

type Camera = { ok: boolean; lastSeenSecondsAgo: number | null };
type DeviceStatus = {
  device: string;
  online: boolean;
  cameras: { IN: Camera; OUT: Camera };
};

// ข้อความ 1 บรรทัดต่อกล้องใน tooltip
function describe(name: string, cam: Camera): string {
  // TODO(human): คืนข้อความสถานะกล้อง เช่น "IN: ปกติ · ล่าสุด 3 วินาทีที่แล้ว"
  return `${name}: ${cam.ok ? "ปกติ" : "ขาดการติดต่อ"}`;
}

export default function DeviceStatusLight({ device = "pi5-gate1" }: { device?: string }) {
  // null = ยังโหลดไม่เสร็จ หรือ fetch error → สีเทา
  const [status, setStatus] = useState<DeviceStatus | null>(null);

  // ponytail: poll 10 วิ — backend ตัดสิน ok/ไม่ ok เอง ฝั่งนี้แค่แสดงผล
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/device-status?device=${encodeURIComponent(device)}`);
        setStatus(res.ok ? await res.json() : null);
      } catch {
        setStatus(null);
      }
    }
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [device]);

  const color = !status ? "bg-ink-faint" : status.online ? "bg-success" : "bg-danger";
  const text = !status ? "text-ink-muted" : status.online ? "text-success" : "text-danger";
  const label = !status ? "กำลังตรวจสอบกล้อง" : status.online ? "กล้องออนไลน์" : "กล้องออฟไลน์";
  const tooltip = status
    ? [describe("IN", status.cameras.IN), describe("OUT", status.cameras.OUT)].join("\n")
    : "ยังไม่ได้รับสถานะจากเซิร์ฟเวอร์";

  return (
    <span
      title={tooltip}
      aria-label={`${label} — ${tooltip}`}
      className={`flex cursor-default items-center gap-2 text-sm ${text}`}
    >
      <span className={`h-2 w-2 rounded-full ${color}`} /> {label}
    </span>
  );
}
