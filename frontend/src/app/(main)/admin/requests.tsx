"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Plate from "@/app/Plate";
import StatusBadge from "@/app/StatusBadge";
import type { AdminVehicle, Status } from "@/types";

const TABS: { key: string; label: string }[] = [
  { key: "pending", label: "รออนุมัติ" },
  { key: "approved", label: "อนุมัติแล้ว" },
  { key: "revoked", label: "ปฏิเสธแล้ว" },
  { key: "", label: "ทั้งหมด" },
];

// คำขอเพิ่มรถ — admin กดอนุมัติ/ปฏิเสธ และกรองด้วยวันที่ ชื่อผู้ใช้ ทะเบียน
export default function VehicleRequests({ token }: { token: string }) {
  const [rows, setRows] = useState<AdminVehicle[] | null>(null);
  const [status, setStatus] = useState("pending");
  const [date, setDate] = useState("");
  const [q, setQ] = useState("");
  const [plate, setPlate] = useState("");
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const params = new URLSearchParams({
        ...(status ? { status } : {}),
        ...(date ? { date } : {}),
        ...(q.trim() ? { q: q.trim() } : {}),
        ...(plate.trim() ? { plate: plate.trim() } : {}),
      });
      const res = await fetch(`/api/admin/vehicles?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRows(res.ok ? await res.json() : []);
    });
  }, [token, status, date, q, plate]);

  // ponytail: หน่วง 250ms พอสำหรับช่องพิมพ์ ไม่ต้องลง debounce lib
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // นำเข้า CSV เสร็จแล้วตารางต้องอัปเดตเอง — ImportCsv เป็น component พี่น้องกัน
  useEffect(() => {
    window.addEventListener("vehicles-imported", load);
    return () => window.removeEventListener("vehicles-imported", load);
  }, [load]);

  async function decide(v: AdminVehicle, next: Status) {
    setError("");
    const res = await fetch(`/api/admin/vehicles/${v.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return setError(body?.error ?? "บันทึกไม่สำเร็จ");
    }
    load();
  }

  const input =
    "rounded-md border border-border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
  const hasFilter = date || q.trim() || plate.trim();

  return (
    <section className="mt-8">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border pb-4">
        <h2 className="text-lg font-medium">คำขอเพิ่มรถ</h2>

        <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`rounded-[6px] px-3 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                status === t.key
                  ? "bg-ink text-surface"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ชื่อผู้ใช้"
          aria-label="กรองด้วยชื่อผู้ใช้"
          className={`${input} w-36`}
        />
        <input
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder="ทะเบียน"
          aria-label="กรองด้วยหมายเลขทะเบียน"
          className={`${input} w-36 font-mono`}
        />
        <input
          type="date"
          value={date}
          max={new Date().toLocaleDateString("sv-SE")}
          onChange={(e) => setDate(e.target.value)}
          aria-label="กรองด้วยวันที่ยื่นคำขอ"
          className={`${input} font-mono`}
        />
        {hasFilter && (
          <button
            onClick={() => {
              setDate("");
              setQ("");
              setPlate("");
            }}
            className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            ล้างตัวกรอง
          </button>
        )}
      </header>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      {rows === null ? (
        <p className="mt-8 text-sm text-ink-faint">กำลังโหลด…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-ink-muted">
          {hasFilter ? "ไม่มีคำขอที่ตรงกับตัวกรอง" : "ไม่มีคำขอ"}
        </p>
      ) : (
        <div className={`mt-4 overflow-x-auto ${busy ? "opacity-50" : ""}`}>
          <table className="w-full min-w-[640px] border-separate border-spacing-y-2 text-sm">
            <thead className="text-left text-xs text-ink-faint">
              <tr>
                <th className="px-3 font-normal">ทะเบียน</th>
                <th className="px-3 font-normal">ผู้ใช้</th>
                <th className="px-3 font-normal">ยื่นเมื่อ</th>
                <th className="px-3 font-normal">สถานะ</th>
                <th className="px-3 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="bg-surface">
                  <td className="rounded-l-lg border-y border-l border-border px-3 py-2">
                    <Plate plate={v.plate} province={v.province} />
                  </td>
                  <td className="border-y border-border px-3 py-2 font-mono text-ink-muted">
                    {v.owner_name}
                  </td>
                  <td className="border-y border-border px-3 py-2 text-ink-muted">
                    <time dateTime={v.created_at}>
                      {new Date(v.created_at).toLocaleString("th-TH", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </td>
                  <td className="border-y border-border px-3 py-2">
                    <StatusBadge status={v.status} />
                    {v.approved_by_name && (
                      <div className="mt-1 text-[11px] text-ink-faint">
                        โดย {v.approved_by_name}
                      </div>
                    )}
                  </td>
                  <td className="rounded-r-lg border-y border-r border-border px-3 py-2">
                    {/* ปุ่มเฉพาะที่เปลี่ยนสถานะจริง — คันที่อนุมัติแล้วไม่ต้องมีปุ่มอนุมัติซ้ำ */}
                    <div className="flex justify-end gap-2">
                      {v.status !== "approved" && (
                        <button
                          onClick={() => decide(v, "approved")}
                          className="rounded-md border border-success bg-success-soft px-3 py-1 text-xs text-success transition-colors hover:bg-success hover:text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                        >
                          อนุมัติ
                        </button>
                      )}
                      {v.status !== "revoked" && (
                        <button
                          onClick={() => decide(v, "revoked")}
                          className="rounded-md border border-border px-3 py-1 text-xs text-danger transition-colors hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                        >
                          ปฏิเสธ
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
