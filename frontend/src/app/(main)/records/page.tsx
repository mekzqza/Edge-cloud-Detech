import RecordsList from "./list";

// บันทึกรถเข้า — กรอง direction=in อย่างเดียว (แถวเก่าที่ยังเป็น unknown จะไม่ขึ้น)
export default function RecordsPage() {
  return <RecordsList direction="in" />;
}
