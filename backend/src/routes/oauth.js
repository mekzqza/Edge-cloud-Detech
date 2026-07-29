const { Router } = require("express");
const router = Router();
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

if (!INTERNAL_SECRET) throw new Error("INTERNAL_SECRET is not set");

router.post("/oauth", async (req, res) => {
  const internalSecret = req.headers["x-internal-secret"];
  if (internalSecret !== INTERNAL_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { email, emailVerified } = req.body;
  if (email === "" || typeof email !== "string") {
    return res.status(400).json({ error: "Invalid email" });
  }

  const emailLower = email.trim().toLowerCase();
  if (!emailLower.includes("@")) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  if (emailVerified !== true) {
    return res.status(400).json({ error: "Email not verified" });
  }

  res.json({ ok: true, got: req.body });
});

module.exports = router;
