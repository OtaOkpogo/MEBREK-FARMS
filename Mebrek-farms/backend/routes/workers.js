const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");

const {
  createWorker,
  getWorkers,
  updateWorker,
  deleteWorker
} = require("../controllers/workerController");

router.post("/", auth, createWorker);
router.get("/", auth, getWorkers);
router.put("/:id", auth, updateWorker);
router.delete("/:id", auth, deleteWorker);

module.exports = router;
