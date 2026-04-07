const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function auth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Token manquant" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("_id email name role");
    if (!user) return res.status(401).json({ message: "Utilisateur introuvable" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Token invalide" });
  }
}

module.exports = auth;
