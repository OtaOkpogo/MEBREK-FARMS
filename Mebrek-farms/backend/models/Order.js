const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    // Keep these fields unchanged: the public website still submits them.
    name: { type: String, required: true, trim: true },
    contact: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },

    status: {
      type: String,
      enum: ["Pending", "Contacted", "Completed", "Cancelled"],
      default: "Pending",
      index: true,
    },

    // Advance-booking information. Existing orders remain valid.
    bookingNumber: { type: Number, unique: true, sparse: true, index: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    productType: {
      type: String,
      enum: ["Eggs", "Manure", "Other"],
      default: null,
    },
    quantity: { type: Number, min: 0, default: null },
    quantityUnit: { type: String, trim: true, default: "" },
    bookingAt: { type: Date, default: Date.now, index: true },
    nextContactAt: { type: Date, default: null, index: true },
    contactStatus: {
      type: String,
      enum: [
        "Not Scheduled",
        "Scheduled",
        "Contacted",
        "No Answer",
        "Reschedule",
        "Completed",
      ],
      default: "Not Scheduled",
      index: true,
    },
    collectionAt: { type: Date, default: null, index: true },
    bookingNotes: { type: String, trim: true, default: "" },
    source: {
      type: String,
      enum: ["Website", "Manual"],
      default: "Website",
      index: true,
    },
    createdBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
      name: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

orderSchema.index({ name: "text", contact: "text", message: "text" });
orderSchema.index({ status: 1, bookingAt: 1 });
orderSchema.index({ contactStatus: 1, nextContactAt: 1 });

module.exports = mongoose.model("Order", orderSchema);
