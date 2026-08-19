// ป้ายทะเบียนจำลอง — เลขทะเบียนบรรทัดบน จังหวัดบรรทัดล่าง กรอบดำพื้นขาวเหมือนป้ายจริง
export default function Plate({
  plate,
  province,
}: {
  plate: string;
  province: string | null;
}) {
  return (
    <span className="inline-flex flex-col items-center rounded-[5px] border-2 border-ink bg-white px-3 py-1 leading-none shadow-[inset_0_0_0_2px_#fff]">
      <span className="font-mono text-base font-medium tracking-[0.12em] text-ink">
        {plate}
      </span>
      {province && <span className="mt-1 text-[10px] text-ink">{province}</span>}
    </span>
  );
}
