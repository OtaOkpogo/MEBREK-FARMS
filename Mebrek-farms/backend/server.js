const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const warehouseRoutes = require("./routes/warehouseRoutes");
const vaccinationRoutes = require("./routes/vaccinationRoutes");
const mortalityRoutes = require("./routes/mortalityRoutes");

dotenv.config();
const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  })
);

app.use(express.json());

// MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

// Routes
app.use("/api/workers", require("./routes/workers"));
app.use("/api/production", require("./routes/production"));
app.use("/api/production", require("./routes/productionRoutes"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/feed-invoices",require("./routes/feedInvoiceRoutes"));
app.use("/api/feeds", require("./routes/feedRoutes"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/warehouse", warehouseRoutes);
app.use("/api/vaccinations", vaccinationRoutes);
app.use("/api/mortality", mortalityRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
