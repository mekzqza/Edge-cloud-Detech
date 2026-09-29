import { auth } from "@/auth";
import AccountForm from "./form";

// บัญชีของฉัน — ดู/แก้ชื่อและช่องทางติดต่อของตัวเอง + ทางไปเปลี่ยนรหัสผ่าน
export default async function AccountPage() {
  const session = await auth();
  return <AccountForm token={session?.user.backendToken ?? ""} />;
}
