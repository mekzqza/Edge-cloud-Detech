import { auth } from "@/auth";
import RecordsList from "./list";

// บันทึกรถเข้า — กรอง direction=in อย่างเดียว (แถวเก่าที่ยังเป็น unknown จะไม่ขึ้น)
export default async function RecordsPage() {
  const session = await auth();
  return (
    <RecordsList direction="in" token={session?.user.backendToken ?? ""} />
  );
}
