import { useState } from "react";

export default function App() {
  const [a, setA] = useState(1);
  const [b, setB] = useState(1);
  const [result, setResult] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function calculate() {
    setResult("");
    setError(false);
    setLoading(true);
    try {
      const res = await fetch("/api/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a, b }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(true);
        setResult(data.error || "เกิดข้อผิดพลาด");
        return;
      }
      setResult(`${data.a} + ${data.b} = ${data.result}`);
    } catch {
      setError(true);
      setResult("เชื่อมต่อ backend ไม่ได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h1>เครื่องบวกเลข</h1>
      <p className="subtitle">React + TypeScript</p>

      <div className="expr">
        <input
          type="number"
          value={a}
          onChange={(e) => setA(Number(e.target.value))}
        />
        <span className="plus">+</span>
        <input
          type="number"
          value={b}
          onChange={(e) => setB(Number(e.target.value))}
        />
      </div>

      <button onClick={calculate} disabled={loading}>
        คำนวณ
      </button>

      <div className={error ? "result error" : "result"}>{result}</div>
    </div>
  );
}
