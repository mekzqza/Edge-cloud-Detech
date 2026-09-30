import type { Report } from "@/types";

const STATUS: Record<Report["status"], { label: string; className: string }> =
  {
    open: { label: "รอดำเนินการ", className: "bg-warn-soft text-warn" },
    resolved: { label: "จัดการแล้ว", className: "bg-success-soft text-success" },
  };

// สถานะเรื่องร้องเรียน — ใช้ทั้งหน้าผู้ใช้ (ปุ่มลอย) และหน้า admin (/admin/report)
export default function ReportBadge({
  status,
}: {
  status: Report["status"];
}) {
  const s = STATUS[status] ?? STATUS.open;
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] ${s.className}`}>
      {s.label}
    </span>
  );
}

// "30 ก.ย. 69 08:15"
export const reportTime = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
