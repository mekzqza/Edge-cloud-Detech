import { useEffect, useState } from "react";

// โครงข้อมูล 1 รูป ที่ backend ส่งกลับมา
type Detection = {
  id: number;
  filename: string;
  label: string | null;
  created_at: string;
  plate: string | null;
  province: string | null;
  confidence: number | null;
};

export default function App() {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);

  // auth — เก็บ token/role ใน localStorage ให้รอด refresh
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [role, setRole] = useState<string | null>(() => localStorage.getItem("role"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const isAdmin = role === "admin";

  useEffect(() => {
    loadDetections();
  }, []);

  async function loadDetections() {
    const res = await fetch("/api/detections");
    setDetections(await res.json());
  }

  // login กับ register ใช้ตัวเดียวกัน ต่างแค่ path — endpoint คืน { token, role } เหมือนกัน
  async function auth(path: "login" | "register") {
    const res = await fetch(`/api/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      return alert(error || (path === "login" ? "login ไม่สำเร็จ" : "สมัครไม่สำเร็จ"));
    }
    const { token, role } = await res.json();
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    setToken(token);
    setRole(role);
    setUsername("");
    setPassword("");
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setToken(null);
    setRole(null);
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
      await loadDetections();
    } catch {
      alert("อัพโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("ลบรูปนี้?")) return;
    const res = await fetch(`/api/detections/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return alert("ลบไม่สำเร็จ");
    await loadDetections();
  }

  // ponytail: แก้ไขด้วย prompt() — ลาซี่สุด, upgrade เป็น inline form ถ้าต้องแก้บ่อย
  async function edit(d: Detection) {
    const plate = prompt("ทะเบียน:", d.plate ?? "");
    if (plate === null) return;
    const province = prompt("จังหวัด:", d.province ?? "");
    if (province === null) return;
    const res = await fetch(`/api/detections/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plate, province }),
    });
    if (!res.ok) return alert("แก้ไขไม่สำเร็จ");
    await loadDetections();
  }

  return (
    <div className="container">
      <header className="topbar">
        <h1>Edge Cloud Detech</h1>
        {token ? (
          <div className="auth">
            <span className="muted">{role}</span>
            <button onClick={logout}>ออกจากระบบ</button>
          </div>
        ) : (
          <div className="auth">
            <input
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && auth("login")}
            />
            <button onClick={() => auth("login")}>เข้าสู่ระบบ</button>
            <button onClick={() => auth("register")}>สมัครสมาชิก</button>
          </div>
        )}
      </header>

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
              <img src={`/uploads/${d.filename}`} alt={d.plate ?? d.label ?? ""} />
              <figcaption>
                {d.plate
                  ? `${d.plate} · ${d.province ?? ""}${
                      d.confidence != null ? ` (${Math.round(d.confidence * 100)}%)` : ""
                    }`
                  : d.label || "—"}
                {isAdmin && (
                  <div className="actions">
                    <button onClick={() => edit(d)}>แก้ไข</button>
                    <button className="danger" onClick={() => remove(d.id)}>
                      ลบ
                    </button>
                  </div>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
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
