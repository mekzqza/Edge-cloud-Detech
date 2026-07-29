// รายการเลขหน้าที่จะแสดง: หน้าแรก, หน้าสุดท้าย, และรอบ ๆ หน้าปัจจุบัน — ที่เหลือย่อเป็น "…"
export function pageList(
  current: number,
  last: number,
  window = 2,
): (number | "…")[] {
  const out: (number | "…")[] = [];
  for (let p = 1; p <= last; p++) {
    if (p === 1 || p === last || Math.abs(p - current) <= window) out.push(p);
    else if (out[out.length - 1] !== "…") out.push("…");
  }
  return out;
}
