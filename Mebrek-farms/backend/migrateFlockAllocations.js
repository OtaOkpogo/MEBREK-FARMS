
require("dotenv").config();

const mongoose = require("mongoose");

const Flock = require("./models/Flock");
const FlockAllocation = require("./models/FlockAllocation");
const FlockPopulationHistory = require("./models/FlockPopulationHistory");

const PENS = require("./constants/pens");

const APPLY_CHANGES = process.argv.includes("--apply");

async function ensureCollectionAndIndexes(Model) {
  // Initialize the collection and its declared indexes before
  // starting the transaction.
  await Model.init();
}

function validDate(value, fallback) {
  const date = value ? new Date(value) : new Date(fallback);

  return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
}

async function migrate() {
  let session;

  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from your backend .env file.");
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("\nConnected to MongoDB.");

    // Ensure collections and indexes exist before the transaction.
    await ensureCollectionAndIndexes(FlockAllocation);
    await ensureCollectionAndIndexes(FlockPopulationHistory);

    const flocks = await Flock.find({
      status: "ACTIVE",
      isDeleted: { $ne: true },
    }).sort({ flockId: 1 }).lean();

    console.log("\n========== MIGRATION PRE-CHECK ==========");
    console.log("Active flocks found:", flocks.length);

    if (flocks.length !== 9) {
      throw new Error(
        `Expected 9 active flocks, but found ${flocks.length}. Stop and review before migrating.`
      );
    }

    if (!Array.isArray(PENS) || PENS.length === 0) {
      throw new Error("The backend pens.js constants could not be loaded.");
    }

    const flockIds = flocks.map((flock) => flock._id);

    const existingAllocations = await FlockAllocation.find({
      flock: { $in: flockIds },
    }).lean();

    const existingHistories = await FlockPopulationHistory.find({
      flock: { $in: flockIds },
      eventType: "INITIAL_PLACEMENT",
      sourceType: "FLOCK",
    }).lean();

    const allocationByFlock = new Map();

    for (const allocation of existingAllocations) {
      const key = allocation.flock.toString();

      if (!allocationByFlock.has(key)) {
        allocationByFlock.set(key, []);
      }

      allocationByFlock.get(key).push(allocation);
    }

    const historyByFlock = new Map(
      existingHistories
        .filter((history) => history.sourceId)
        .map((history) => [history.sourceId.toString(), history])
    );

    const plan = [];

    for (const flock of flocks) {
      if (!flock.flockId) {
        throw new Error(
          `A flock is missing flockId: ${flock._id}`
        );
      }

      if (!flock.pen || !PENS.includes(flock.pen)) {
        throw new Error(
          `Invalid or missing pen for ${flock.flockId}: ${flock.pen}`
        );
      }

      const key = flock._id.toString();
      const allocations = allocationByFlock.get(key) || [];

      const activeAllocations = allocations.filter(
        (allocation) => allocation.status === "ACTIVE"
      );

      if (activeAllocations.length > 1) {
        throw new Error(
          `${flock.flockId} already has multiple active allocations. Manual review required.`
        );
      }

      if (
        activeAllocations.length === 1 &&
        activeAllocations[0].pen !== flock.pen
      ) {
        throw new Error(
          `${flock.flockId} has an active allocation in ${activeAllocations[0].pen}, but its legacy pen is ${flock.pen}. Manual review required.`
        );
      }

      if (
        activeAllocations.length === 0 &&
        allocations.length > 0
      ) {
        throw new Error(
          `${flock.flockId} has previous allocation history but no active allocation. Manual review required.`
        );
      }

      const existingHistory = historyByFlock.get(key);

      plan.push({
        flock,
        existingAllocation: activeAllocations[0] || null,
        existingHistory: existingHistory || null,
        createAllocation: activeAllocations.length === 0,
        createHistory: !existingHistory,
      });
    }

    console.log("\n========== MIGRATION PLAN ==========\n");

    for (const item of plan) {
      console.log({
        flockId: item.flock.flockId,
        pen: item.flock.pen,
        allocation: item.createAllocation ? "CREATE" : "ALREADY EXISTS",
        populationHistory: item.createHistory ? "CREATE" : "ALREADY EXISTS",
        openingBirds: null,
        currentBirds: null,
      });
    }

    const allocationsToCreate = plan.filter(
      (item) => item.createAllocation
    ).length;

    const historiesToCreate = plan.filter(
      (item) => item.createHistory
    ).length;

    console.log("\n========== SUMMARY ==========");
    console.log("Flocks inspected:", plan.length);
    console.log("New allocations:", allocationsToCreate);
    console.log("New history entries:", historiesToCreate);

    if (!APPLY_CHANGES) {
      console.log("\nDRY RUN ONLY.");
      console.log("No migration records were created.");
      console.log("\nTo apply this migration, run:");
      console.log("node migrateFlockAllocations.js --apply");
      return;
    }

    console.log("\n========== APPLYING MIGRATION ==========");

    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      // Re-check the database inside the transaction so that
      // a change made after the dry run cannot be silently overwritten.
      for (const item of plan) {
        const flockId = item.flock._id;

        const currentAllocations = await FlockAllocation.find({
          flock: flockId,
        }).session(session);

        const currentActive = currentAllocations.filter(
          (allocation) => allocation.status === "ACTIVE"
        );

        if (currentActive.length > 1) {
          throw new Error(
            `Concurrent allocation conflict for ${item.flock.flockId}.`
          );
        }

        if (
          currentActive.length === 1 &&
          currentActive[0].pen !== item.flock.pen
        ) {
          throw new Error(
            `Allocation pen changed for ${item.flock.flockId}.`
          );
        }

        if (
          currentActive.length === 0 &&
          currentAllocations.length > 0
        ) {
          throw new Error(
            `Allocation history changed for ${item.flock.flockId}.`
          );
        }

        let allocation = currentActive[0] || null;

        if (!allocation) {
          const allocationDate = validDate(
            item.flock.placementDate,
            item.flock.createdAt || new Date()
          );

          [allocation] = await FlockAllocation.create(
            [
              {
                flock: flockId,
                pen: item.flock.pen,
                openingBirds: null,
                currentBirds: null,
                allocationDate,
                status: "ACTIVE",
                remarks:
                  "Initial allocation created during flock allocation migration. Bird population not yet verified.",
              },
            ],
            { session }
          );

          console.log(
            `Created allocation: ${item.flock.flockId} -> ${item.flock.pen}`
          );
        }

        const existingHistory = await FlockPopulationHistory.findOne({
          flock: flockId,
          eventType: "INITIAL_PLACEMENT",
          sourceType: "FLOCK",
          sourceId: flockId,
        }).session(session);

        if (!existingHistory) {
          await FlockPopulationHistory.create(
            [
              {
                flock: flockId,
                allocation: allocation._id,
                pen: item.flock.pen,
                eventType: "INITIAL_PLACEMENT",
                quantityChange: null,
                balanceAfter: null,
                eventDate: validDate(
                  item.flock.placementDate,
                  item.flock.createdAt || new Date()
                ),
                sourceType: "FLOCK",
                sourceId: flockId,
                remarks:
                  "Initial housing placement migrated from the legacy Flock.pen field. Bird population remains unverified.",
              },
            ],
            { session }
          );

          console.log(
            `Created placement history: ${item.flock.flockId}`
          );
        }
      }
    });

    console.log("\n<escape>========== MIGRATION COMMITTED ==========</escape>");
    console.log("The allocation migration completed successfully.");
  } catch (error) {
    console.error("\nMIGRATION FAILED:");
    console.error(error.message);
    console.error("No partial transaction changes should have been committed.");
    process.exitCode = 1;
  } finally {
    if (session) {
      await session.endSession();
    }

    await mongoose.disconnect();
    console.log("\nMongoDB connection closed.");
  }
}

migrate();

