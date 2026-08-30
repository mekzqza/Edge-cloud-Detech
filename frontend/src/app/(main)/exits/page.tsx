import { auth } from "@/auth";
import RecordsList from "../records/list";

// บันทึกรถออก — หน้าเดียวกับ /records แค่กรอง direction=out
export default async function ExitsPage() {
  const session = await auth();
  return (
    <RecordsList direction="out" token={session?.user.backendToken ?? ""} />
  );
}
