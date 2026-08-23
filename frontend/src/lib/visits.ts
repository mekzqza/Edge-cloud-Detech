import type { Detection } from "@/types";

export type Visit = {
  plate: string;
  enter: string | null; // null = ไม่พบภาพขาเข้า (เข้ามาก่อนช่วงที่ค้น หรือกล้องขาเข้าพลาด)
  exit: string | null; // null = ยังอยู่ข้างใน (หรือกล้องขาออกพลาด)
  shots: number; // จำนวนภาพที่ถ่ายได้ในรอบ (ทั้งขาเข้าและขาออก)
  filename: string; // ภาพแรกของรอบ ใช้ทำ thumbnail
};

const MS_MIN = 60_000;
const ms = (iso: string) => +new Date(iso);

// จับคู่ภาพขาเข้า–ขาออกของทะเบียนเดียวกันเป็น 1 รอบ
//   burstMin  ภาพรัวจากกล้องตัวเดิมที่ห่างกันไม่เกินนี้ = เหตุการณ์เดียว
//   maxStayH  เข้าแล้วไม่เจอขาออกภายในนี้ = ปิดรอบแบบไม่ทราบเวลาออก
// แถว direction=unknown (ยุคกล้องตัวเดียว) ถูกข้ามทิ้ง
export function groupVisits(
  rows: Detection[],
  burstMin: number,
  maxStayH: number,
): Visit[] {
  const burst = burstMin * MS_MIN;
  const maxStay = maxStayH * 60 * MS_MIN;

  const byPlate = new Map<string, Detection[]>();
  for (const r of rows) {
    if (r.direction !== "in" && r.direction !== "out") continue;
    const key = r.plate ?? "—";
    const list = byPlate.get(key);
    if (list) list.push(r);
    else byPlate.set(key, [r]);
  }

  const visits: Visit[] = [];
  for (const [plate, list] of byPlate) {
    const asc = [...list].sort((a, b) => ms(a.created_at) - ms(b.created_at));
    let open: Visit | null = null; // รอบที่เข้าแล้วยังไม่เจอขาออก
    let last: { dir: string; at: number; visit: Visit } | null = null;

    for (const r of asc) {
      const at = ms(r.created_at);

      // ภาพรัวของเหตุการณ์เดิม — นับเป็นภาพเพิ่ม ไม่ใช่เหตุการณ์ใหม่
      if (last && last.dir === r.direction && at - last.at <= burst) {
        last.visit.shots++;
        last.at = at;
        continue;
      }

      if (r.direction === "in") {
        // เข้าซ้อนเข้า = รอบก่อนหน้าไม่มีขาออก ปล่อย exit เป็น null ไว้
        open = {
          plate,
          enter: r.created_at,
          exit: null,
          shots: 1,
          filename: r.filename,
        };
        visits.push(open);
        last = { dir: "in", at, visit: open };
      } else if (open && at - ms(open.enter!) <= maxStay) {
        open.exit = r.created_at;
        open.shots++;
        last = { dir: "out", at, visit: open };
        open = null;
      } else {
        // ออกโดยไม่มีขาเข้า หรือรอบที่ค้างเกินเพดานแล้ว
        open = null;
        const v: Visit = {
          plate,
          enter: null,
          exit: r.created_at,
          shots: 1,
          filename: r.filename,
        };
        visits.push(v);
        last = { dir: "out", at, visit: v };
      }
    }
  }

  return visits.sort(
    (a, b) => ms((b.enter ?? b.exit)!) - ms((a.enter ?? a.exit)!),
  );
}
