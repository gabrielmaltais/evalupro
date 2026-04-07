function roles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Non authentifie" });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Acces refuse" });
    }
    next();
  };
}

module.exports = roles;
