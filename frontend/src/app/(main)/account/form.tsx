"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// จาก GET/PATCH /api/me — has_password = false คือบัญชี Google ล้วน ไม่มีรหัสให้เปลี่ยน
type Me = {
  id: number;
  username: string | null;
  email: string | null;
  full_name: string | null;
  contact: string | null;
  role: string;
  has_password: boolean;
};

const MAX_LEN = 100; // เท่ากับ MAX_PROFILE_LEN ฝั่ง backend
const INPUT =
  "mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

// null จาก DB ต้องเป็น "" — input ที่ value เป็น null จะกลายเป็น uncontrolled
const toForm = (m: Me) => ({
  full_name: m.full_name ?? "",
  contact: m.contact ?? "",
});

export default function AccountForm({ token }: { token: string }) {
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState(false);
  const [form, setForm] = useState({ full_name: "", contact: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((m: Me | null) => {
        if (!m) return setFailed(true);
        setMe(m);
        setForm(toForm(m));
      })
      .catch(() => setFailed(true));
  }, [token]);

  // ไม่มีอะไรเปลี่ยน = ปุ่มบันทึกกดไม่ได้
  const dirty =
    me !== null &&
    (form.full_name !== (me.full_name ?? "") ||
      form.contact !== (me.contact ?? ""));

  function edit(field: keyof typeof form, value: string) {
    setForm({ ...form, [field]: value });
    setMsg(null); // "บันทึกแล้ว" ค้างไว้ระหว่างพิมพ์ต่อ จะชวนเข้าใจผิดว่าค่าใหม่บันทึกแล้ว
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        return setMsg({ ok: false, text: body?.error ?? "บันทึกไม่สำเร็จ" });
      }
      // ใช้ค่าที่ backend ตัดช่องว่างแล้ว ฟอร์มจะได้ตรงกับที่บันทึกจริง
      setMe(body);
      setForm(toForm(body));
      setMsg({ ok: true, text: "บันทึกแล้ว" });
    } catch {
      setMsg({ ok: false, text: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg">
      <header className="border-b border-border pb-4">
        <h1 className="text-lg font-medium">บัญชีของฉัน</h1>
        <p className="mt-0.5 text-xs text-ink-faint">
          ชื่อและช่องทางติดต่อนี้ ผู้ดูแลระบบจะเห็นตอนอนุมัติรถของคุณ
        </p>
      </header>

      {failed ? (
        <p role="alert" className="mt-8 text-sm text-danger">
          โหลดข้อมูลบัญชีไม่สำเร็จ
        </p>
      ) : !me ? (
        <p className="mt-8 text-sm text-ink-faint">กำลังโหลด…</p>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-ink-muted">ชื่อผู้ใช้</dt>
            <dd className="font-mono">{me.username ?? "—"}</dd>
            {me.email && (
              <>
                <dt className="text-ink-muted">อีเมล</dt>
                <dd className="break-all">{me.email}</dd>
              </>
            )}
            <dt className="text-ink-muted">สิทธิ์</dt>
            <dd>{me.role === "admin" ? "ผู้ดูแลระบบ" : "ผู้ใช้ทั่วไป"}</dd>
          </dl>

          <form
            onSubmit={save}
            className="mt-6 space-y-4 rounded-lg border border-border bg-surface p-4"
          >
            <label className="block text-sm">
              <span className="text-ink-muted">ชื่อ-นามสกุล</span>
              <input
                required
                maxLength={MAX_LEN}
                autoComplete="name"
                value={form.full_name}
                onChange={(e) => edit("full_name", e.target.value)}
                className={INPUT}
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink-muted">ช่องทางติดต่อ (ไม่บังคับ)</span>
              <input
                maxLength={MAX_LEN}
                placeholder="เบอร์โทร หรือ LINE ID"
                value={form.contact}
                onChange={(e) => edit("contact", e.target.value)}
                className={INPUT}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                disabled={busy || !dirty}
                className="h-10 rounded-md border border-ink bg-ink px-4 text-sm text-surface transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40"
              >
                {busy ? "กำลังบันทึก…" : "บันทึก"}
              </button>
              {msg && (
                <p
                  role={msg.ok ? "status" : "alert"}
                  className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}
                >
                  {msg.text}
                </p>
              )}
            </div>
          </form>

          <section className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm">
            <h2 className="font-medium">รหัสผ่าน</h2>
            {me.has_password ? (
              <p className="mt-1 text-ink-muted">
                เปลี่ยนแล้วต้องเข้าสู่ระบบใหม่ด้วยรหัสใหม่ ·{" "}
                <Link
                  href="/password"
                  className="text-info underline-offset-4 hover:underline"
                >
                  เปลี่ยนรหัสผ่าน
                </Link>
              </p>
            ) : (
              <p className="mt-1 text-ink-muted">
                บัญชีนี้เข้าสู่ระบบด้วย Google — ไม่มีรหัสผ่านให้เปลี่ยน
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
