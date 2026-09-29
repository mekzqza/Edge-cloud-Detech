import { auth } from "@/auth";
import Complaints from "./list";

// เรื่องร้องเรียนจากผู้ใช้ — ใครร้องเรียน เมื่อไหร่ เรื่องอะไร + ปิดเรื่อง
export default async function ComplainAdminPage() {
  const session = await auth();
  return <Complaints token={session?.user.backendToken ?? ""} />;
}
