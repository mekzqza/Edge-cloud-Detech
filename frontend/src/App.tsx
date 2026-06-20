import { useEffect, useState } from "react";

// โครงข้อมูล 1 รูป ที่ backend ส่งกลับมา (เหมือน type ใน Luau)
type Detection = {
  id: number;
  filename: string;
  label: string;
  created_at: string;
};

export default function App() {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);

  // โหลดรายการรูปตอนเปิดหน้า (รันครั้งเดียว)
  useEffect(() => {
    loadDetections();
  }, []);

  async function loadDetections() {
    const res = await fetch("/api/detections");
    setDetections(await res.json());
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
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
      await loadDetections(); // รีเฟรชแกลเลอรีให้เห็นรูปใหม่
    } catch {
      alert("อัพโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="container">
      <h1>Edge Cloud Detech</h1>

      <section className="upload">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <input
          type="text"
          placeholder="ป้ายกำกับ (label)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button onClick={upload} disabled={!file || uploading}>
          {uploading ? "กำลังส่ง..." : "อัพโหลด"}
        </button>
      </section>

      <h2>รูปทั้งหมด ({detections.length})</h2>
      {detections.length === 0 ? (
        <p className="empty">ยังไม่มีรูป</p>
      ) : (
        <div className="gallery">
          {detections.map((d) => (
            <figure key={d.id} className="item">
              <img src={`/uploads/${d.filename}`} alt={d.label} />
              <figcaption>{d.label || "—"}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

// อ่านไฟล์รูป → base64 (ได้ "data:image/...;base64,xxx" — backend ตัด prefix ให้เอง)
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
