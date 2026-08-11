const { Rouyer } = require("express");
const { pool } = require("../db");
const { requireUser } = require("../auth");

const router = Router();

router.post("/vehicles", async (req, res) => {
  const { plate, province } = req.body;
  if (typeof plate !== "string" || typeof province !== "string") {
    return res
      .status(400)
      .json({ error: "ต้องมี plate และ province เป็น string" });
  }

  const userId = req.user.id;
  //เช็คว่ารถคันนี้มีอยู่แล้วหรือไม่;
  const is_car_isExist = await pool.query(
    `SELECT * FROM vehicles WHERE plate = $1 AND province = $2`,
    [plate, province],
  );

  if (is_car_isExist.rows.length > 0) {
    return res.status(400).json({ error: "รถคันนี้มีอยู่แล้ว" });
  }

  //ยังไม่ไมีรถคันนี้ในระบบให้เพิ่มรถคันนี้ลงในฐานข้อมูล;
  const result = await pool.query(
    `INSERT INTO vehicles (plate, province, owner_id) VALUES ($1, $2, $3) RETURNING *`,
    [plate, province, userId],
  );
  return res.status(201).json(result.rows[0]);
});

router.get("/vehicles", async (req, res) => {
  const userId = req.user.id;
  const result = await pool.query(
    `SELECT * FROM vehicles WHERE owner_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return res.json(result.rows);
});

router.delete("/vehicles/:id", requireUser, async (req, res) => {
  const userId = req.user.id;
  const vehicleId = Number(req.params.id);
  if (isNaN(vehicleId)) {
    return res.status(400).json({ error: "vehicle id ต้องเป็นตัวเลข" });
  }

  //เช็คว่ารถคันนี้เป็นของผู้ใช้คนนี้หรือไม่;
  const vehicle = await pool.query(
    `SELECT * FROM vehicles WHERE id = $1 AND owner_id = $2`,
    [vehicleId, userId],
  );

  if (vehicle.rows.length === 0) {
    return res.status(404).json({ error: "ไม่พบรถคันนี้" });
  }

  //ลบรถคันนี้ออกจากฐานข้อมูล;
  await pool.query(`DELETE FROM vehicles WHERE id = $1`, [vehicleId]);
  return res.json({ message: "ลบรถคันนี้เรียบร้อยแล้ว" });
});

router.patch("/vehicles/:id", requireUser, async (req, res) => {
  const userId = req.user.id;
  const vehicleId = Number(req.params.id);
  const { plate, province } = req.body;

  if (isNaN(vehicleId)) {
    return res.status(400).json({ error: "vehicle id ต้องเป็นตัวเลข" });
  }

  //เช็คว่ารถคันนี้เป็นของผู้ใช้คนนี้หรือไม่;
  const vehicle = await pool.query(
    `SELECT * FROM vehicles WHERE id = $1 AND owner_id = $2`,
    [vehicleId, userId],
  );

  if (vehicle.rows.length === 0) {
    return res.status(404).json({ error: "ไม่พบรถคันนี้" });
  }

  //อัปเดตรายละเอียดรถคันนี้;
  const result = await pool.query(
    `UPDATE vehicles SET plate = $1, province = $2 WHERE id = $3 RETURNING *`,
    [
      plate || vehicle.rows[0].plate,
      province || vehicle.rows[0].province,
      vehicleId,
    ],
  );

  return res.json(result.rows[0]);
});

module.exports = router;
