
require("dotenv").config();

const mongoose = require("mongoose");

async function inspectPostProductionMortality() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const db = mongoose.connection.db;

    const cutoff = new Date("2026-10-29T23:59:59.999Z");

    console.log("\n========== MORTALITY AFTER OCTOBER 29 ==========\n");

    const mortalities = await db
      .collection("mortalities")
      .find({
        date: { $gt: cutoff },
      })
      .sort({ date: 1 })
      .toArray();

    console.log(
      JSON.stringify(
        mortalities.map((item) => ({
          id: item._id.toString(),
          date: item.date,
          birdBatch: item.birdBatch,
          numberDead: item.numberDead,
          productionRecord: item.productionRecord
            ? item.productionRecord.toString()
            : null,
          cause: item.cause,
          notes: item.notes,
        })),
        null,
        2
      )
    );

    console.log("\nTotal mortality records:", mortalities.length);

    console.log("\n========== CHECK LINKED PRODUCTION RECORDS ==========\n");

    const productionIds = mortalities
      .map((item) => item.productionRecord)
      .filter(Boolean);

    const linkedProductions = productionIds.length
      ? await db
          .collection("productions")
          .find({
            _id: { $in: productionIds },
          })
          .toArray()
      : [];

    const foundIds = new Set(
      linkedProductions.map((item) => item._id.toString())
    );

    const missingIds = productionIds
      .filter((id) => !foundIds.has(id.toString()))
      .map((id) => id.toString());

    console.log("Linked production records found:", linkedProductions.length);
    console.log("Missing production references:", missingIds);

    console.log("\n========== RECENT SOFT-DELETED PRODUCTIONS ==========\n");

    const deletedProductions = await db
      .collection("productions")
      .find({
        $or: [
          { isDeleted: true },
          { deletedAt: { $ne: null } },
        ],
      })
      .sort({ date: -1 })
      .limit(20)
      .toArray();

    console.log(
      JSON.stringify(
        deletedProductions.map((item) => ({
          id: item._id.toString(),
          date: item.date,
          pen: item.pen,
          flockId: item.flockId,
          mortality: item.mortality,
          mortalityRecord: item.mortalityRecord
            ? item.mortalityRecord.toString()
            : null,
          isDeleted: item.isDeleted,
          deletedAt: item.deletedAt,
        })),
        null,
        2
      )
    );

    console.log(
      "\nSoft-deleted production records inspected:",
      deletedProductions.length
    );

    console.log("\nInspection completed.");
  } catch (error) {
    console.error("Inspection failed:", error);
  } finally {
    await mongoose.disconnect();
  }
}

inspectPostProductionMortality();

