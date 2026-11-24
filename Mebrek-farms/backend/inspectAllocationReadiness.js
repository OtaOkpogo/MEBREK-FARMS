
require("dotenv").config();
const mongoose = require("mongoose");

async function inspectAllocationReadiness() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const db = mongoose.connection.db;
    const productions = db.collection("productions");
    const mortalities = db.collection("mortalities");
    const flocks = db.collection("flocks");

    // Latest production record for every pen.
    const latestByPen = await productions.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $sort: { date: -1, _id: -1 } },
      {
        $group: {
          _id: "$pen",
          latestRecord: { $first: "$$ROOT" },
        },
      },
      {
        $project: {
          pen: "$_id",
          date: "$latestRecord.date",
          flock: "$latestRecord.flock",
          flockId: "$latestRecord.flockId",
          openingStock: "$latestRecord.openingStock",
          mortality: "$latestRecord.mortality",
          closingStock: "$latestRecord.closingStock",
          mortalityRecord: "$latestRecord.mortalityRecord",
        },
      },
      { $sort: { pen: 1 } },
    ]).toArray();

    console.log("\n========== LATEST PRODUCTION PER PEN ==========");
    console.log(JSON.stringify(latestByPen, null, 2));

    // Production records after October 29.
    const laterProductions = await productions.find({
      date: { $gt: new Date("2026-10-29T23:59:59.999Z") },
    }).sort({ date: 1 }).toArray();

    console.log("\n========== PRODUCTION AFTER OCTOBER 29 ==========");
    console.log("Count:", laterProductions.length);
    console.log(
      JSON.stringify(
        laterProductions.map((record) => ({
          id: record._id,
          date: record.date,
          pen: record.pen,
          flockId: record.flockId,
          openingStock: record.openingStock,
          closingStock: record.closingStock,
          mortality: record.mortality,
          isDeleted: record.isDeleted,
        })),
        null,
        2
      )
    );

    // Check the November 5 mortality's linked production.
    const novemberMortality = await mortalities.find({
      date: {
        $gte: new Date("2026-11-05T00:00:00.000Z"),
        $lt: new Date("2026-11-06T00:00:00.000Z"),
      },
    }).toArray();

    console.log("\n========== NOVEMBER 5 MORTALITY ==========");

    for (const mortality of novemberMortality) {
      console.log("\nMortality:");
      console.log({
        id: mortality._id,
        birdBatch: mortality.birdBatch,
        numberDead: mortality.numberDead,
        date: mortality.date,
        productionRecord: mortality.productionRecord,
      });

      if (mortality.productionRecord) {
        const linkedProduction = await productions.findOne({
          _id: mortality.productionRecord,
        });

        console.log("Linked production:");
        console.log(
          linkedProduction
            ? {
                id: linkedProduction._id,
                date: linkedProduction.date,
                pen: linkedProduction.pen,
                flockId: linkedProduction.flockId,
                mortality: linkedProduction.mortality,
                isDeleted: linkedProduction.isDeleted,
              }
            : "No matching production document found"
        );
      }
    }

    // Show existing flock-to-production relationships.
    const flockProductionSummary = await productions.aggregate([
      { $match: { flock: { $ne: null } } },
      {
        $group: {
          _id: "$flock",
          flockId: { $last: "$flockId" },
          pen: { $addToSet: "$pen" },
          records: { $sum: 1 },
        },
      },
    ]).toArray();

    console.log("\n========== FLOCK PRODUCTION RELATIONSHIPS ==========");
    console.log(JSON.stringify(flockProductionSummary, null, 2));

    // Check current flock records and their population fields.
    const flockPopulation = await flocks.find(
      {},
      {
        projection: {
          flockId: 1,
          pen: 1,
          status: 1,
          initialBirdCount: 1,
          populationTrackingStatus: 1,
          isDeleted: 1,
        },
      }
    ).toArray();

    console.log("\n========== FLOCK POPULATION FIELDS ==========");
    console.log(JSON.stringify(flockPopulation, null, 2));

  } catch (error) {
    console.error("INSPECTION FAILED:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nInspection completed.");
  }
}

inspectAllocationReadiness();

