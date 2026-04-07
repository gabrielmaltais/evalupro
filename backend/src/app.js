const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const rubricRoutes = require("./routes/rubrics");
const evaluationRoutes = require("./routes/evaluations");

const studentRoutes = require("./routes/students");

const app = express();
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false, 
}));
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/rubrics", rubricRoutes);
app.use("/api/evaluations", evaluationRoutes);
app.use("/api/students", studentRoutes);

// Pour le déploiement monolithique : Servir les fichiers statiques React
const path = require("path");
app.use(express.static(path.join(__dirname, "../public")));

// Fallback pour le routage React SPA (Remplacer app.get("*") par app.use())
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../public", "index.html"));
});

module.exports = app;
