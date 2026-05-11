const express = require("express");

const router = express.Router();

const auth = require(
  "../middleware/authMiddleware"
);

const {
  getVaccinations,
  createVaccination,
  updateVaccination,
  deleteVaccination,
} = require(
  "../controllers/vaccinationController"
);


router.get(
  "/",
  auth,
  getVaccinations
);

router.post(
  "/",
  auth,
  createVaccination
);

router.put(
  "/:id",
  auth,
  updateVaccination
);

router.delete(
  "/:id",
  auth,
  deleteVaccination
);

module.exports = router;
