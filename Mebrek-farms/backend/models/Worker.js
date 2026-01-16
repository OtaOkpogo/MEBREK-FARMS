import mongoose from "mongoose";

const workerSchema = new mongoose.Schema({
  fullName: String,
  role: String,
  phone: String,
  shift: String,
  employmentDate: Date,
  status: { type: String, default: "Active" }
});

export default mongoose.model("Worker", workerSchema);
