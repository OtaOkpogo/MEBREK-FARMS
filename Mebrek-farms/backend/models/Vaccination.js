const mongoose = require("mongoose");

const VACCINE_TYPES = [
  "Newcastle Disease (ND)",
  "Gumboro (IBD)",
  "Fowl Pox",
  "Marek's Disease",
  "Infectious Bronchitis (IB)",
  "Fowl Cholera",
  "Avian Influenza",
  "Coryza",
  "Salmonella",
  "Coccidiosis",
  "Vitamin Supplement",
  "Deworming",
  "Other",
];

const ROUTES = ["Drinking Water", "Injection", "Spray", "Eye Drop"];

const UNITS = ["Dose", "Bottle", "Vial"];

const PENS = [
  "Battery Cage Row 1",
  "Battery Cage Row 2",
  "Battery Cage Row 3",
  "Deep Litter Pen 1",
  "Deep Litter Pen 2",
  "Deep Litter Pen 3",
  "Sick Bay",
  "Pen 150",
];

const vaccinationSchema = new mongoose.Schema(
  {
    vaccineName: {
      type: String,
      required: true,
    },

    // NOTE: previously defined twice in this schema (once required+enum,
    // once as a bare optional String). The second definition silently
    // overwrote the first, so the enum/required constraint was never
    // actually enforced. This is now the single definition.
    pen: {
      type: String,
      required: true,
      enum: PENS,
    },

    quantityUsed: {
      type: Number,
      required: true,
    },

    // Auto-populated from the logged-in user (req.user) at creation time.
    administeredBy: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
      },
      name: {
        type: String,
      },
      role: {
        type: String,
      },
    },

    dosage: {
      type: String,
    },

    nextDueDate: {
      type: Date,
      required: true,
    },

    notes: {
      type: String,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    deletedByName: {
      type: String,
      default: null,
    },
    deletedByRole: {
      type: String,
      default: null,
    },

    vaccineType: {
      type: String,
      enum: VACCINE_TYPES,
    },

    batchNumber: {
      type: String,
      trim: true,
    },

    manufacturer: {
      type: String,
      trim: true,
    },

    unit: {
      type: String,
      enum: UNITS,
      default: "Dose",
    },

    birdsVaccinated: {
      type: Number,
      min: [0, "birdsVaccinated cannot be negative"],
    },

    vaccinationDate: {
      type: Date,
      required: true,
    },

    route: {
      type: String,
      enum: ROUTES,
    },

    cost: {
      type: Number,
      default: 0,
      min: [0, "cost cannot be negative"],
    },

    // Reflects the status of nextDueDate (Upcoming / Due Today / Overdue).
    // If there is no nextDueDate, the record is simply Completed.
    // Recalculated on every save; the controller's getVaccinations should
    // recompute this live for dashboard counts rather than trust a stale
    // stored value between saves.
    status: {
      type: String,
      enum: ["Upcoming", "Due Today", "Overdue", "Completed"],
      default: "Completed",
    },
  },
  {
    timestamps: true,
  },
);

// Recalculate status based on nextDueDate whenever the record is saved.
// Written as an async function with no `next` parameter (the modern,
// promise-style Mongoose middleware form) to avoid a Mongoose/Kareem
// version quirk where callback-style hooks sometimes get invoked
// without `next` being passed at all, causing "next is not a function".
vaccinationSchema.pre("save", async function () {
  if (!this.nextDueDate) {
    this.status = "Completed";
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(this.nextDueDate);
  due.setHours(0, 0, 0, 0);

  if (due.getTime() < today.getTime()) {
    this.status = "Overdue";
  } else if (due.getTime() === today.getTime()) {
    this.status = "Due Today";
  } else {
    this.status = "Upcoming";
  }
});

vaccinationSchema.index({ isDeleted: 1, createdAt: -1 });
vaccinationSchema.index({ nextDueDate: 1 });
vaccinationSchema.index({ status: 1 });
vaccinationSchema.index({
  pen: 1,
  vaccinationDate: -1,
});

vaccinationSchema.index({
  vaccineName: "text",
  pen: "text",
  manufacturer: "text",
  batchNumber: "text",
  notes: "text",
});

vaccinationSchema.statics.VACCINE_TYPES = VACCINE_TYPES;
vaccinationSchema.statics.ROUTES = ROUTES;
vaccinationSchema.statics.UNITS = UNITS;
vaccinationSchema.statics.PENS = PENS;

module.exports = mongoose.model("Vaccination", vaccinationSchema);
