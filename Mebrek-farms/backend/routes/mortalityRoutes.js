const express = require("express");

const router = express.Router();

const auth = require(
  "../middleware/authMiddleware"
);

const {
  getMortality,
  createMortality,
  updateMortality,
  deleteMortality,
} = require(
  "../controllers/mortalityController"
);


router.get(
  "/",
  auth,
  getMortality
);

router.post(
  "/",
  auth,
  createMortality
);

router.put(
  "/:id",
  auth,
  updateMortality
);

router.delete(
  "/:id",
  auth,
  deleteMortality
);

module.exports = router;
