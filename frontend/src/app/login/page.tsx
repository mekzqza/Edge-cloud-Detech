import Link from "next/link";
import Plate from "../Plate";
import GoogleButton from "../GoogleButton";
import CredentialsForm from "./form";

export default function LoginPage() {
  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-cover bg-center p-6"
      style={{
        // ponytail: overlay เป็นชั้นแรกของ background เดียวกัน — ไม่ต้องมี div ซ้อน
        backgroundImage:
          "linear-gradient(rgba(31,30,26,0.45), rgba(31,30,26,0.45)), url(/backgourd.jpg)",
      }}
    >
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-surface p-8 shadow-[0_6px_24px_rgba(31,30,26,0.08)]">
        <div className="space-y-3 text-center">
          {/* ป้ายทะเบียนตัวเดียวกับที่ใช้ในลิสต์ — เป็นโลโก้ในตัว ไม่ต้องมีไฟล์รูป */}
          <div className="flex justify-center">
            <Plate plate="1กก 1234" province="ขอนแก่น" />
          </div>
          <h1 className="text-lg font-medium">Edge Cloud Detect</h1>
          <p className="text-sm text-ink-muted">
            ระบบอ่านป้ายทะเบียนรถเข้า-ออก
          </p>
        </div>

        <GoogleButton label="เข้าสู่ระบบด้วย Google" />

        {/* เส้นคั่น — span สูง 1px สองข้าง ไม่ต้องมี ::before/::after */}
        <div className="flex items-center gap-3 text-xs text-ink-faint">
          <span className="h-px flex-1 bg-border" />
          หรือ
          <span className="h-px flex-1 bg-border" />
        </div>

        <CredentialsForm />

        <p className="border-t border-border pt-4 text-center text-xs text-ink-faint">
          ยังไม่ล็อกอินก็{" "}
          <Link
            href="/"
            className="text-info underline-offset-4 hover:underline"
          >
            ดูภาพรวมระบบ
          </Link>{" "}
          ได้ · ล็อกอินแล้วจะเห็นบันทึกรถและรถของคุณ
        </p>
      </div>
    </main>
  );
}
