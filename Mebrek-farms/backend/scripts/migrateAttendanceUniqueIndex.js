
require("dotenv").config();

const mongoose = require("mongoose");

const INDEX_NAME = "workerId_1_attendanceDate_1";
const NEW_INDEX_NAME = "unique_active_worker_attendance_date";

async function migrateAttendanceUniqueIndex() {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!uri) {
      throw new Error(
        "MongoDB connection string not found. Check your backend .env configuration."
      );
    }

    await mongoose.connect(uri);

    const db = mongoose.connection.db;
    const collection = db.collection("attendances");

    console.log("Connected to database:", db.databaseName);

    // Inspect existing indexes before making any changes.
    let indexes = await collection.indexes();

    console.log("\nExisting attendance indexes:");
    console.log(indexes);

    const existingNewIndex = indexes.find(
      (index) => index.name === NEW_INDEX_NAME
    );

    if (existingNewIndex) {
      console.log("\nThe new index already exists. No migration needed.");
      return;
    }

    const oldIndex = indexes.find(
      (index) => index.name === INDEX_NAME
    );

    if (!oldIndex) {
      throw new Error(
        `Expected index "${INDEX_NAME}" was not found. No index was dropped.`
      );
    }

    // Find duplicate active records before changing any index.
    const duplicates = await collection
      .aggregate([
        {
          $match: {
            isDeleted: false,
            workerId: { $type: "objectId" },
            attendanceDate: { $type: "string" },
          },
        },
        {
          $group: {
            _id: {
              workerId: "$workerId",
              attendanceDate: "$attendanceDate",
            },
            count: { $sum: 1 },
            recordIds: { $push: "$_id" },
          },
        },
        {
          $match: {
            count: { $gt: 1 },
          },
        },
      ])
      .toArray();

    if (duplicates.length > 0) {
      console.error(
        "\nMigration stopped. Duplicate active attendance records were found:"
      );
      console.error(JSON.stringify(duplicates, null, 2));
      console.error(
        "Resolve these duplicates before running the migration again."
      );
      return;
    }

    console.log("\nNo duplicate active attendance records found.");

    // Remove only the verified old index.
    await collection.dropIndex(INDEX_NAME);
    console.log(`Dropped old index: ${INDEX_NAME}`);

    // Enforce uniqueness for active registered-worker records only.
    await collection.createIndex(
      {
        workerId: 1,
        attendanceDate: 1,
      },
      {
        unique: true,
        name: NEW_INDEX_NAME,
        partialFilterExpression: {
          isDeleted: false,
          workerId: { $type: "objectId" },
          attendanceDate: { $type: "string" },
        },
      }
    );

    console.log(`Created new index: ${NEW_INDEX_NAME}`);

    indexes = await collection.indexes();

    console.log("\nFinal attendance indexes:");
    console.log(JSON.stringify(indexes, null, 2));

    console.log("\nAttendance index migration completed successfully.");
  } catch (error) {
    console.error("\nAttendance index migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

migrateAttendanceUniqueIndex();

