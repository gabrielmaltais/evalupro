const express = require("express");
const { auth, isAdmin } = require("../middleware/auth");
const User = require("../models/User");

const router = express.Router();

// Protéger toutes les routes de gestion d'utilisateurs par auth et isAdmin
router.use(auth);
router.use(isAdmin);

// 1. Lister tous les utilisateurs
router.get("/", async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", details: err.message });
  }
});

// 2. Mettre à jour le rôle
router.put("/:id/role", async (req, res) => {
  try {
    const { role } = req.body;
    if (!["admin", "teacher"].includes(role)) {
      return res.status(400).json({ message: "Rôle invalide" });
    }

    // Interdire à l'admin de se rétrograder lui-même
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ message: "Vous ne pouvez pas modifier votre propre rôle." });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", details: err.message });
  }
});

// 3. Supprimer un compte
router.delete("/:id", async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ message: "Vous ne pouvez pas supprimer votre propre compte." });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
    
    res.json({ message: "Utilisateur supprimé" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", details: err.message });
  }
});

module.exports = router;
