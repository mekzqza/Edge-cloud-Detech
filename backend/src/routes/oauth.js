const { Router } = require("express");
const router = Router();

router.get("/oauth", async (req, res) => {
  res.json({ message: "OAuth route is working!" });
});

module.exports = router;
