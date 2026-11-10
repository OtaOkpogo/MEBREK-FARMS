const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    // ============================================================
    // ACCOUNT INFORMATION
    // ============================================================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    // ============================================================
    // ACCOUNT ROLE AND STATUS
    // ============================================================

    role: {
      type: String,
      enum: ["superadmin", "manager", "staff"],
      default: "staff",
    },

    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },

    // ============================================================
    // LINKED WORKER PROFILE
    // ============================================================

    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      default: null,
    },

    // ============================================================
    // ADDITIONAL ACCOUNT INFORMATION
    // ============================================================

    phone: {
      type: String,
      trim: true,
    },

    avatar: {
      type: String,
      default: "",
    },

    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ============================================================
// INDEXES
// ============================================================

// Ensure that one worker is linked to only one login account.
// Accounts without a worker profile can share workerId: null.
adminSchema.index(
  { workerId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      workerId: { $type: "objectId" },
    },
  },
);

// Support account search.
adminSchema.index({
  name: "text",
  email: "text",
  role: "text",
});

module.exports = mongoose.model("Admin", adminSchema);
