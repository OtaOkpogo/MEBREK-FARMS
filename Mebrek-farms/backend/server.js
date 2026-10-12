const jwt = require("jsonwebtoken");
const Admin = require("./models/Admin");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

// ==============================
// ENVIRONMENT
// ==============================
dotenv.config();

// ==============================
// APP / SERVER
// ==============================
const app = express();
const server = http.createServer(app);

app.disable("etag");

// ==============================
// SERVE UPLOADED FILES
// ==============================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ==============================
// ROUTES
// ==============================
const warehouseRoutes = require("./routes/warehouseRoutes");
const vaccinationRoutes = require("./routes/vaccinationRoutes");
const eggSaleRoutes = require("./routes/eggSaleRoutes");
const manureSaleRoutes = require("./routes/manureSaleRoutes");
const mortalityRoutes = require("./routes/mortalityRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const notificationRoutes = require("./routes/notification");
const roomInventoryRoutes = require("./routes/roomInventoryRoutes");
const searchRoutes = require("./routes/search");
const reportRoutes = require("./routes/reportRoutes");
const customerRoutes = require("./routes/customerRoutes");
const saleAccessRequestRoutes = require("./routes/saleAccessRequestRoutes");

// ==============================
// ENVIRONMENT VARIABLES
// ==============================
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

const allowedOrigins = ["http://localhost:5173", process.env.CLIENT_URL].filter(
  Boolean,
);

// ==============================
// CORS
// ==============================
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`CORS blocked request from: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions));

// ==============================
// SOCKET.IO
// ==============================
const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`Socket.IO CORS blocked request from: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

// ==============================
// SOCKET AUTHENTICATION
// ==============================
// Connections without a token may remain connected for public
// socket functionality, but they cannot join private admin rooms.
// A supplied token must be valid and belong to an active admin.
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      socket.data.admin = null;
      return next();
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured.");
      return next(new Error("Socket authentication unavailable"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded?.id) {
      return next(new Error("Invalid authentication token"));
    }

    const admin = await Admin.findById(decoded.id).select(
      "_id name role status",
    );

    if (!admin || admin.status !== "active") {
      return next(new Error("Account is unavailable"));
    }

    socket.data.admin = {
      id: admin._id.toString(),
      name: admin.name,
      role: admin.role,
    };

    return next();
  } catch (error) {
    console.warn("Socket authentication failed:", error.message);
    return next(new Error("Socket authentication failed"));
  }
});

// ==============================
// SOCKET CONNECTION
// ==============================
io.on("connection", (socket) => {
  const admin = socket.data.admin;

  if (admin) {
    // Private events for this specific account.
    socket.join(`admin:${admin.id}`);

    // Only verified superadmins join this room.
    if (admin.role === "superadmin") {
      socket.join("role:superadmin");
    }

    console.log(
      `Authenticated Socket Connected: ${admin.name} (${admin.role})`,
    );
  } else {
    console.log("Public Socket Connected:", socket.id);
  }

  socket.on("disconnect", (reason) => {
    console.log(`Socket Disconnected: ${socket.id} | Reason: ${reason}`);
  });
});

// ==============================
// BODY PARSER
// ==============================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ==============================
// HEALTH CHECK
// ==============================
app.get("/health", (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const mongoStatus = mongoState === 1 ? "connected" : "disconnected";

  res.status(200).json({
    success: true,
    message: "Mebrek Farms API is running",
    environment: NODE_ENV,
    database: mongoStatus,
    timestamp: new Date().toISOString(),
  });
});

// ==============================
// MALFORMED JSON HANDLER
// ==============================
app.use((err, req, res, next) => {
  if (
    err &&
    (err.type === "entity.parse.failed" || err instanceof SyntaxError)
  ) {
    console.error("Malformed JSON body:", err.message);

    return res.status(400).json({
      success: false,
      message: "Invalid JSON in request body.",
    });
  }

  next(err);
});

// ==============================
// MONGODB CONNECTION
// ==============================
mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 2,
  })
  .then(() => {
    console.log("MongoDB connected");
    console.log(`MongoDB database: ${mongoose.connection.name}`);
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });

// ==============================
// API ROUTES
// ==============================
app.use("/api/workers", require("./routes/workers"));
app.use("/api/expenses", require("./routes/expenseRoutes"));
app.use("/api/attendance", attendanceRoutes);
app.use("/api/production", require("./routes/productionRoutes"));
app.use("/api/flocks", require("./routes/flockRoutes"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/staff", require("./routes/staffRoutes"));
app.use("/api/feed-invoices", require("./routes/feedInvoiceRoutes"));
app.use("/api/feeds", require("./routes/feedRoutes"));
app.use("/api/egg-sales", eggSaleRoutes);
app.use("/api/manure-sales", manureSaleRoutes);
app.use("/api/sale-access-requests", saleAccessRequestRoutes);
app.use("/api/orders", require("./routes/orders"));
app.use("/api/warehouse", warehouseRoutes);
app.use("/api/vaccinations", vaccinationRoutes);
app.use("/api/medications", require("./routes/medications"));
app.use("/api/bird-health", require("./routes/birdHealth"));
app.use("/api/mortality", mortalityRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/room-inventory", roomInventoryRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/backup", require("./routes/backup"));

// ==============================
// API 404 HANDLER
// ==============================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ==============================
// GLOBAL ERROR HANDLER
// ==============================
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  const statusCode = err.status || err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message:
      NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
  });
});

// ==============================
// START SERVER
// ==============================
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
});

// ==============================
// GRACEFUL SHUTDOWN
// ==============================
const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down server...`);

  try {
    await mongoose.connection.close();

    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
  } catch (error) {
    console.error("Shutdown error:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
