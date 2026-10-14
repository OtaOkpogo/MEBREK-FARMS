
const BirdHealth = require("../models/BirdHealth");

/**
 * Synchronize one source record with its Bird Health entry.
 *
 * sourceLinkField: field on the source model, e.g. birdHealthRecord
 * healthLinkField: field on BirdHealth, e.g. medicationRecord
 */
exports.syncLinkedBirdHealth = async ({
  sourceRecord,
  sourceLinkField,
  healthLinkField,
  payload,
  req,
}) => {
  let healthRecord = null;

  if (sourceRecord[sourceLinkField]) {
    healthRecord = await BirdHealth.findById(
      sourceRecord[sourceLinkField],
    );
  }

  // Recover a link if an earlier version created the health entry
  // but failed to save its ID on the source record.
  if (!healthRecord) {
    healthRecord = await BirdHealth.findOne({
      [healthLinkField]: sourceRecord._id,
    });
  }

  const wasCreated = !healthRecord;

  if (!healthRecord) {
    healthRecord = new BirdHealth({
      ...payload,
      [healthLinkField]: sourceRecord._id,
      recordedBy: req?.user?.id || sourceRecord.administeredBy?.id ||
        sourceRecord.administeredBy || undefined,
    });
  } else {
    Object.assign(healthRecord, payload);
    healthRecord[healthLinkField] = sourceRecord._id;

    // A source update should not silently restore a health entry
    // that someone explicitly deleted in Bird Health.
  }

  await healthRecord.save();

  sourceRecord[sourceLinkField] = healthRecord._id;
  await sourceRecord.save({ validateModifiedOnly: true });

  const io = req?.app?.get("io");
  if (io) {
    io.emit(
      wasCreated ? "birdHealthCreated" : "birdHealthUpdated",
      healthRecord,
    );
  }

  return healthRecord;
};

exports.softDeleteLinkedBirdHealth = async ({
  sourceRecord,
  sourceLinkField,
  req,
}) => {
  let healthRecord = null;

  if (sourceRecord[sourceLinkField]) {
    healthRecord = await BirdHealth.findById(
      sourceRecord[sourceLinkField],
    );
  }

  if (!healthRecord) return null;

  if (!healthRecord.isDeleted) {
    healthRecord.isDeleted = true;
    healthRecord.deletedAt = new Date();
    healthRecord.deletedBy = req?.user?.id || null;
    healthRecord.deletedByName = req?.user?.name || "";
    healthRecord.deletedByRole = req?.user?.role || "";
    await healthRecord.save({ validateModifiedOnly: true });

    const io = req?.app?.get("io");
    if (io) io.emit("birdHealthDeleted", healthRecord);
  }

  return healthRecord;
};

exports.restoreLinkedBirdHealth = async ({
  sourceRecord,
  sourceLinkField,
  req,
}) => {
  let healthRecord = null;

  if (sourceRecord[sourceLinkField]) {
    healthRecord = await BirdHealth.findById(
      sourceRecord[sourceLinkField],
    );
  }

  if (!healthRecord) return null;

  if (healthRecord.isDeleted) {
    healthRecord.isDeleted = false;
    healthRecord.deletedAt = null;
    healthRecord.deletedBy = undefined;
    healthRecord.deletedByName = "";
    healthRecord.deletedByRole = "";
    await healthRecord.save({ validateModifiedOnly: true });

    const io = req?.app?.get("io");
    if (io) io.emit("birdHealthRestored", healthRecord);
  }

  return healthRecord;
};

