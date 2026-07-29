"use client";
import { useState } from "react";
import { useEffect } from "react";
import type { Detection } from "@/types";

export default function StatTest({
  isAdmin,
  token,
}: {
  isAdmin: boolean;
  token: string;
}) {
  const [id, setId] = useState<number>(0);
  const [name, setName] = useState<string>("");
  const [days, setDays] = useState<{ day: string; count: number }[]>([]);
  const [deleteId, setDeleteId] = useState<number>(0);

  async function onSaveuser(id: number, name: string) {
    const res = await fetch("/api/mytest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: id, name: name }),
    });
    if (!res.ok) {
      console.error("Error:", res.statusText);
    }
    console.log("Response data:", res.json());
  }

  async function onDeleteId(id: number) {
    const res = await fetch(`/api/mytest/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      console.log("Error:", res.statusText);
    }
    console.log("Response data:", res.json());
  }

  async function fetchDialy() {
    const res = await fetch("/api/mytest/daily", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      console.error("Error:", res.statusText);
    }
    const data = await res.json();
    setDays(data);
  }

  useEffect(() => {
    fetchDialy();
  }, []);

  return (
    <div>
      <input
        type="number"
        value={id}
        onChange={(e) => setId(Number(e.target.value))}
        placeholder="Enter ID"
      />

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter Name"
      />
      <button onClick={() => onSaveuser(id, name)}>Save User</button>

      <input
        type="number"
        value={deleteId}
        onChange={(e) => setDeleteId(Number(e.target.value))}
        placeholder="Enter ID to Delete"
      />
      <button onClick={() => onDeleteId(deleteId)}>Delete User</button>

      <h2>Daily Stats</h2>

      {isAdmin && <button onClick={fetchDialy}>Refresh Daily Stats</button>}
      <ul>
        {days.map((day) => (
          <li key={day.day}>
            {day.day}: {day.count}
          </li>
        ))}
      </ul>
    </div>
  );
}
