const mongoose = require("mongoose");

const workerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String, required: true },
    phone: String,
    salary: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Worker", workerSchema);
