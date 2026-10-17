const Worker = require("../models/Worker");
const Production = require("../models/Production");
const EggSale = require("../models/EggSale");
const Feed = require("../models/Feed");
const Notification = require("../models/Notification");
const RoomInventory = require("../models/RoomInventory");
const Warehouse = require("../models/Warehouse");
const Order = require("../models/Order");
const Vaccination = require("../models/Vaccination");
const Medication = require("../models/Medication");

// ============================================================
// ROLE PERMISSIONS
// Keep this aligned with the existing module access rules.
// ============================================================

const SEARCH_PERMISSIONS = {
  superadmin: {
    workers: true,
    production: true,
    eggSales: true,
    feedInventory: true,
    roomInventory: true,
    notifications: true,
    warehouse: true,
    orders: true,
    vaccinations: true,
    medications: true,
  },
  manager: {
    workers: false,
    production: true,
    eggSales: true,
    feedInventory: true,
    roomInventory: true,
    notifications: true,
    warehouse: true,
    orders: true,
    vaccinations: true,
    medications: true,
  },
  staff: {
    workers: false,
    production: true,
    eggSales: false,
    feedInventory: false,
    roomInventory: false,
    notifications: false,
    warehouse: false,
    orders: true,
    vaccinations: true,
    medications: true,
  },
};

// ============================================================
// SAFE FIELDS TO RETURN
// Never return passwords, bank details, identity numbers,
// medical notes, attachment URLs, or other sensitive fields.
// ============================================================

const CONFIG = {
  workers: {
    model: Worker,
    fields: "firstName lastName employeeId role department phone email status",
  },
  production: {
    model: Production,
    fields:
      "pen date days cratesProduced extraEggPieces totalEggs productionPercentage remarks isDeleted",
  },
  eggSales: {
    model: EggSale,
    fields:
      "customer phone totalAmount amountPaid balance status paymentStatus date invoiceNumber isDeleted",
  },
  feedInventory: {
    model: Feed,
    fields: "name quantity unit supplier pricePerUnit isDeleted",
  },
  roomInventory: {
    model: RoomInventory,
    fields: "roomName itemName category quantity condition remarks",
  },
  notifications: {
    model: Notification,
    fields:
      "senderId recipientId recipientRoles senderName senderRole subject message createdAt",
  },
  warehouse: {
    model: Warehouse,
    fields: "itemName category quantity unit location status isDeleted",
  },
  orders: {
    model: Order,
    fields: "name contact message status createdAt",
  },
  vaccinations: {
    model: Vaccination,
    fields:
      "vaccineName birdBatch quantity administeredBy nextDueDate status isDeleted",
  },
  medications: {
    model: Medication,
    fields:
      "medicationName dosage purpose administeredTo dateAdministered status isDeleted",
  },
};

const EMPTY_RESULT = {
  workers: [],
  production: [],
  eggSales: [],
  feedInventory: [],
  roomInventory: [],
  notifications: [],
  warehouse: [],
  orders: [],
  vaccinations: [],
  medications: [],
};

// ============================================================
// BUILD CASE-INSENSITIVE SEARCH
//
// This does not require MongoDB text indexes.
// Only searches ordinary text fields and safe numeric fields.
// ============================================================

function buildSearchQuery(model, searchTerm) {
  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "i");

  const excludedField =
    /password|token|secret|accountNumber|accountName|bankName|bvn|idNumber|idDocument|passportPhoto|employmentAgreement|medicalNotes|allergies|workRestrictions|url|fileName/i;

  const conditions = [];

  model.schema.eachPath((path, schemaType) => {
    if (
      path.startsWith("_") ||
      excludedField.test(path) ||
      path.includes("password")
    ) {
      return;
    }

    if (schemaType.instance === "String") {
      conditions.push({ [path]: regex });
    }
  });

  // Allow searching numeric values such as quantities, employee IDs
  // stored as numbers, and amounts.
  if (/^\d+(\.\d+)?$/.test(searchTerm)) {
    const numberValue = Number(searchTerm);

    model.schema.eachPath((path, schemaType) => {
      if (schemaType.instance === "Number" && !excludedField.test(path)) {
        conditions.push({ [path]: numberValue });
      }
    });
  }

  return conditions.length ? { $or: conditions } : null;
}

// ============================================================
// NORMALIZE RESULTS FOR THE SEARCH UI
// ============================================================

function normalizeResult(category, item) {
  const value = item.toObject ? item.toObject() : item;

  switch (category) {
    case "workers":
      return {
        _id: value._id,
        title:
          [value.firstName, value.lastName].filter(Boolean).join(" ") ||
          value.employeeId ||
          "Worker",
        subtitle: [value.employeeId, value.department]
          .filter(Boolean)
          .join(" • "),
        detail: [value.role, value.phone, value.email]
          .filter(Boolean)
          .join(" • "),
      };

    case "production":
      return {
        _id: value._id,
        title: value.pen || "Production record",
        subtitle: value.date ? new Date(value.date).toLocaleDateString() : "",
        detail: [
          value.cratesProduced != null ? `Crates: ${value.cratesProduced}` : "",
          value.totalEggs != null ? `Eggs: ${value.totalEggs}` : "",
          value.productionPercentage != null
            ? `${value.productionPercentage}%`
            : "",
        ]
          .filter(Boolean)
          .join(" • "),
      };

    case "eggSales":
      return {
        _id: value._id,
        title: value.customer || value.invoiceNumber || "Egg sale",
        subtitle: [value.phone, value.invoiceNumber]
          .filter(Boolean)
          .join(" • "),
        detail: [
          value.totalAmount != null
            ? `Total: ₦${Number(value.totalAmount).toLocaleString()}`
            : "",
          value.balance != null
            ? `Outstanding: ₦${Number(value.balance).toLocaleString()}`
            : "",
          value.status || value.paymentStatus || "",
        ]
          .filter(Boolean)
          .join(" • "),
      };

    case "feedInventory":
      return {
        _id: value._id,
        title: value.name || "Feed item",
        subtitle: value.supplier || "",
        detail: [
          value.quantity != null ? `Quantity: ${value.quantity}` : "",
          value.unit || "",
        ]
          .filter(Boolean)
          .join(" • "),
      };

    case "roomInventory":
      return {
        _id: value._id,
        title: value.itemName || "Inventory item",
        subtitle: value.roomName || "",
        detail: [
          value.category || "",
          value.quantity != null ? `Quantity: ${value.quantity}` : "",
          value.condition || "",
        ]
          .filter(Boolean)
          .join(" • "),
      };

    case "notifications":
      return {
        _id: value._id,
        title: value.subject || "Message",
        subtitle: value.senderName || value.senderRole || "",
        detail: value.message || "",
        date: value.createdAt,
      };

    case "warehouse":
      return {
        _id: value._id,
        title: value.itemName || "Warehouse item",
        subtitle: [value.category, value.location].filter(Boolean).join(" • "),
        detail: [
          value.quantity != null ? `Quantity: ${value.quantity}` : "",
          value.unit || "",
          value.status || "",
        ]
          .filter(Boolean)
          .join(" • "),
      };

    case "orders":
      return {
        _id: value._id,
        title: value.name || "Order",
        subtitle: value.contact || "",
        detail: [value.status, value.message].filter(Boolean).join(" • "),
        date: value.createdAt,
      };

    case "vaccinations":
      return {
        _id: value._id,
        title: value.vaccineName || "Vaccination",
        subtitle: value.birdBatch || "",
        detail: [
          value.quantity != null ? `Quantity: ${value.quantity}` : "",
          value.administeredBy || "",
          value.status || "",
        ]
          .filter(Boolean)
          .join(" • "),
        date: value.nextDueDate,
      };

    case "medications":
      return {
        _id: value._id,
        title: value.medicationName || "Medication",
        subtitle: value.purpose || "",
        detail: [
          value.dosage || "",
          value.administeredTo || "",
          value.status || "",
        ]
          .filter(Boolean)
          .join(" • "),
        date: value.dateAdministered,
      };

    default:
      return { _id: value._id, title: "Record", subtitle: "", detail: "" };
  }
}

// ============================================================
// GLOBAL SEARCH
// ============================================================

exports.globalSearch = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    if (q.length < 2) {
      return res.json(EMPTY_RESULT);
    }

    const role = req.user?.role || "staff";
    const permissions = SEARCH_PERMISSIONS[role] || SEARCH_PERMISSIONS.staff;

    const requesterId = req.user?._id || req.user?.id;

    const categories = Object.keys(CONFIG);

    const resultEntries = await Promise.all(
      categories.map(async (category) => {
        if (!permissions[category]) {
          return [category, []];
        }

        const { model, fields } = CONFIG[category];
        const searchQuery = buildSearchQuery(model, q);

        if (!searchQuery) {
          return [category, []];
        }

        const filters = [searchQuery];

        // Respect soft-delete visibility.
        if (role !== "superadmin" && model.schema.path("isDeleted")) {
          filters.push({ isDeleted: { $ne: true } });
        }

        // Preserve notification privacy:
        // direct messages are searchable only by their sender or
        // recipient; role-based group messages are searchable by
        // permitted recipients.
        if (category === "notifications") {
          const visibility = [];

          if (requesterId) {
            visibility.push({ senderId: requesterId });
            visibility.push({ recipientId: requesterId });
          }

          visibility.push({
            recipientId: null,
            recipientRoles: role,
          });

          filters.push({ $or: visibility });
        }

        const records = await model
          .find({ $and: filters })
          .select(fields)
          .sort({ createdAt: -1, date: -1 })
          .limit(10)
          .lean();

        return [
          category,
          records.map((record) => normalizeResult(category, record)),
        ];
      }),
    );

    return res.json({
      ...EMPTY_RESULT,
      ...Object.fromEntries(resultEntries),
    });
  } catch (err) {
    console.error("GLOBAL SEARCH ERROR:", err);

    return res.status(500).json({
      message: "Search failed.",
    });
  }
};
