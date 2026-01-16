const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "Workers route working" });
});

module.exports = router;
