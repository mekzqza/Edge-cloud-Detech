import { auth } from "@/auth";
import Reports from "./list";

// เรื่องร้องเรียนจากผู้ใช้ — ใครร้องเรียน เมื่อไหร่ เรื่องอะไร + ปิดเรื่อง
export default async function ReportAdminPage() {
  const session = await auth();
  return <Reports token={session?.user.backendToken ?? ""} />;
}
