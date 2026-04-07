require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Rubric = require("../src/models/Rubric");
const Evaluation = require("../src/models/Evaluation");
const User = require("../src/models/User");

async function run() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: node scripts/import-legacy.js <legacy.json>");
  const raw = fs.readFileSync(path.resolve(file), "utf8");
  const legacy = JSON.parse(raw);

  await mongoose.connect(process.env.MONGODB_URI);

  let admin = await User.findOne({ role: "admin" });
  if (!admin) {
    admin = await User.create({ name: "Admin Import", email: "import-admin@example.local", password: "ChangeMe123!", role: "admin" });
  }

  const rubric = await Rubric.create({
    title: legacy.config?.courseTitle || "Grille importee",
    taskTitle: legacy.config?.taskTitle || "Tache",
    version: 1,
    isActive: false,
    criteria: legacy.config?.criteria || [],
    createdBy: admin._id,
  });

  await Evaluation.create({
    studentName: legacy.state?.studentName || "Etudiant",
    date: legacy.state?.date || new Date().toISOString().slice(0, 10),
    scores: legacy.state?.scores || {},
    comments: legacy.state?.comments || {},
    generalComment: legacy.state?.generalComment || "",
    rubric: rubric._id,
    owner: admin._id,
  });

  console.log("Import termine.");
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
