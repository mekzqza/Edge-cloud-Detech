const { Router } = require("express");
const router = Router();
const INTERNAL_SECRET = env.INTERNAL_SECRET; //

router.post("/oauth", async (req, res) => {
  const internalSecret = req.headers["x-internal-secret"];
  if (internalSecret === null || internalSecret !== INTERNAL_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json({ ok: true, got: req.body });
});

module.exports = router;
