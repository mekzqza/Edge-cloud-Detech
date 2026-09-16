// ponytail: split(",") พอสำหรับ ทะเบียน/จังหวัด/ชื่อ ที่ไม่มีลูกน้ำ
// เจอ CSV ที่มี quote หรือ comma ในค่า ค่อยเปลี่ยนไปใช้ csv-parse
function parseCsv(text) {
  const lines = text
    .replace(/^﻿/, "") // Excel ใส่ BOM มาให้ ไม่ตัดทิ้งคอลัมน์แรกจะชื่อ "﻿plate"
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  if (!lines.length) return [];
  const cols = lines
    .shift()
    .split(",")
    .map((c) => c.trim().toLowerCase());
  return lines.map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(cols.map((c, i) => [c, (cells[i] ?? "").trim()]));
  });
}

module.exports = { parseCsv };

// node src/csv.js
if (require.main === module) {
  const assert = require("assert");
  const rows = parseCsv(
    "﻿plate,province,owner_name\r\n1กก1234, กรุงเทพมหานคร ,สมชาย\r\n\r\n2ขข5678,,\r\n",
  );
  assert.deepStrictEqual(rows, [
    { plate: "1กก1234", province: "กรุงเทพมหานคร", owner_name: "สมชาย" },
    { plate: "2ขข5678", province: "", owner_name: "" },
  ]);
  assert.deepStrictEqual(parseCsv("plate,province,owner_name\n"), []);
  assert.deepStrictEqual(parseCsv(""), []);
  console.log("parseCsv ok");
}
