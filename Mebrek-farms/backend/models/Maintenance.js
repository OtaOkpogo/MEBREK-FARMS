const mongoose = require("mongoose");

const PRIORITY_LEVELS = ["Critical", "High", "Medium", "Low"];
const STATUS_FLOW = ["Reported", "Assigned", "In Progress", "Completed", "Closed"];

const maintenanceSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
      index: true,
    },

    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    issue: {
      type: String,
      required: true,
      trim: true,
    },

    priority: {
      type: String,
      enum: PRIORITY_LEVELS,
      required: true,
      default: "Medium",
    },

    status: {
      type: String,
      enum: STATUS_FLOW,
      default: "Reported",
      index: true,
    },

    estimatedCost: {
      type: Number,
      min: 0,
      default: 0,
    },

    costs: {
      labour: { type: Number, min: 0, default: 0 },
      parts: { type: Number, min: 0, default: 0 },
    },

    // Kept as a stored field (rather than a computed virtual) so historical
    // records remain accurate even if the cost-calculation logic changes later.
    actualCost: {
      type: Number,
      min: 0,
      default: 0,
    },

    expectedCompletionDate: Date,

    repairDate: Date,

    completedDate: Date,

    remarks: String,
  },
  {
    timestamps: true,
  }
);

// Keep actualCost in sync with labour + parts whenever costs are set directly.
maintenanceSchema.pre("save", function (next) {
  if (this.isModified("costs")) {
    this.actualCost = (this.costs.labour || 0) + (this.costs.parts || 0);
  }
  next();
});

// Common queries: open repairs by room, open repairs by priority, item history
maintenanceSchema.index({ room: 1, status: 1 });
maintenanceSchema.index({ item: 1, createdAt: -1 });
maintenanceSchema.index({ priority: 1, status: 1 });

module.exports = mongoose.model("Maintenance", maintenanceSchema);
