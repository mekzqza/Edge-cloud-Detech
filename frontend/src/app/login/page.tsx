import GoogleButton from "../GoogleButton";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-surface p-6">
        <h1 className="text-lg font-medium">เข้าสู่ระบบ</h1>

        <GoogleButton label="เข้าสู่ระบบด้วย Google" />
      </div>
    </main>
  );
}
