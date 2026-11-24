
require("dotenv").config();
const mongoose = require("mongoose");

async function inspectFlockMigration() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const db = mongoose.connection.db;

    console.log("\n========== DATABASE ==========");
    console.log("Connected:", db.databaseName);

    // Check whether MongoDB supports transactions.
    const hello = await db.admin().command({ hello: 1 });

    console.log("\n========== MONGODB TOPOLOGY ==========");
    console.log("Replica set:", hello.setName || "Not configured");
    console.log("Mongos:", hello.msg === "isdbgrid");

    // Inspect existing flocks.
    const flocks = await db.collection("flocks")
      .find(
        {},
        {
          projection: {
            flockId: 1,
            pen: 1,
            placementDate: 1,
            startingAgeWeeks: 1,
            initialBirdCount: 1,
            status: 1,
            isDeleted: 1,
          },
        }
      )
      .sort({ placementDate: 1 })
      .toArray();

    console.log("\n========== EXISTING FLOCKS ==========");
    console.log(JSON.stringify(flocks, null, 2));

    // Summarize production records by pen.
    const productionSummary = await db
      .collection("productions")
      .aggregate([
        {
          $group: {
            _id: "$pen",
            totalRecords: { $sum: 1 },
            recordsWithFlockRef: {
              $sum: {
                $cond: [
                  { $ne: [{ $ifNull: ["$flock", null] }, null] },
                  1,
                  0,
                ],
              },
            },
            recordsWithFlockId: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: [{ $ifNull: ["$flockId", ""] }, ""] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            firstProductionDate: { $min: "$date" },
            lastProductionDate: { $max: "$date" },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    console.log("\n========== PRODUCTION SUMMARY BY PEN ==========");
    console.log(JSON.stringify(productionSummary, null, 2));

    // Inspect the latest production records.
    const recentProductions = await db
      .collection("productions")
      .find(
        {},
        {
          projection: {
            date: 1,
            pen: 1,
            flock: 1,
            flockId: 1,
            flockAgeWeeks: 1,
            openingStock: 1,
            closingStock: 1,
            mortality: 1,
            mortalityRecord: 1,
            isDeleted: 1,
          },
        }
      )
      .sort({ date: -1 })
      .limit(10)
      .toArray();

    console.log("\n========== LATEST 10 PRODUCTION RECORDS ==========");
    console.log(JSON.stringify(recentProductions, null, 2));

    // Inspect recent mortality records.
    const mortalities = await db
      .collection("mortalities")
      .find(
        {},
        {
          projection: {
            birdBatch: 1,
            productionRecord: 1,
            numberDead: 1,
            date: 1,
            cause: 1,
          },
        }
      )
      .sort({ date: -1 })
      .limit(10)
      .toArray();

    console.log("\n========== LATEST 10 MORTALITY RECORDS ==========");
    console.log(JSON.stringify(mortalities, null, 2));

  } catch (error) {
    console.error("\nINSPECTION FAILED:");
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log("\nInspection completed. Database connection closed.");
  }
}

inspectFlockMigration();

