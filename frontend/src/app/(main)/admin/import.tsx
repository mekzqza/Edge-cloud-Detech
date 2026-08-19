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
  const [progress, setProgress] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const busy = progress !== null;

  // XHR ไม่ใช่ fetch เพราะ fetch ไม่บอกความคืบหน้าตอนอัปโหลด
  function send(file?: File | null) {
    if (!file || busy) return;
    setError("");
    setResult(null);
    setProgress(0);

    file.text().then((text) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/vehicles/import");
      xhr.setRequestHeader("Content-Type", "text/csv");
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        setProgress(null);
        const body = (() => {
          try {
            return JSON.parse(xhr.responseText);
          } catch {
            return null;
          }
        })();
        if (xhr.status >= 400 || !body) {
          return setError(body?.error ?? "นำเข้าไม่สำเร็จ");
        }
        setResult(body);
        // ตารางคำขอเป็น component พี่น้องกัน — ยิง event แทนยก state ขึ้นไปที่ page.tsx
        // ซึ่งเป็น server component (จะต้องแปลงเป็น client ทั้งหน้าเพื่อ refresh ตารางเดียว)
        window.dispatchEvent(new Event("vehicles-imported"));
      };
      xhr.onerror = () => {
        setProgress(null);
        setError("เชื่อมต่อ backend ไม่ได้");
      };
      xhr.send(text);
    });
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

      <div
        onDragOver={(e) => {
          e.preventDefault(); // ไม่กันไว้ เบราว์เซอร์จะเปิดไฟล์แทนที่จะ drop ลงหน้า
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          send(e.dataTransfer.files[0]);
        }}
        className={`mt-4 max-w-2xl rounded-lg border border-dashed p-6 text-center text-sm transition-colors ${
          over ? "border-ink bg-surface-muted" : "border-border bg-surface"
        } ${busy ? "opacity-50" : ""}`}
      >
        <p className="text-ink-muted">ลากไฟล์ CSV มาวางที่นี่ หรือ</p>
        <label className="mt-3 inline-block cursor-pointer rounded-md border border-border bg-surface px-3 py-1.5 transition-colors hover:bg-surface-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink">
          เลือกไฟล์
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => {
              send(e.target.files?.[0]);
              e.target.value = ""; // เคลียร์ก่อน เลือกไฟล์ชื่อเดิมซ้ำจะได้ยิงใหม่ ไม่ใช่เงียบ
            }}
            className="sr-only"
          />
        </label>
      </div>

      {busy && (
        <div className="mt-4 max-w-2xl">
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="ความคืบหน้าการนำเข้า"
            className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
          >
            <div
              className="h-full bg-ink transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* อัปโหลดครบแล้วยังไม่จบ — backend ยัง insert อยู่ วัดเป็น % ไม่ได้ */}
          <p className="mt-1 text-xs text-ink-faint">
            {progress! < 100
              ? `กำลังอัปโหลด ${progress}%`
              : "กำลังบันทึกลงฐานข้อมูล…"}
          </p>
        </div>
      )}

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
