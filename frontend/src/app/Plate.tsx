// ป้ายทะเบียนจำลอง — เลขทะเบียนบรรทัดบน จังหวัดบรรทัดล่าง กรอบดำพื้นขาวเหมือนป้ายจริง
// raw = ค่าที่ OCR อ่านมา ต่างจาก plate เมื่อไหร่แปลว่าระบบแก้ให้จากรถที่ลงทะเบียนไว้
// ต้องโชว์ ไม่งั้นตอนจับคู่ผิดคันจะได้ป้ายผิดที่ดูน่าเชื่อถือโดยไม่มีใครรู้ (นอกกรอบป้าย ป้ายจริงไม่มีบรรทัดนี้)
export default function Plate({
  plate,
  province,
  raw,
}: {
  plate: string;
  province: string | null;
  raw?: string | null;
}) {
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <span className="inline-flex flex-col items-center rounded-[5px] border-2 border-ink bg-white px-3 py-1 leading-none shadow-[inset_0_0_0_2px_#fff]">
        <span className="font-mono text-base font-medium tracking-[0.12em] text-ink">
          {plate}
        </span>
        {province && (
          <span className="mt-1 text-[10px] text-ink">{province}</span>
        )}
      </span>
      {raw && raw !== plate && (
        <span
          className="font-mono text-[10px] text-ink-faint"
          title="ค่าที่กล้องอ่านได้ก่อนจับคู่กับรถที่ลงทะเบียนไว้"
        >
          อ่านได้ {raw}
        </span>
      )}
    </span>
  );
}
