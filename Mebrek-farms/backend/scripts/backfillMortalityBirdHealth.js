
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const Mortality = require("../models/Mortality");
const BirdHealth = require("../models/BirdHealth");

const APPLY_CHANGES = process.argv.includes("--apply");

async function backfillMortalityBirdHealth() {
  const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URL ||
    process.env.DATABASE_URL;

  if (!mongoUri) {
    throw new Error(
      "MongoDB connection string not found. " +
        "Use the same environment variable as backend/server.js."
    );
  }

  await mongoose.connect(mongoUri);

  console.log("\nMortality → Bird Health backfill");
  console.log(
    `Mode: ${APPLY_CHANGES ? "APPLY CHANGES" : "DRY RUN (no changes)"}`
  );

  const allowedPens = BirdHealth.schema
    .path("pen")
    .enumValues;

  const mortalities = await Mortality.find({}).lean();

  let alreadyLinked = 0;
  let created = 0;
  let linked = 0;
  let skipped = 0;
  let failed = 0;

  for (const mortality of mortalities) {
    try {
      const directHealth = mortality.birdHealthRecord
        ? await BirdHealth.findById(mortality.birdHealthRecord)
        : null;

      const reverseHealth = await BirdHealth.findOne({
        mortalityRecord: mortality._id,
      });

      // Both links exist but point to different records.
      // Do not guess which one is correct.
      if (
        directHealth &&
        reverseHealth &&
        !directHealth._id.equals(reverseHealth._id)
      ) {
        console.log(
          `CONFLICT: Mortality ${mortality._id} has two different Bird Health links.`
        );
        skipped++;
        continue;
      }

      const existingHealth = directHealth || reverseHealth;

      if (existingHealth) {
        const existingMortalityId = existingHealth.mortalityRecord;

        if (
          existingMortalityId &&
          !existingMortalityId.equals(mortality._id)
        ) {
          console.log(
            `CONFLICT: Bird Health ${existingHealth._id} links to another mortality.`
          );
          skipped++;
          continue;
        }

        const needsReverseLink = !existingMortalityId;
        const needsDirectLink =
          !mortality.birdHealthRecord ||
          !mortality.birdHealthRecord.equals(existingHealth._id);

        if (!needsReverseLink && !needsDirectLink) {
          alreadyLinked++;
          continue;
        }

        console.log(
          `REPAIR LINK: Mortality ${mortality._id} → Bird Health ${existingHealth._id}`
        );

        if (APPLY_CHANGES) {
          if (needsReverseLink) {
            existingHealth.mortalityRecord = mortality._id;
            await existingHealth.save();
          }

          if (needsDirectLink) {
            await Mortality.updateOne(
              { _id: mortality._id },
              { $set: { birdHealthRecord: existingHealth._id } }
            );
          }
        }

        linked++;
        continue;
      }

      const pen = String(mortality.birdBatch || "").trim();

      if (!allowedPens.includes(pen)) {
        console.log(
          `SKIP: Mortality ${mortality._id} has unsupported pen "${pen}".`
        );
        skipped++;
        continue;
      }

      const numberDead = Math.max(
        0,
        Number(mortality.numberDead) || 0
      );

      const healthData = {
        date: mortality.date || mortality.createdAt || new Date(),
        pen,
        healthIssue: String(mortality.cause || "Mortality"),
        category: "Mortality",
        birdsAffected: numberDead,
        symptoms: `${numberDead} bird(s) died`,
        severity: "Critical",
        diagnosis: String(mortality.cause || "Mortality"),
        actionTaken: mortality.productionRecord
          ? "Mortality recorded from Production"
          : "Mortality recorded",
        status: "Dead",
        remarks: mortality.notes || "",
        mortalityRecord: mortality._id,
      };

      console.log(
        `MISSING: Mortality ${mortality._id} | Pen: ${pen} | Dead: ${numberDead}`
      );

      if (APPLY_CHANGES) {
        const health = await BirdHealth.create(healthData);

        await Mortality.updateOne(
          { _id: mortality._id },
          { $set: { birdHealthRecord: health._id } }
        );

        console.log(`CREATED: Bird Health ${health._id}`);
      }

      created++;
    } catch (error) {
      failed++;
      console.error(
        `FAILED: Mortality ${mortality._id}: ${error.message}`
      );
    }
  }

  console.log("\n========== SUMMARY ==========");
  console.log(`Mortality records checked: ${mortalities.length}`);
  console.log(`Already linked: ${alreadyLinked}`);
  console.log(`Missing Bird Health records: ${created}`);
  console.log(`Links needing repair: ${linked}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);

  if (!APPLY_CHANGES) {
    console.log(
      "\nPreview only. No database changes were made."
    );
    console.log(
      "Review the output, then rerun with --apply to make changes."
    );
  }
}

backfillMortalityBirdHealth()
  .catch((error) => {
    console.error("Backfill stopped:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

