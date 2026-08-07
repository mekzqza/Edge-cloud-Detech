// รัน: node --test src/routes/detections.test.js
const assert = require("node:assert/strict");
const test = require("node:test");
const { buildWhere } = require("./detections-filter");

test("ไม่ส่งอะไรมา = ไม่มี WHERE", () => {
  assert.deepEqual(buildWhere({}), { where: "", params: [] });
});

test("วันที่ถูกรูปแบบ = เทียบ date ตามเวลาไทย ผ่าน placeholder", () => {
  const { where, params } = buildWhere({ date: "2026-08-07" });
  assert.match(where, /Asia\/Bangkok.*\$1::date/);
  assert.deepEqual(params, ["2026-08-07"]);
});

test("วันที่มั่ว = ไม่ถูกใส่ลง SQL", () => {
  assert.deepEqual(buildWhere({ date: "2026-08-07'; DROP TABLE detections--" }), {
    where: "",
    params: [],
  });
});

test("หลายตัวกรองต่อด้วย AND และเลข placeholder ไม่ชน", () => {
  const { where, params } = buildWhere({
    unverified: "1",
    plate: "unread",
    date: "2026-08-07",
  });
  assert.equal(where.match(/ AND /g).length, 2);
  assert.equal(params.length, 1);
});
