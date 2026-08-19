"use client";

import { useState } from "react";

type Result = {
  total: number;
  inserted: number;
  duplicated: number;
  skipped: { plate: string; username: string; reason: string }[];
};

// นำเข้าทะเบียนทีละหลายคันจาก CSV — ส่งไฟล์ดิบเป็น text/csv ตรงไป backend
export default function ImportCsv({ token }: { token: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // เคลียร์ก่อน เลือกไฟล์ชื่อเดิมซ้ำจะได้ยิงใหม่ ไม่ใช่เงียบ
    if (!file) return;

    setError("");
    setResult(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/vehicles/import", {
        method: "POST",
        headers: {
          "Content-Type": "text/csv",
          Authorization: `Bearer ${token}`,
        },
        body: await file.text(),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return setError(body?.error ?? "นำเข้าไม่สำเร็จ");
      setResult(body);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8">
      <header className="border-b border-border pb-4">
        <h2 className="text-lg font-medium">นำเข้าทะเบียนจาก CSV</h2>
        <p className="mt-1 text-sm text-ink-muted">
          ต้องมีหัวตาราง <code className="font-mono">plate,province,username</code>{" "}
          — รถที่นำเข้าจะเป็นสถานะอนุมัติทันที ไม่ต้องกดอนุมัติซ้ำ
        </p>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        {/* ponytail: input[type=file] ของเบราว์เซอร์พอแล้ว ไม่ต้องทำโซนลากวาง */}
        <label className="cursor-pointer rounded-md border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-surface-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink">
          เลือกไฟล์ CSV
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={upload}
            className="sr-only"
          />
        </label>
        {busy && <span className="text-sm text-ink-faint">กำลังนำเข้า…</span>}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 max-w-2xl rounded-lg border border-border bg-surface p-4 text-sm">
          <div>
            ทั้งหมด {result.total} แถว — เพิ่มแล้ว{" "}
            <span className="text-success">{result.inserted}</span>, ซ้ำ{" "}
            {result.duplicated}, ข้าม {result.skipped.length}
          </div>

          {result.skipped.length > 0 && (
            <ul className="mt-3 space-y-1 text-ink-muted">
              {result.skipped.map((s, i) => (
                <li key={i}>
                  <span className="font-mono">{s.plate || "(ว่าง)"}</span>{" "}
                  <span className="text-ink-faint">/ {s.username || "(ว่าง)"}</span>{" "}
                  — {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
