const { Router } = require("express");
const { pool } = require("../db");

const router = Router();

router.post("/mytest", async (req, res) => {
  const { id, name } = req.body;
  if (typeof id !== "number" || typeof name !== "string") {
    return res
      .status(400)
      .json({ error: "ต้องมี id (ตัวเลข) และ name (ข้อความ)" });
  }
  const { rows } = await pool.query({
    text: "INSERT INTO test (id, name) VALUES ($1, $2) RETURNING name",
    values: [id, name],
  });
  if (rows[0]) {
    console.log("Inserted name:", rows[0].name);
  }
  res.status(201).json(rows[0]);
});

module.exports = router;
