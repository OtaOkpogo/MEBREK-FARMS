const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const warehouseRoutes = require("./routes/warehouseRoutes");
const vaccinationRoutes = require("./routes/vaccinationRoutes");
const eggSaleRoutes = require("./routes/eggSaleRoutes");
const mortalityRoutes = require("./routes/mortalityRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const notificationRoutes = require("./routes/notification");
const roomInventoryRoutes = require("./routes/roomInventoryRoutes");
const searchRoutes = require("./routes/search");
const reportRoutes = require("./routes/reportRoutes");
const camraRoutes = require("./routes/cameraRoutes");

dotenv.config();
const app = express();
app.disable("etag");
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("Socket Connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Socket Disconnected:", socket.id);
  });
});

app.use(
  cors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

app.use(express.json());

// MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// Routes
app.use("/api/workers", require("./routes/workers"));
app.use("/api/expenses", require("./routes/expenseRoutes"));
app.use("/api/attendance", attendanceRoutes);
app.use("/api/production", require("./routes/production"));
app.use("/api/production", require("./routes/productionRoutes"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/staff", require("./routes/staffRoutes"));
app.use("/api/feed-invoices", require("./routes/feedInvoiceRoutes"));
app.use("/api/feeds", require("./routes/feedRoutes"));
app.use("/api/egg-sales", eggSaleRoutes);
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
app.usw("/api/cameras", cameraRoutes);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
