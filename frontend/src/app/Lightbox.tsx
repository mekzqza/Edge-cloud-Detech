"use client";

import { useEffect, useRef } from "react";

// ดูรูปเต็มจอ — ใช้ <dialog> ของเบราว์เซอร์ ได้ปุ่ม Esc + ฉากหลังทึบมาฟรี
// ponytail: ไม่ลง lightbox lib — ถ้าต้องซูม/เลื่อนดูรูปถัดไปค่อยว่ากัน
export default function Lightbox({
  src,
  alt,
  onClose,
}: {
  src: string | null;
  alt?: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (src) ref.current?.showModal();
  }, [src]);

  if (!src) return null;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={() => ref.current?.close()} // คลิกที่ไหนก็ปิด
      className="m-0 h-dvh max-h-dvh w-full max-w-full bg-transparent backdrop:bg-black/80"
    >
      <div className="flex h-full items-center justify-center p-4">
        <img
          src={src}
          alt={alt ?? ""}
          className="max-h-full max-w-full object-contain"
        />
      </div>
      <button
        type="button"
        aria-label="ปิด"
        className="absolute right-4 top-4 rounded-md bg-surface/85 px-3 py-1.5 text-lg leading-none text-ink"
      >
        ✕
      </button>
    </dialog>
  );
}
