
require("dotenv").config();

const mongoose = require("mongoose");
const Production = require("../models/Production");
const Mortality = require("../models/Mortality");
const {
  syncLinkedBirdHealth,
} = require("../services/healthSyncService");

const APPLY = process.argv.includes("--apply");

const buildHealthPayload = (mortality) => ({
  date: mortality.date || new Date(),
  pen: mortality.birdBatch,
  healthIssue: mortality.cause,
  category: "Mortality",
  symptoms: `${mortality.numberDead} bird(s) died`,
  diagnosis: mortality.cause,
  actionTaken: "Mortality recorded from Production",
  birdsAffected: mortality.numberDead || 0,
  severity: "Critical",
  status: "Dead",
  remarks: mortality.notes || "",
});

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing from backend/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);

  console.log("Connected database:", mongoose.connection.name);
  console.log("Mode:", APPLY ? "APPLY CHANGES" : "DRY RUN");
  console.log("");

  const productions = await Production.find({
    mortality: { $gt: 0 },
  }).sort({ date: 1, _id: 1 });

  let missingMortality = 0;
  let existingMortality = 0;
  let createdMortality = 0;
  let createdOrUpdatedHealth = 0;
  let failed = 0;

  console.log("Production records with mortality:", productions.length);

  for (const production of productions) {
    try {
      let mortality = production.mortalityRecord
        ? await Mortality.findById(production.mortalityRecord)
        : null;

      if (!mortality) {
        mortality = await Mortality.findOne({
          productionRecord: production._id,
        });
      }

      const isMissing = !mortality;

      if (isMissing) {
        missingMortality++;
      } else {
        existingMortality++;
      }

      console.log(
        `${isMissing ? "[MISSING]" : "[EXISTS]"} ` +
          `${production.date?.toISOString?.().slice(0, 10) || "No date"} | ` +
          `${production.pen} | deaths: ${production.mortality} | ` +
          `production ID: ${production._id}`,
      );

      if (!APPLY) continue;

      if (!mortality) {
        mortality = await Mortality.create({
          productionRecord: production._id,
          birdBatch: production.pen,
          numberDead: production.mortality,
          cause: "Production mortality",
          date: production.date || production.createdAt || new Date(),
          notes:
            `Recovered from historical Production record ${production._id}`,
        });

        createdMortality++;
      } else {
        // Preserve existing cause and notes, but repair the core
        // relationship and values from the authoritative Production record.
        mortality.productionRecord = production._id;
        mortality.birdBatch = production.pen;
        mortality.numberDead = production.mortality;
        mortality.date = production.date || mortality.date;
        await mortality.save();
      }

      production.mortalityRecord = mortality._id;
      await production.save({ validateModifiedOnly: true });

      await syncLinkedBirdHealth({
        sourceRecord: mortality,
        sourceLinkField: "birdHealthRecord",
        healthLinkField: "mortalityRecord",
        payload: buildHealthPayload(mortality),
      });

      createdOrUpdatedHealth++;

    } catch (error) {
      failed++;
      console.error(
        "FAILED for Production",
        String(production._id),
        "-",
        error.message,
      );
    }
  }

  console.log("\n========== RECOVERY SUMMARY ==========");
  console.log("Production mortality records checked:", productions.length);
  console.log("Mortality records missing at start:", missingMortality);
  console.log("Mortality records already present:", existingMortality);

  if (APPLY) {
    console.log("Mortality records created:", createdMortality);
    console.log("Bird Health records created or updated:", createdOrUpdatedHealth);
    console.log("Failed:", failed);
  } else {
    console.log("DRY RUN ONLY — no database records were changed.");
    console.log("Review the entries above before running with --apply.");
  }
}

main()
  .catch((error) => {
    console.error("RECOVERY SCRIPT ERROR:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
