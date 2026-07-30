// รัน: node --test src/lib/visits.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { groupVisits } from "./visits.ts";
import type { Detection } from "@/types";

// สร้างแถวปลอม: นาทีที่ n ของวัน
const at = (min: number, plate: string): Detection => ({
  id: min,
  filename: `${min}.jpg`,
  label: null,
  created_at: new Date(Date.UTC(2026, 0, 1, 0, min)).toISOString(),
  plate,
  province: null,
  confidence: 0.9,
  verified: false,
});

test("ภาพติด ๆ กันของป้ายเดียว = 1 รอบ", () => {
  const v = groupVisits([at(0, "ก1"), at(1, "ก1"), at(2, "ก1")], 30);
  assert.equal(v.length, 1);
  assert.equal(v[0].shots, 3);
  assert.equal(v[0].enter, at(0, "ก1").created_at);
  assert.equal(v[0].exit, at(2, "ก1").created_at);
});

test("ห่างเกิน gap = คนละรอบ และเรียงรอบล่าสุดก่อน", () => {
  const v = groupVisits([at(0, "ก1"), at(31, "ก1")], 30);
  assert.equal(v.length, 2);
  assert.equal(v[0].enter, at(31, "ก1").created_at);
});

test("คนละป้ายไม่ปนกันแม้เวลาสลับกัน", () => {
  const v = groupVisits([at(0, "ก1"), at(1, "ขข2"), at(2, "ก1")], 30);
  assert.equal(v.length, 2);
  assert.equal(v.find((x) => x.plate === "ก1")!.shots, 2);
});

test("ไม่มีแถว = ไม่มีรอบ", () => {
  assert.deepEqual(groupVisits([], 30), []);
});
