const express = require("express");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const User = require("../models/User");
const { auth } = require("../middleware/auth");

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      name: user.name,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
}

const updateMeSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court"),
  email: z.string().trim().email("Email invalide"),
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().min(8, "Le nouveau mot de passe doit faire au moins 8 caractères").optional()
  ),
});

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
    const { email, password } = z.object({ email: z.string().min(1), password: z.string().min(1) }).parse(req.body);
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

router.put("/me", auth, async (req, res) => {
  try {
    const body = updateMeSchema.parse(req.body);
    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
    const valid = await user.comparePassword(body.currentPassword);
    if (!valid) return res.status(401).json({ message: "Mot de passe actuel incorrect" });

    const nextEmail = body.email.toLowerCase();
    let changed = false;
    if (body.name !== user.name) {
      user.name = body.name;
      changed = true;
    }
    if (nextEmail !== user.email) {
      const taken = await User.findOne({ email: nextEmail, _id: { $ne: user._id } });
      if (taken) return res.status(409).json({ message: "Email deja utilise" });
      user.email = nextEmail;
      changed = true;
    }
    if (body.newPassword) {
      user.password = body.newPassword;
      changed = true;
    }
    if (!changed) return res.status(400).json({ message: "Aucune modification" });

    await user.save();
    const fresh = await User.findById(user._id);
    const token = signToken(fresh);
    res.json({
      token,
      user: { id: fresh._id, name: fresh.name, email: fresh.email, role: fresh.role },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues?.[0]?.message || "Donnees invalides";
      return res.status(400).json({ message: msg });
    }
    res.status(400).json({ message: "Mise a jour impossible", details: error.message });
  }
});

module.exports = router;
