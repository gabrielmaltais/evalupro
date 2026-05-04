const mongoose = require("mongoose");

/**
 * Connexion Mongo avec tentatives (utile en CI / Docker : Mongo peut accepter un ping
 * avant que Mongoose établisse une connexion stable).
 */
async function connectDb(uri) {
  if (!uri) {
    throw new Error("MONGODB_URI manquant");
  }
  const maxAttempts = Math.max(1, Number(process.env.MONGODB_CONNECT_RETRIES || 30));
  const delayMs = Math.max(100, Number(process.env.MONGODB_CONNECT_DELAY_MS || 2000));
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
      return;
    } catch (err) {
      lastErr = err;
      console.error(`MongoDB: tentative ${attempt}/${maxAttempts} échouée — ${err.message}`);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

module.exports = { connectDb };
