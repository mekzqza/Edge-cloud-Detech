const { Router } = require("express");

const router = Router();

router.post("/add", (req, res) => {
  const { a, b } = req.body;
  if (typeof a !== "number" || typeof b !== "number") {
    return res.status(400).json({ error: "a และ b ต้องเป็นตัวเลขทั้งคู่" });
  }
  console.log(`add: ${a} + ${b}`);
  res.json({ a, b, result: a + b });
});

module.exports = router;
