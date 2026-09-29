"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { AdminOwner, NewAccount } from "@/types";
import { pageList } from "@/lib/pagination";

const PER_PAGE = 20; // ดึงจาก backend ทีละหน้า (limit/offset)
const PAGE_WINDOW = 2;

const INPUT =
  "rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus-visible:border-info";
const BTN =
  "rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-muted disabled:opacity-50";
const MAX_LEN = 100; // เท่ากับ MAX_PROFILE_LEN ฝั่ง backend

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
  const [total, setTotal] = useState(0);
  const [created, setCreated] = useState<NewAccount[]>([]);
  const [skipped, setSkipped] = useState<
    { full_name: string; reason: string }[]
  >([]);
  const [form, setForm] = useState({ full_name: "", contact: "", username: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  // แถวที่กำลังแก้ชื่อ/ติดต่อ — แก้ได้ทีละแถว
  const [draft, setDraft] = useState<{
    id: number;
    full_name: string;
    contact: string;
  } | null>(null);

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

  const [page, setPage] = useState(1);

  // สร้าง/รีเซ็ตแล้วเรียกซ้ำ = โหลดหน้าเดิมใหม่
  const load = useCallback(() => {
    startTransition(async () => {
      const q = new URLSearchParams({
        limit: String(PER_PAGE),
        offset: String((page - 1) * PER_PAGE),
      });
      const res = await fetch(`/api/admin/owners?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = res.ok ? await res.json() : { rows: [], total: 0 };
      setRows(body.rows);
      setTotal(body.total);
    });
  }, [token, page]);

  useEffect(() => {
    load();
  }, [load]);

  // ทุกทางที่สร้าง account ลงกองเดียวกัน ปุ่มดาวน์โหลดจะได้ครบทั้งหน้า
  async function run(fn: () => Promise<NewAccount[]>) {
    setError("");
    setBusy(true);
    try {
      const accounts = await fn();
      // รีเซ็ตซ้ำคนเดิม = รหัสเก่าใช้ไม่ได้แล้ว เอาแถวเก่าออก
      setCreated((c) => [
        ...accounts,
        ...c.filter((x) => !accounts.some((a) => a.id === x.id)),
      ]);
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

  // ชื่อใน /history และ /admin/requests join สดจาก users — บันทึกตรงนี้แล้วเปลี่ยนตามเอง
  async function saveOwner(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError("");
    setBusy(true);
    try {
      await api(`/api/admin/users/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: draft.full_name,
          contact: draft.contact,
        }),
      });
      setDraft(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

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
              ออกรหัสแล้ว {created.length} account —{" "}
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
        {/* ช่องแก้ไขอยู่ในเซลล์ตาราง ห่อ <form> รอบ <tr> ไม่ได้ — ผูกด้วย attribute form= แทน
            ได้กด Enter เพื่อบันทึก + required ของเบราว์เซอร์มาฟรี */}
        <form id="edit-owner" onSubmit={saveOwner} />
        {/* table-fixed + ความกว้างคอลัมน์ตายตัว — กด "แก้ไข" แล้วช่องกรอกโผล่ ตารางไม่ขยับ (auto layout คำนวณใหม่ทั้งตาราง) */}
        <table className="w-full min-w-lg table-fixed text-sm">
          <thead className="text-left text-xs text-ink-muted">
            <tr className="border-b border-border">
              <th className="w-[30%] py-2 font-normal">เจ้าของ</th>
              <th className="w-[20%] py-2 font-normal">ติดต่อ</th>
              <th className="w-12 py-2 font-normal">รถ</th>
              <th className="py-2 font-normal">account</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((o) =>
              draft?.id === o.id ? (
                <tr key={o.id} className="border-b border-border align-top">
                  <td className="py-2 pr-2">
                    <input
                      form="edit-owner"
                      required
                      autoFocus
                      maxLength={MAX_LEN}
                      value={draft.full_name}
                      onChange={(e) =>
                        setDraft({ ...draft, full_name: e.target.value })
                      }
                      onKeyDown={(e) => e.key === "Escape" && setDraft(null)}
                      placeholder="ชื่อ-นามสกุล"
                      aria-label="ชื่อ-นามสกุล"
                      className={`${INPUT} w-full`}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      form="edit-owner"
                      maxLength={MAX_LEN}
                      value={draft.contact}
                      onChange={(e) =>
                        setDraft({ ...draft, contact: e.target.value })
                      }
                      onKeyDown={(e) => e.key === "Escape" && setDraft(null)}
                      placeholder="ไม่บังคับ"
                      aria-label="ติดต่อ"
                      className={`${INPUT} w-full`}
                    />
                  </td>
                  <td className="py-2 text-ink-muted">{o.vehicle_count}</td>
                  <td className="py-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <button
                        form="edit-owner"
                        disabled={busy}
                        className="rounded-md bg-ink px-2 py-1 text-xs text-page hover:opacity-90 disabled:opacity-50"
                      >
                        บันทึก
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraft(null)}
                        className={BTN}
                      >
                        ยกเลิก
                      </button>
                    </span>
                  </td>
                </tr>
              ) : (
                <tr key={o.id} className="border-b border-border align-top">
                  <td className="py-2 pr-2 break-words">
                    {o.full_name ?? (
                      <span
                        className="text-ink-faint"
                        title="ยังไม่ได้ตั้งชื่อ — แสดง username แทน"
                      >
                        {o.username ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 break-words text-ink-muted">
                    {o.contact ?? "—"}
                  </td>
                  <td className="py-2 text-ink-muted">{o.vehicle_count}</td>
                  <td className="py-2">
                    <span className="flex flex-wrap items-center gap-2">
                      {o.username && (
                        <span className="font-mono break-all text-ink-muted">
                          {o.username}
                        </span>
                      )}
                      <button
                        disabled={busy}
                        onClick={() => {
                          setError("");
                          setDraft({
                            id: o.id,
                            full_name: o.full_name ?? "",
                            contact: o.contact ?? "",
                          });
                        }}
                        className={BTN}
                      >
                        แก้ไข
                      </button>
                      {o.username ? (
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (
                              !confirm(
                                `ออกรหัสใหม่ให้ ${o.username}? รหัสเดิมจะใช้ไม่ได้ทันที`,
                              )
                            )
                              return;
                            run(async () => [
                              await api(`/api/admin/users/${o.id}/password`, {
                                method: "POST",
                              }),
                            ]);
                          }}
                          className={BTN}
                        >
                          รีเซ็ตรหัส
                        </button>
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
                          className={BTN}
                        >
                          สร้าง account
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        {total === 0 && rows && (
          <p className="py-4 text-sm text-ink-muted">
            ยังไม่มีเจ้าของในระบบ — เพิ่มทีละคนด้านบน หรือนำเข้า CSV
          </p>
        )}
        {lastPage > 1 && (
          <nav
            aria-label="หน้า"
            className="mt-6 flex flex-wrap items-center justify-center gap-1 text-sm"
          >
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-ink-muted transition-colors hover:text-ink disabled:opacity-40 disabled:hover:text-ink-muted"
            >
              ก่อนหน้า
            </button>
            {pageList(page, lastPage, PAGE_WINDOW).map((p, i) =>
              p === "…" ? (
                <span key={`gap${i}`} className="px-1.5 text-ink-faint">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  aria-current={p === page ? "page" : undefined}
                  className={`min-w-9 rounded-md border px-2.5 py-1.5 font-mono transition-colors ${
                    p === page
                      ? "border-ink bg-ink text-surface"
                      : "border-border bg-surface text-ink-muted hover:text-ink"
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === lastPage}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-ink-muted transition-colors hover:text-ink disabled:opacity-40 disabled:hover:text-ink-muted"
            >
              ถัดไป
            </button>
          </nav>
        )}
      </div>
    </section>
  );
}
