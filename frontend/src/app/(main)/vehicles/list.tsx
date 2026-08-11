"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Plate from "@/app/Plate";
import type { Status, Vehicle } from "@/types";

// 77 จังหวัด — ให้เลือกจาก select ไม่ให้พิมพ์เอง เพราะ backend จับคู่ป้ายกับจังหวัดแบบตรงตัว
// ponytail: string เดียว split เอา ไม่ต้องมีไฟล์ data แยก
const PROVINCES =
  `กรุงเทพมหานคร กระบี่ กาญจนบุรี กาฬสินธุ์ กำแพงเพชร ขอนแก่น จันทบุรี ฉะเชิงเทรา ชลบุรี ชัยนาท
   ชัยภูมิ ชุมพร เชียงราย เชียงใหม่ ตรัง ตราด ตาก นครนายก นครปฐม นครพนม นครราชสีมา นครศรีธรรมราช
   นครสวรรค์ นนทบุรี นราธิวาส น่าน บึงกาฬ บุรีรัมย์ ปทุมธานี ประจวบคีรีขันธ์ ปราจีนบุรี ปัตตานี
   พระนครศรีอยุธยา พะเยา พังงา พัทลุง พิจิตร พิษณุโลก เพชรบุรี เพชรบูรณ์ แพร่ ภูเก็ต มหาสารคาม
   มุกดาหาร แม่ฮ่องสอน ยโสธร ยะลา ร้อยเอ็ด ระนอง ระยอง ราชบุรี ลพบุรี ลำปาง ลำพูน เลย ศรีสะเกษ
   สกลนคร สงขลา สตูล สมุทรปราการ สมุทรสงคราม สมุทรสาคร สระแก้ว สระบุรี สิงห์บุรี สุโขทัย สุพรรณบุรี
   สุราษฎร์ธานี สุรินทร์ หนองคาย หนองบัวลำภู อ่างทอง อำนาจเจริญ อุดรธานี อุตรดิตถ์ อุทัยธานี อุบลราชธานี`
    .trim()
    .split(/\s+/);

const STATUS: Record<Status, { label: string; className: string }> = {
  pending: { label: "รออนุมัติ", className: "bg-warn-soft text-warn" },
  approved: { label: "อนุมัติแล้ว", className: "bg-success-soft text-success" },
  revoked: { label: "ถูกระงับ", className: "bg-danger-soft text-danger" },
};

export default function VehiclesList({ token }: { token: string }) {
  const [rows, setRows] = useState<Vehicle[] | null>(null);
  const [plate, setPlate] = useState("");
  const [province, setProvince] = useState(PROVINCES[0]);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const res = await fetch("/api/vehicles", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRows(res.ok ? await res.json() : []);
    });
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // ข้อความ error จาก backend อ่านรู้เรื่องอยู่แล้ว (ซ้ำ/ว่าง/หมดสิทธิ์) เอามาแสดงตรง ๆ
  async function fail(res: Response, fallback: string) {
    const body = await res.json().catch(() => null);
    setError(body?.error ?? fallback);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ plate, province }),
    });
    if (!res.ok) return fail(res, "เพิ่มรถไม่สำเร็จ");
    setPlate("");
    load();
  }

  async function remove(v: Vehicle) {
    if (!confirm(`ลบ ${v.plate} ${v.province} ออกจากรายการ?`)) return;
    setError("");
    const res = await fetch(`/api/vehicles/${v.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return fail(res, "ลบไม่สำเร็จ");
    load();
  }

  return (
    <div>
      <header className="border-b border-border pb-4">
        <h1 className="text-lg font-medium">รถของฉัน</h1>
        <p className="mt-0.5 text-xs text-ink-faint">
          เพิ่มทะเบียนรถของคุณ แล้วรอผู้ดูแลอนุมัติก่อนจึงจะผ่านเข้า-ออกได้
        </p>
      </header>

      <form
        onSubmit={add}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">หมายเลขทะเบียน</span>
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            required
            maxLength={20}
            placeholder="1กข 1234"
            className="w-44 rounded-md border border-border bg-surface px-3 py-1.5 font-mono focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">จังหวัด</span>
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="w-52 rounded-md border border-border bg-surface px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {PROVINCES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>

        <button
          disabled={busy}
          className="rounded-md border border-ink bg-ink px-4 py-1.5 text-sm text-surface transition-opacity hover:opacity-85 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          เพิ่มรถ
        </button>

        {error && (
          <p role="alert" className="w-full text-sm text-danger">
            {error}
          </p>
        )}
      </form>

      {rows === null ? (
        <p className="mt-8 text-sm text-ink-faint">กำลังโหลด…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-ink-muted">ยังไม่ได้เพิ่มรถ</p>
      ) : (
        <div
          className={`mt-6 grid gap-4 transition-opacity ${busy ? "opacity-50" : ""}`}
          style={{ gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))" }}
        >
          {rows.map((v) => (
            <div
              key={v.id}
              className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(31,30,26,0.05)]"
            >
              <Plate plate={v.plate} province={v.province} />

              <span
                className={`rounded px-2 py-0.5 text-[11px] ${(STATUS[v.status] ?? STATUS.pending).className}`}
              >
                {(STATUS[v.status] ?? STATUS.pending).label}
              </span>

              <div className="flex w-full items-baseline justify-between text-xs text-ink-muted">
                <time dateTime={v.created_at}>
                  เพิ่มเมื่อ{" "}
                  {new Date(v.created_at).toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "short",
                    year: "2-digit",
                  })}
                </time>
                <button
                  onClick={() => remove(v)}
                  className="text-danger underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  ลบ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
