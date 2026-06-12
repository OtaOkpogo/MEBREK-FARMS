const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const {
  createProduction,
  getProductions,
  deleteProduction,
} = require("../controllers/productionController");

router.get("/", auth, getProductions);

router.post("/", auth, createProduction);

router.delete("/:id", auth, deleteProduction);

module.exports = router;
