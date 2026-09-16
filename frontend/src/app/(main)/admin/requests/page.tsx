import { auth } from "@/auth";
import ImportCsv from "./import";
import VehicleRequests from "./list";

// นำเข้า CSV อยู่หน้าเดียวกับตาราง — มันยิง event "vehicles-imported" ให้ตารางรีโหลด
export default async function RequestsPage() {
  const session = await auth();
  const token = session?.user.backendToken ?? "";

  return (
    <>
      <ImportCsv token={token} />
      <VehicleRequests token={token} />
    </>
  );
}
