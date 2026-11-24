
require("dotenv").config();

const mongoose = require("mongoose");

const Flock = require("./models/Flock");
const FlockAllocation = require("./models/FlockAllocation");
const FlockPopulationHistory = require("./models/FlockPopulationHistory");
const Production = require("./models/Production");
const Mortality = require("./models/Mortality");

async function verifyMigration() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("\nConnected to MongoDB.");

    const flocks = await Flock.find({
      status: "ACTIVE",
      isDeleted: { $ne: true },
    }).sort({ flockId: 1 }).lean();

    const allocations = await FlockAllocation.find({}).lean();
    const histories = await FlockPopulationHistory.find({
      eventType: "INITIAL_PLACEMENT",
      sourceType: "FLOCK",
    }).lean();

    const productionCount = await Production.countDocuments({});
    const mortalityCount = await Mortality.countDocuments({});

    const issues = [];
    const verified = [];

    for (const flock of flocks) {
      const flockKey = flock._id.toString();

      const flockAllocations = allocations.filter(
        (item) => item.flock.toString() === flockKey
      );

      const activeAllocations = flockAllocations.filter(
        (item) => item.status === "ACTIVE"
      );

      const flockHistories = histories.filter(
        (item) =>
          item.flock.toString() === flockKey &&
          item.sourceId &&
          item.sourceId.toString() === flockKey
      );

      if (activeAllocations.length !== 1) {
        issues.push(
          `${flock.flockId}: expected exactly one active allocation; found ${activeAllocations.length}.`
        );
      }

      if (flockHistories.length !== 1) {
        issues.push(
          `${flock.flockId}: expected exactly one initial placement history; found ${flockHistories.length}.`
        );
      }

      const allocation = activeAllocations[0];

      if (allocation) {
        if (allocation.pen !== flock.pen) {
          issues.push(
            `${flock.flockId}: allocation pen does not match legacy pen.`
          );
        }

        if (
          allocation.openingBirds !== null ||
          allocation.currentBirds !== null
        ) {
          issues.push(
            `${flock.flockId}: population values should remain null until verified.`
          );
        }
      }

      const history = flockHistories[0];

      if (history && allocation) {
        if (
          !history.allocation ||
          history.allocation.toString() !== allocation._id.toString()
        ) {
          issues.push(
            `${flock.flockId}: placement history references the wrong allocation.`
          );
        }

        if (history.pen !== flock.pen) {
          issues.push(
            `${flock.flockId}: placement history pen does not match flock pen.`
          );
        }

        if (
          history.quantityChange !== null ||
          history.balanceAfter !== null
        ) {
          issues.push(
            `${flock.flockId}: initial history population values should be null.`
          );
        }
      }

      verified.push({
        flockId: flock.flockId,
        legacyPen: flock.pen,
        activeAllocations: activeAllocations.length,
        placementHistoryEntries: flockHistories.length,
        openingBirds: allocation?.openingBirds ?? null,
        currentBirds: allocation?.currentBirds ?? null,
        allocationPen: allocation?.pen ?? "MISSING",
      });
    }

    // Check for duplicate active allocations across all flocks.
    const activeCounts = new Map();

    for (const allocation of allocations.filter(
      (item) => item.status === "ACTIVE"
    )) {
      const key = allocation.flock.toString();

      activeCounts.set(key, (activeCounts.get(key) || 0) + 1);
    }

    for (const [flockId, count] of activeCounts.entries()) {
      if (count > 1) {
        issues.push(
          `Flock ${flockId} has ${count} active allocations.`
        );
      }
    }

    // Check for initial placement history entries without a matching flock.
    for (const history of histories) {
      const exists = flocks.some(
        (flock) => flock._id.toString() === history.flock.toString()
      );

      if (!exists) {
        issues.push(
          `Initial placement history ${history._id} references a flock not in the active flock list.`
        );
      }
    }

    console.log("\n========== FLOCK ALLOCATION VERIFICATION ==========\n");

    console.table(verified);

    console.log("\n========== DATABASE COUNTS ==========");
    console.log("Active flocks:", flocks.length);
    console.log("All allocations:", allocations.length);
    console.log(
      "Active allocations:",
      allocations.filter((item) => item.status === "ACTIVE").length
    );
    console.log("Initial placement history entries:", histories.length);
    console.log("Production records:", productionCount);
    console.log("Mortality records:", mortalityCount);

    console.log("\n========== VERIFICATION RESULT ==========\n");

    if (issues.length === 0 && flocks.length === 9) {
      console.log("SUCCESS: All migration checks passed.");
      console.log("Every active flock has exactly one active allocation.");
      console.log("Every active flock has one matching initial placement history.");
      console.log("Population values remain unverified and null.");
    } else {
      console.log("ATTENTION: Issues were found.");

      for (const issue of issues) {
        console.log("-", issue);
      }

      if (flocks.length !== 9) {
        console.log(
          `Expected 9 active flocks, but found ${flocks.length}.`
        );
      }
    }

    console.log("\nVerification completed.");
  } catch (error) {
    console.error("\nVerification failed:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("\nMongoDB connection closed.");
  }
}

verifyMigration();

