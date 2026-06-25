const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

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

    phone: String,

    avatar: String,

    lastLogin: Date,
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Admin", adminSchema);
