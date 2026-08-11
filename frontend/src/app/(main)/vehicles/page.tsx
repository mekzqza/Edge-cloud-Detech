import { auth } from "@/auth";
import VehiclesList from "./list";

// รถของฉัน — ทะเบียนที่ผู้ใช้ลงทะเบียนไว้เอง รออนุมัติก่อนถึงจะผ่านเข้า-ออกได้
export default async function VehiclesPage() {
  const session = await auth();
  return <VehiclesList token={session?.user.backendToken ?? ""} />;
}
