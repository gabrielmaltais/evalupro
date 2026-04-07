require("dotenv").config();
const app = require("./app");
const { connectDb } = require("./config/db");

const port = process.env.PORT || 4000;

async function start() {
  await connectDb(process.env.MONGODB_URI);
  app.listen(port, () => {
    console.log(`API demarree sur ${port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
