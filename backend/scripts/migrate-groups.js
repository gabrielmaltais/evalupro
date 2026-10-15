require("dotenv").config();
const mongoose = require("mongoose");
const { migrateGroupsForAll } = require("../src/services/groupMigration");

/** Crée les groupes et inscriptions depuis les anciennes données (idempotent). Usage: node scripts/migrate-groups.js */
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await migrateGroupsForAll();
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
