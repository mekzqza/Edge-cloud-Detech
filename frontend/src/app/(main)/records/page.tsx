"use client";

import { useState } from "react";

// บันทึกรถเข้า — อัพโหลดรูปให้ backend ตรวจจับ (ย้ายมาจาก App.tsx เดิม)
export default function RecordsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function upload() {
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const image = await fileToBase64(file);
      const res = await fetch("/api/detections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, label }),
      });
      if (!res.ok) throw new Error();
      setFile(null);
      setLabel("");
      setMessage("บันทึกสำเร็จ");
    } catch {
      setMessage("อัพโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <h1 className="text-lg font-medium">บันทึกรถเข้า</h1>
      <div className="mt-4 flex max-w-2xl flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-4">
        <input
          type="file"
          accept="image/*"
          className="text-sm text-ink-muted"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <input
          type="text"
          placeholder="ป้ายกำกับ (label)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="min-w-40 flex-1 rounded-md border border-border bg-surface-muted px-3 py-2 text-sm outline-none focus:border-info"
        />
        <button
          onClick={upload}
          disabled={!file || uploading}
          className="rounded-md bg-info px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
        >
          {uploading ? "กำลังส่ง..." : "อัพโหลด"}
        </button>
      </div>
      {message && <p className="mt-3 text-sm text-ink-muted">{message}</p>}
    </div>
  );
}

// อ่านไฟล์รูป → base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
