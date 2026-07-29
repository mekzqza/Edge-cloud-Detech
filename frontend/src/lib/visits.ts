import type { Detection } from "@/types";

export type Visit = {
  plate: string;
  enter: string; // ภาพแรกของรอบนั้น = เวลาเข้า
  exit: string; // ภาพสุดท้ายของรอบนั้น = เวลาออก
  shots: number; // จำนวนภาพที่ถ่ายได้ในรอบ
  filename: string; // ภาพแรก ใช้ทำ thumbnail
};

// DB เก็บแค่ "เห็นรถตอนไหน" ไม่มีคอลัมน์เข้า/ออก — ภาพที่ถ่ายติด ๆ กันของป้ายเดียวกัน
// จึงนับเป็นการเข้ามา 1 รอบ; ห่างจากภาพก่อนหน้าเกิน gapMin ถือว่าเป็นรอบใหม่
export function groupVisits(rows: Detection[], gapMin: number): Visit[] {
  const gap = gapMin * 60_000;
  const byPlate = new Map<string, Detection[]>();
  for (const r of rows) {
    const key = r.plate ?? "—";
    (byPlate.get(key) ?? byPlate.set(key, []).get(key)!).push(r);
  }

  const visits: Visit[] = [];
  for (const [plate, list] of byPlate) {
    const asc = [...list].sort(
      (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
    );
    for (const r of asc) {
      const open = visits[visits.length - 1];
      const sameRound =
        open?.plate === plate &&
        +new Date(r.created_at) - +new Date(open.exit) <= gap;
      if (sameRound) {
        open.exit = r.created_at;
        open.shots++;
      } else {
        visits.push({
          plate,
          enter: r.created_at,
          exit: r.created_at,
          shots: 1,
          filename: r.filename,
        });
      }
    }
  }
  return visits.sort((a, b) => +new Date(b.enter) - +new Date(a.enter));
}
