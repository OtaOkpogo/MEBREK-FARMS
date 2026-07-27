const mongoose = require("mongoose");

const workerSchema = new mongoose.Schema(
  {
    // ============================================================
    // WORKER IDENTIFICATION
    // ============================================================

    employeeId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    // ============================================================
    // PERSONAL INFORMATION
    // ============================================================

    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    dateOfBirth: {
      type: Date,
    },

    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },

    maritalStatus: {
      type: String,
      enum: ["Single", "Married", "Divorced", "Widowed"],
    },

    // ============================================================
    // CONTACT INFORMATION
    // ============================================================

    phone: {
      type: String,
      trim: true,
    },

    alternativePhone: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    address: {
      type: String,
      trim: true,
    },

    city: {
      type: String,
      trim: true,
    },

    state: {
      type: String,
      trim: true,
    },

    country: {
      type: String,
      default: "Nigeria",
      trim: true,
    },

    // ============================================================
    // IDENTIFICATION DETAILS
    // ============================================================

    idType: {
      type: String,
      enum: [
        "NIN",
        "Voter's Card",
        "International Passport",
        "Driver's License",
        "Other",
      ],
    },

    idNumber: {
      type: String,
      trim: true,
    },

    idIssueDate: {
      type: Date,
    },

    idExpiryDate: {
      type: Date,
    },

    // ============================================================
    // EMPLOYMENT DETAILS
    // ============================================================

    role: {
      type: String,
      required: true,
      trim: true,
    },

    department: {
      type: String,
      default: "Production",
      trim: true,
    },

    employmentType: {
      type: String,
      enum: ["Permanent", "Contract", "Casual", "Part-Time", "Temporary"],
      default: "Permanent",
    },

    hireDate: {
      type: Date,
      default: Date.now,
    },

    assignedFarmArea: {
      type: String,
      trim: true,
    },

    supervisor: {
      type: String,
      trim: true,
    },

    workShift: {
      type: String,
      enum: ["Morning", "Afternoon", "Night", "Other"],
    },

    startTime: {
      type: String,
    },

    endTime: {
      type: String,
    },

    // ============================================================
    // SALARY / PAYMENT
    // ============================================================

    salary: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentFrequency: {
      type: String,
      enum: ["Monthly", "Weekly", "Daily", "Other"],
      default: "Monthly",
    },

    // ============================================================
    // NEXT OF KIN / EMERGENCY CONTACT
    // ============================================================

    nextOfKinName: {
      type: String,
      trim: true,
    },

    nextOfKinRelationship: {
      type: String,
      trim: true,
    },

    nextOfKinPhone: {
      type: String,
      trim: true,
    },

    nextOfKinAlternativePhone: {
      type: String,
      trim: true,
    },

    nextOfKinAddress: {
      type: String,
      trim: true,
    },

    nextOfKinOccupation: {
      type: String,
      trim: true,
    },

    // ============================================================
    // WORK EXPERIENCE / SKILLS
    // ============================================================

    previousEmployer: {
      type: String,
      trim: true,
    },

    previousPosition: {
      type: String,
      trim: true,
    },

    previousDuties: {
      type: String,
      trim: true,
    },

    skillsExperience: {
      type: String,
      trim: true,
    },

    // ============================================================
    // PAYMENT / BANK INFORMATION
    // ============================================================

    bankName: {
      type: String,
      trim: true,
    },

    accountName: {
      type: String,
      trim: true,
    },

    accountNumber: {
      type: String,
      trim: true,
    },

    bvn: {
      type: String,
      trim: true,
    },

    // ============================================================
    // HEALTH / SAFETY
    // ============================================================

    workRestrictions: {
      type: String,
      trim: true,
    },

    allergies: {
      type: String,
      trim: true,
    },

    medicalNotes: {
      type: String,
      trim: true,
    },

    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    },

    // ============================================================
    // PPE / SAFETY EQUIPMENT
    // ============================================================

    ppeIssued: {
      type: [String],
      default: [],
    },

    // ============================================================
    // DOCUMENT REFERENCES
    // ============================================================

    passportPhoto: {
      type: String,
      trim: true,
    },

    idDocument: {
      type: String,
      trim: true,
    },

    employmentAgreement: {
      type: String,
      trim: true,
    },

    otherDocuments: {
      type: String,
      trim: true,
    },

    // ============================================================
    // WORKER STATUS
    // ============================================================

    status: {
      type: String,
      enum: ["Active", "Inactive", "Suspended", "Terminated", "On Leave"],
      default: "Active",
    },

    // ============================================================
    // ADMINISTRATIVE NOTES
    // ============================================================

    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// ============================================================
// INDEXES
// ============================================================

workerSchema.index({
  firstName: "text",
  lastName: "text",
  employeeId: "text",
  role: "text",
  department: "text",
  phone: "text",
});

workerSchema.index({
  status: 1,
});

workerSchema.index({
  department: 1,
});

workerSchema.index({
  hireDate: -1,
});

// ============================================================
// MODEL
// ============================================================

module.exports = mongoose.model("Worker", workerSchema);
