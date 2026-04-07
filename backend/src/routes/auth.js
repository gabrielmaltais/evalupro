const express = require("express");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
}

router.post("/register", async (req, res) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const exists = await User.findOne({ email: parsed.email.toLowerCase() });
    if (exists) return res.status(409).json({ message: "Email deja utilise" });
    const role = (await User.countDocuments()) === 0 ? "admin" : "teacher";
    const user = await User.create({ ...parsed, role });
    const token = signToken(user);
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(400).json({ message: "Donnees invalides", details: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Identifiants invalides" });
    }
    const token = signToken(user);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(400).json({ message: "Donnees invalides", details: error.message });
  }
});

router.get("/me", auth, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
