import { auth } from "@/auth";
import ComplainForm from "./form";

// ร้องเรียน — ผู้ใช้ส่งเรื่อง + ดูว่าเรื่องที่เคยส่งจัดการแล้วหรือยัง (admin ดูที่ /admin/complain)
export default async function ComplainPage() {
  const session = await auth();
  return <ComplainForm token={session?.user.backendToken ?? ""} />;
}
