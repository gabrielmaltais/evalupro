const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const app = require("./app");
const { connectDb } = require("./config/db");

const port = process.env.PORT || 4000;

const User = require("./models/User");

async function start() {
  await connectDb(process.env.MONGODB_URI);

  // Création du compte administrateur initial si aucun admin n'existe (première installation)
  const initialAdminEmail = (process.env.ADMIN_INITIAL_EMAIL || "admin").toLowerCase();
  const initialAdminPassword = process.env.ADMIN_INITIAL_PASSWORD || "AdminPro1";
  try {
    const adminExists = await User.findOne({ role: "admin" });
    if (!adminExists) {
      const admin = new User({
        name: process.env.ADMIN_INITIAL_NAME || "Administrateur",
        email: initialAdminEmail,
        password: initialAdminPassword,
        role: "admin",
      });
      await admin.save();
      console.log(
        "✅ Compte administrateur initial créé → identifiant: %s (changez le mot de passe après la première connexion ; en production, utilisez ADMIN_INITIAL_EMAIL / ADMIN_INITIAL_PASSWORD).",
        initialAdminEmail
      );
    }
  } catch (error) {
    console.error("Erreur lors de la vérification/création de l'administrateur par défaut:", error);
  }

  app.listen(port, () => {
    console.log(`API demarree sur ${port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
