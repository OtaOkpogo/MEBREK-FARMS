
require("dotenv").config();

const mongoose = require("mongoose");

async function inspectDatabase() {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error(
        "MONGO_URI was not found in your .env file."
      );
    }

    await mongoose.connect(mongoUri);

    console.log("\nCONNECTED TO MONGODB");
    console.log("Database:", mongoose.connection.name);

    const collections = [
      "flocks",
      "flockallocations",
      "flocktransfers",
      "flockpopulationhistories",
      "productions",
      "mortalities",
    ];

    for (const collectionName of collections) {
      const collection =
        mongoose.connection.db.collection(collectionName);

      const exists = await mongoose.connection.db
        .listCollections(
          { name: collectionName },
          { nameOnly: true }
        )
        .hasNext();

      if (!exists) {
        console.log(`\n${collectionName}: Collection does not exist`);
        continue;
      }

      const count = await collection.countDocuments();

      const indexes = await collection.indexes();

      console.log(`\n========== ${collectionName} ==========`);
      console.log("Documents:", count);
      console.log(
        "Indexes:",
        JSON.stringify(indexes, null, 2)
      );
    }
  } catch (error) {
    console.error("\nDATABASE INSPECTION FAILED:");
    console.error(error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\nDatabase connection closed.");
  }
}

inspectDatabase();

