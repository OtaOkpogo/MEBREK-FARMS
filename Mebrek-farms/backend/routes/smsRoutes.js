const express = require("express");
const router = express.Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  getSMSStatus,
  getSMSCustomers,
  updateSMSConsent,
  sendCampaign,
  getCampaigns,
} = require("../controllers/smsController");

router.use(protect, allowRoles("superadmin", "manager"));

router.get("/status", getSMSStatus);
router.get("/customers", getSMSCustomers);
router.patch("/customers/:id/consent", updateSMSConsent);
router.get("/campaigns", getCampaigns);
router.post("/campaigns", sendCampaign);

module.exports = router;
