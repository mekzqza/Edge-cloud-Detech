import type { Status } from "@/types";

const STATUS: Record<Status, { label: string; className: string }> = {
  pending: { label: "รออนุมัติ", className: "bg-warn-soft text-warn" },
  approved: { label: "อนุมัติแล้ว", className: "bg-success-soft text-success" },
  revoked: { label: "ถูกปฏิเสธ", className: "bg-danger-soft text-danger" },
};

// สถานะแปลก ๆ จาก DB ไม่ควรทำให้หน้าพัง — ถือว่ายังไม่อนุมัติไว้ก่อน
export default function StatusBadge({ status }: { status: Status }) {
  const s = STATUS[status] ?? STATUS.pending;
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] ${s.className}`}>
      {s.label}
    </span>
  );
}
