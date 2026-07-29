import { auth } from "@/auth";
import RecordsList from "./list";

// บันทึกรถเข้า — อ่าน session ฝั่ง server แล้วส่ง role/token ให้ตัว list ฝั่ง client
export default async function RecordsPage() {
  const session = await auth();
  return (
    <RecordsList
      isAdmin={session?.user.role === "admin"}
      token={session?.user.backendToken ?? ""}
    />
  );
}
