const BirdHealth = require("../models/BirdHealth");

const findLinkedHealthRecord = async ({
  sourceRecord,
  sourceLinkField,
  healthLinkField,
}) => {
  let healthRecord = null;

  if (sourceRecord?.[sourceLinkField]) {
    healthRecord = await BirdHealth.findById(sourceRecord[sourceLinkField]);
  }

  if (!healthRecord && healthLinkField && sourceRecord?._id) {
    healthRecord = await BirdHealth.findOne({
      [healthLinkField]: sourceRecord._id,
    });
  }

  return healthRecord;
};

exports.syncLinkedBirdHealth = async ({
  sourceRecord,
  sourceLinkField,
  healthLinkField,
  payload,
  req,
}) => {
  let healthRecord = await findLinkedHealthRecord({
    sourceRecord,
    sourceLinkField,
    healthLinkField,
  });

  const wasCreated = !healthRecord;

  if (!healthRecord) {
    healthRecord = new BirdHealth({
      ...payload,
      [healthLinkField]: sourceRecord._id,
      recordedBy:
        req?.user?.id ||
        sourceRecord.administeredBy?.id ||
        sourceRecord.administeredBy ||
        undefined,
    });
  } else {
    Object.assign(healthRecord, payload);
    healthRecord[healthLinkField] = sourceRecord._id;
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
  healthLinkField,
  req,
}) => {
  const healthRecord = await findLinkedHealthRecord({
    sourceRecord,
    sourceLinkField,
    healthLinkField,
  });

  if (!healthRecord) return null;

  if (!healthRecord.isDeleted) {
    healthRecord.isDeleted = true;
    healthRecord.deletedAt = new Date();
    healthRecord.deletedBy = req?.user?.id || null;
    healthRecord.deletedByName = req?.user?.name || "";
    healthRecord.deletedByRole = req?.user?.role || "";

    await healthRecord.save({ validateModifiedOnly: true });

    const io = req?.app?.get("io");

    if (io) {
      io.emit("birdHealthDeleted", healthRecord);
    }
  }

  return healthRecord;
};

exports.restoreLinkedBirdHealth = async ({
  sourceRecord,
  sourceLinkField,
  healthLinkField,
  req,
}) => {
  const healthRecord = await findLinkedHealthRecord({
    sourceRecord,
    sourceLinkField,
    healthLinkField,
  });

  if (!healthRecord) return null;

  if (healthRecord.isDeleted) {
    healthRecord.isDeleted = false;
    healthRecord.deletedAt = null;
    healthRecord.deletedBy = undefined;
    healthRecord.deletedByName = "";
    healthRecord.deletedByRole = "";

    await healthRecord.save({ validateModifiedOnly: true });

    const io = req?.app?.get("io");

    if (io) {
      io.emit("birdHealthRestored", healthRecord);
    }
  }

  return healthRecord;
};
