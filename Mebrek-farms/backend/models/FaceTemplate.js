
const mongoose = require("mongoose");

const faceTemplateSchema = new mongoose.Schema(
  {
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      required: true,
      unique: true,
      index: true,
    },
    encryptedDescriptor: {
      type: String,
      required: true,
      select: false,
    },
    iv: {
      type: String,
      required: true,
      select: false,
    },
    authTag: {
      type: String,
      required: true,
      select: false,
    },
    enrolledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("FaceTemplate", faceTemplateSchema);

