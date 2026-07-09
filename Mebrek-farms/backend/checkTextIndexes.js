// checkTextIndexes.js
// Run once: node checkTextIndexes.js
require("dotenv").config();
const mongoose = require("mongoose");

const collections = [
  "admins",
  "productions",
  "eggsales",
  "feeds",
  "roominventories",
  "notifications",
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  for (const name of collections) {
    try {
      const indexes = await mongoose.connection.db.collection(name).indexes();
      const textIndex = indexes.find((idx) => idx.textIndexVersion !== undefined);

      if (textIndex) {
        console.log(`✅ ${name}: has text index "${textIndex.name}"`);
      } else {
        console.log(`❌ ${name}: NO TEXT INDEX FOUND`);
      }
    } catch (err) {
      console.log(`⚠️  ${name}: error checking indexes — ${err.message}`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
