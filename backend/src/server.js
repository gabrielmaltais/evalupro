require("dotenv").config();
const app = require("./app");
const { connectDb } = require("./config/db");

const port = process.env.PORT || 4000;

const User = require("./models/User");

async function start() {
  await connectDb(process.env.MONGODB_URI);

  // Création du compte administrateur par défaut si aucun compte n'existe
  try {
    const adminExists = await User.findOne({ role: "admin" });
    if (!adminExists) {
      const admin = new User({
        name: "Administrateur",
        email: "admin",
        password: "AdminPro1",
        role: "admin"
      });
      await admin.save();
      console.log("✅ Compte administrateur par défaut créé → identifiant: admin / mot de passe: AdminPro1");
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
