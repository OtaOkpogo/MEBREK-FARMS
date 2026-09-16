const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

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

// ==============================
// ENVIRONMENT
// ==============================
dotenv.config();

const app = express();
const server = http.createServer(app);

// Disable ETag
app.disable("etag");

// ==============================
// ENVIRONMENT VARIABLES
// ==============================
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

// Frontend URL(s)
// During development:
// http://localhost:5173
//
// During production:
// https://your-frontend-domain.com
const allowedOrigins = ["http://localhost:5173", process.env.CLIENT_URL].filter(
  Boolean,
);

// ==============================
// CORS
// ==============================
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests without an origin
    // (Postman, server-to-server requests, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`CORS blocked request from: ${origin}`);

    return callback(new Error("Not allowed by CORS"));
  },

  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

  credentials: true,
};

// Express CORS
app.use(cors(corsOptions));

// ==============================
// SOCKET.IO
// ==============================
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
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

// Socket connection
io.on("connection", (socket) => {
  console.log("Socket Connected:", socket.id);

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
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => {
    console.log("MongoDB connected");
    console.log(`MongoDB database: ${mongoose.connection.name}`);
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);

    // In production, do not keep the API running
    // when the database is unavailable.
    process.exit(1);
  });

// ==============================
// API ROUTES
// ==============================

app.use("/api/workers", require("./routes/workers"));

app.use("/api/expenses", require("./routes/expenseRoutes"));

app.use("/api/attendance", attendanceRoutes);

app.use("/api/production", require("./routes/productionRoutes"));

app.use("/api/auth", require("./routes/auth"));

app.use("/api/staff", require("./routes/staffRoutes"));

app.use("/api/feed-invoices", require("./routes/feedInvoiceRoutes"));

app.use("/api/feeds", require("./routes/feedRoutes"));

app.use("/api/egg-sales", eggSaleRoutes);

app.use("/api/manure-sales", manureSaleRoutes);

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
