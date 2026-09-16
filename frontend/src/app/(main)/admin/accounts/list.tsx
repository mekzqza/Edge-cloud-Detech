"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { AdminOwner, NewAccount } from "@/types";

const INPUT =
  "rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus-visible:border-info";

// รหัสผ่านโผล่ครั้งเดียวตอนสร้าง — DB เก็บแต่ hash รีเฟรชหน้าแล้วต้องออกรหัสใหม่
function downloadCsv(rows: NewAccount[]) {
  const csv = [
    "full_name,contact,username,password",
    ...rows.map((r) =>
      [r.full_name ?? "", r.contact ?? "", r.username, r.password].join(","),
    ),
  ].join("\r\n");
  // BOM นำหน้า ไม่งั้น Excel อ่านชื่อไทยเป็นตัวยึกยือ
  const url = URL.createObjectURL(
    new Blob(["﻿" + csv], { type: "text/csv" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "accounts.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// แจก account ให้เจ้าของรถ — ทีละคน, ทีละไฟล์ CSV, หรือเติมให้เจ้าของที่ import ทะเบียนมาแล้ว
export default function Accounts({ token }: { token: string }) {
  const [rows, setRows] = useState<AdminOwner[] | null>(null);
  const [created, setCreated] = useState<NewAccount[]>([]);
  const [skipped, setSkipped] = useState<
    { full_name: string; reason: string }[]
  >([]);
  const [form, setForm] = useState({ full_name: "", contact: "", username: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const api = useCallback(
    async (path: string, init: RequestInit) => {
      const res = await fetch(path, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, ...init.headers },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "ทำรายการไม่สำเร็จ");
      return body;
    },
    [token],
  );

  const load = useCallback(() => {
    startTransition(async () => {
      const res = await fetch("/api/admin/owners", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRows(res.ok ? await res.json() : []);
    });
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // ทุกทางที่สร้าง account ลงกองเดียวกัน ปุ่มดาวน์โหลดจะได้ครบทั้งหน้า
  async function run(fn: () => Promise<NewAccount[]>) {
    setError("");
    setBusy(true);
    try {
      const accounts = await fn();
      setCreated((c) => [...accounts, ...c]);
      load();
      return accounts;
    } catch (e) {
      setError((e as Error).message);
      return [];
    } finally {
      setBusy(false);
    }
  }

  async function addOne(e: React.FormEvent) {
    e.preventDefault();
    const accounts = await run(async () => [
      await api("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }),
    ]);
    if (accounts.length) setForm({ full_name: "", contact: "", username: "" });
  }

  async function importCsv(file?: File | null) {
    if (!file) return;
    const text = await file.text();
    await run(async () => {
      const r = await api("/api/admin/users/import", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text,
      });
      setSkipped(r.skipped);
      // ดาวน์โหลดให้เลยไม่ต้องรอกด — เผลอรีเฟรชก่อนกดคือรหัสทั้งไฟล์หายถาวร
      if (r.created.length) downloadCsv(r.created);
      return r.created as NewAccount[];
    });
  }

  return (
    <section className="mt-8">
      <header className="border-b border-border pb-4">
        <h2 className="text-lg font-medium">แจก account ให้เจ้าของรถ</h2>
        <p className="mt-1 text-sm text-ink-muted">
          ระบบตั้ง username กับรหัสผ่านให้ แล้วบังคับให้เจ้าของตั้งรหัสใหม่เอง
          ตอนล็อกอินครั้งแรก
        </p>
      </header>

      <div className="mt-4 flex flex-wrap items-end gap-6">
        <form onSubmit={addOne} className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-ink-muted">
            ชื่อ-นามสกุล
            <input
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className={`${INPUT} mt-1 block w-44`}
            />
          </label>
          <label className="text-xs text-ink-muted">
            ติดต่อ
            <input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              className={`${INPUT} mt-1 block w-36`}
            />
          </label>
          <label className="text-xs text-ink-muted">
            username (ว่าง = ตั้งให้)
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className={`${INPUT} mt-1 block w-36 font-mono`}
            />
          </label>
          <button
            disabled={busy}
            className="rounded-md bg-ink px-3 py-1.5 text-sm text-page hover:opacity-90 disabled:opacity-50"
          >
            เพิ่ม user
          </button>
        </form>

        <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-muted">
          นำเข้าจาก CSV
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => {
              importCsv(e.target.files?.[0]);
              e.target.value = ""; // เคลียร์ก่อน เลือกไฟล์ชื่อเดิมซ้ำจะได้ยิงใหม่
            }}
            className="sr-only"
          />
        </label>
        <p className="text-xs text-ink-faint">
          CSV ต้องมีหัวตาราง <code className="font-mono">full_name</code> —
          ใส่ <code className="font-mono">contact</code> ด้วยก็ได้
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      {created.length > 0 && (
        <div className="mt-6 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              สร้างแล้ว {created.length} account —{" "}
              <span className="text-ink-muted">
                รหัสผ่านแสดงเฉพาะตอนนี้ ออกจากหน้านี้แล้วดูซ้ำไม่ได้
              </span>
            </div>
            <button
              onClick={() => downloadCsv(created)}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-muted"
            >
              ดาวน์โหลด accounts.csv
            </button>
          </div>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs text-ink-muted">
              <tr className="border-b border-border">
                <th className="py-2 font-normal">ชื่อ</th>
                <th className="py-2 font-normal">username</th>
                <th className="py-2 font-normal">รหัสผ่าน</th>
              </tr>
            </thead>
            <tbody>
              {created.map((a) => (
                <tr key={a.id} className="border-b border-border">
                  <td className="py-2">{a.full_name ?? "—"}</td>
                  <td className="py-2 font-mono">{a.username}</td>
                  <td className="py-2 font-mono">{a.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {skipped.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-ink-muted">
          {skipped.map((s, i) => (
            <li key={i}>
              ข้าม <span className="font-medium">{s.full_name}</span> — {s.reason}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-lg text-sm">
          <thead className="text-left text-xs text-ink-muted">
            <tr className="border-b border-border">
              <th className="py-2 font-normal">เจ้าของ</th>
              <th className="py-2 font-normal">ติดต่อ</th>
              <th className="py-2 font-normal">รถ</th>
              <th className="py-2 font-normal">account</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((o) => (
              <tr key={o.id} className="border-b border-border align-top">
                <td className="py-2">{o.full_name}</td>
                <td className="py-2 text-ink-muted">{o.contact ?? "—"}</td>
                <td className="py-2 text-ink-muted">{o.vehicle_count}</td>
                <td className="py-2">
                  {o.username ? (
                    <span className="font-mono text-ink-muted">
                      {o.username}
                    </span>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(async () => [
                          await api("/api/admin/users", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: o.id }),
                          }),
                        ])
                      }
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-muted disabled:opacity-50"
                    >
                      สร้าง account
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows?.length === 0 && (
          <p className="py-4 text-sm text-ink-muted">
            ยังไม่มีเจ้าของในระบบ — เพิ่มทีละคนด้านบน หรือนำเข้า CSV
          </p>
        )}
      </div>
    </section>
  );
}
