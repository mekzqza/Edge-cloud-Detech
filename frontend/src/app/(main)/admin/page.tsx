import { auth } from "@/auth";
import ImportCsv from "./import";
import VehicleRequests from "./requests";

// จัดการระบบ — ข้อมูลบัญชี + คำขอเพิ่มรถ (เห็นเฉพาะ admin, backend เช็คซ้ำด้วย requireAdmin)
export default async function AdminPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "admin";

  return (
    <div>
      <h1 className="text-lg font-medium">จัดการระบบ</h1>
      <div className="mt-4 max-w-2xl rounded-lg border border-border bg-surface p-4 text-sm">
        <div>
          ผู้ใช้: <span className="font-mono">{session?.user.name}</span>
        </div>
        <div className="mt-1">
          สิทธิ์:{" "}
          <span
            className={`rounded-md px-2 py-0.5 text-xs ${
              isAdmin ? "bg-info-soft text-info" : "bg-surface-muted text-ink-muted"
            }`}
          >
            {session?.user.role}
          </span>
        </div>
        <p className="mt-3 text-ink-muted">
          {isAdmin
            ? "แก้ไข/ลบรายการตรวจจับได้จากหน้า ประวัติรถเข้า"
            : "ต้องเป็น admin จึงจะแก้ไข/ลบรายการได้"}
        </p>
      </div>

      {isAdmin && (
        <>
          <ImportCsv token={session?.user.backendToken ?? ""} />
          <VehicleRequests token={session?.user.backendToken ?? ""} />
        </>
      )}
    </div>
  );
}
