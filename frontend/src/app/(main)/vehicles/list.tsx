"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Plate from "@/app/Plate";
import StatusBadge from "@/app/StatusBadge";
import type { Vehicle } from "@/types";

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

// ช่องกรอกทะเบียน+จังหวัด ใช้ทั้งฟอร์มเพิ่มและฟอร์มแก้ไข — พ่อแม่เป็นคนคุมว่าจะเรียงแถวหรือซ้อน
function PlateFields({
  plate,
  province,
  onPlate,
  onProvince,
}: {
  plate: string;
  province: string;
  onPlate: (v: string) => void;
  onProvince: (v: string) => void;
}) {
  const field =
    "w-full rounded-md border border-border bg-surface px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
  return (
    <>
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="text-ink-muted">หมายเลขทะเบียน</span>
        <input
          value={plate}
          onChange={(e) => onPlate(e.target.value)}
          required
          maxLength={20}
          placeholder="1กข 1234"
          className={`${field} font-mono`}
        />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="text-ink-muted">จังหวัด</span>
        <select
          value={province}
          onChange={(e) => onProvince(e.target.value)}
          className={field}
        >
          {/* ค่าเดิมที่ไม่อยู่ในลิสต์ต้องโผล่ด้วย ไม่งั้น select เด้งไปจังหวัดแรกเงียบ ๆ */}
          {(PROVINCES.includes(province)
            ? PROVINCES
            : [province, ...PROVINCES]
          ).map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
    </>
  );
}

type Draft = { id: number; plate: string; province: string };

export default function VehiclesList({ token }: { token: string }) {
  const [rows, setRows] = useState<Vehicle[] | null>(null);
  const [plate, setPlate] = useState("");
  const [province, setProvince] = useState(PROVINCES[0]);
  const [draft, setDraft] = useState<Draft | null>(null); // คันที่กำลังแก้อยู่
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  const authHeader = { Authorization: `Bearer ${token}` };

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
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ plate, province }),
    });
    if (!res.ok) return fail(res, "เพิ่มรถไม่สำเร็จ");
    setPlate("");
    load();
  }

  async function save(e: React.FormEvent, v: Vehicle) {
    e.preventDefault();
    if (!draft) return;
    // backend reset เป็น pending ทุกครั้งที่ patch — บอกก่อนจะได้ไม่งงว่าทำไมสิทธิ์หาย
    if (
      v.status === "approved" &&
      !confirm("แก้ไขแล้วต้องรอผู้ดูแลอนุมัติใหม่ ยืนยันหรือไม่?")
    ) {
      return;
    }
    setError("");
    const res = await fetch(`/api/vehicles/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ plate: draft.plate, province: draft.province }),
    });
    if (!res.ok) return fail(res, "แก้ไขไม่สำเร็จ");
    setDraft(null);
    load();
  }

  async function remove(v: Vehicle) {
    if (!confirm(`ลบ ${v.plate} ${v.province} ออกจากรายการ?`)) return;
    setError("");
    const res = await fetch(`/api/vehicles/${v.id}`, {
      method: "DELETE",
      headers: authHeader,
    });
    if (!res.ok) return fail(res, "ลบไม่สำเร็จ");
    load();
  }

  const linkBtn =
    "underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

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
        <div className="flex max-w-md flex-1 gap-3">
          <PlateFields
            plate={plate}
            province={province}
            onPlate={setPlate}
            onProvince={setProvince}
          />
        </div>
        <button
          disabled={busy}
          className="rounded-md border border-ink bg-ink px-4 py-1.5 text-sm text-surface transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40"
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
          {rows.map((v) =>
            draft?.id === v.id ? (
              <form
                key={v.id}
                onSubmit={(e) => save(e, v)}
                className="flex flex-col gap-3 rounded-lg border border-ink bg-surface p-4"
              >
                <PlateFields
                  plate={draft.plate}
                  province={draft.province}
                  onPlate={(plate) => setDraft({ ...draft, plate })}
                  onProvince={(province) => setDraft({ ...draft, province })}
                />
                {v.status === "approved" && (
                  <p className="text-[11px] text-warn">
                    แก้แล้วสถานะจะกลับไปรออนุมัติใหม่
                  </p>
                )}
                <div className="flex gap-2 text-sm">
                  <button className="flex-1 rounded-md border border-ink bg-ink px-3 py-1.5 text-surface transition-opacity hover:opacity-85">
                    บันทึก
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft(null)}
                    className="flex-1 rounded-md border border-border px-3 py-1.5 text-ink-muted hover:text-ink"
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            ) : (
              <div
                key={v.id}
                className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(31,30,26,0.05)]"
              >
                <Plate plate={v.plate} province={v.province} />

                <StatusBadge status={v.status} />

                <div className="flex w-full items-baseline justify-between text-xs text-ink-muted">
                  <time dateTime={v.created_at}>
                    เพิ่มเมื่อ{" "}
                    {new Date(v.created_at).toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                      year: "2-digit",
                    })}
                  </time>
                  <span className="flex gap-3">
                    <button
                      onClick={() => {
                        setError("");
                        setDraft({
                          id: v.id,
                          plate: v.plate,
                          province: v.province,
                        });
                      }}
                      className={`${linkBtn} hover:text-ink`}
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => remove(v)}
                      className={`${linkBtn} text-danger`}
                    >
                      ลบ
                    </button>
                  </span>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
