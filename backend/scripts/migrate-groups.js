require("dotenv").config();
const mongoose = require("mongoose");
const { migrateGroupsForPending } = require("../src/services/groupMigration");

/** Convertit les utilisateurs pas encore migrés: crée les groupes et inscriptions depuis les anciennes données (idempotent). Usage: node scripts/migrate-groups.js */
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await migrateGroupsForPending();
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
