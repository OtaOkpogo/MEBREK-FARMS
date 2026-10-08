const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    customerType: {
      type: String,
      enum: [
        "Individual",
        "Supermarket",
        "Restaurant",
        "Hotel",
        "Wholesaler",
        "Retailer",
        "Distributor",
        "Other",
      ],
      default: "Individual",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedBy: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        default: null,
      },
      name: {
        type: String,
        default: "",
      },
      role: {
        type: String,
        default: "",
      },
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    createdBy: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        default: null,
      },
      name: {
        type: String,
        default: "",
      },
    },

    updatedBy: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        default: null,
      },
      name: {
        type: String,
        default: "",
      },
    },
  },
  {
    timestamps: true,
  },
);

// Search/indexes
customerSchema.index({ name: 1 });
customerSchema.index({ phone: 1 });
customerSchema.index({ email: 1 });
customerSchema.index({ isDeleted: 1, isActive: 1 });
customerSchema.index({
  name: "text",
  phone: "text",
  email: "text",
});

module.exports = mongoose.model("Customer", customerSchema);
