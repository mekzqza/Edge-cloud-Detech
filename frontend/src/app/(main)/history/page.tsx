import { auth } from "@/auth";
import HistoryList from "./list";

// ประวัติรถเข้า — อ่าน session ฝั่ง server แล้วส่ง role/token ให้ตัว list ฝั่ง client
export default async function HistoryPage() {
  const session = await auth();
  return (
    <HistoryList
      isAdmin={session?.user.role === "admin"}
      token={session?.user.backendToken ?? ""}
    />
  );
}
