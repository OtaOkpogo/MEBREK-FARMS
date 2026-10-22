const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const SMSCampaign = require("../models/SMSCampaign");
const {
  isTermiiConfigured,
  sendTermiiSMS,
} = require("../services/termiiService");

function normalizePhone(value) {
  let phone = String(value || "")
    .trim()
    .replace(/[^\d+]/g, "");

  if (phone.startsWith("+")) phone = phone.slice(1);

  if (/^0\d{10}$/.test(phone)) {
    phone = `234${phone.slice(1)}`;
  }

  if (!/^234\d{10}$/.test(phone)) {
    return null;
  }

  return phone;
}

function getAdmin(req) {
  return req.admin || req.user || {};
}

function getActor(req) {
  const admin = getAdmin(req);

  return {
    id: admin._id || admin.id || null,
    name: String(admin.name || admin.adminName || ""),
    role: String(admin.role || ""),
  };
}

exports.getSMSStatus = async (req, res) => {
  try {
    const apiKeyConfigured = Boolean(process.env.TERMII_API_KEY?.trim());

    const senderIdConfigured = Boolean(process.env.TERMII_SENDER_ID?.trim());

    const senderIdApproved = process.env.TERMII_SENDER_ID_APPROVED === "true";

    const configured =
      apiKeyConfigured && senderIdConfigured && senderIdApproved;

    let message = "Termii is not ready to send messages.";

    if (!apiKeyConfigured) {
      message = "Add your Termii API key to backend/.env.";
    } else if (!senderIdConfigured) {
      message = "Add your Termii sender ID to backend/.env.";
    } else if (!senderIdApproved) {
      message =
        "Your sender ID is not marked as approved. SMS delivery remains disabled.";
    } else {
      message =
        "Termii credentials and sender approval are configured. Actual delivery still depends on your account and provider response.";
    }

    return res.json({
      configured,
      apiKeyConfigured,
      senderIdConfigured,
      senderIdApproved,
      message,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
exports.getSMSCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({
      isDeleted: false,
      isActive: true,
    })
      .select("name phone customerType smsMarketingConsent")
      .sort({ name: 1 })
      .lean();

    const results = customers.map((customer) => ({
      _id: customer._id,
      name: customer.name,
      phone: customer.phone,
      customerType: customer.customerType,
      smsMarketingConsent: Boolean(customer.smsMarketingConsent),
      normalizedPhone: normalizePhone(customer.phone),
    }));

    return res.json({
      customers: results,
      total: results.length,
      eligible: results.filter(
        (customer) => customer.smsMarketingConsent && customer.normalizedPhone,
      ).length,
    });
  } catch (error) {
    console.error("GET SMS CUSTOMERS ERROR:", error);
    return res.status(500).json({ message: "Failed to load SMS customers." });
  }
};

exports.updateSMSConsent = async (req, res) => {
  try {
    const { id } = req.params;
    const { consent } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid customer ID." });
    }

    if (typeof consent !== "boolean") {
      return res.status(400).json({
        message: "Consent must be true or false.",
      });
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { smsMarketingConsent: consent } },
      { new: true, runValidators: true },
    ).select("name phone smsMarketingConsent");

    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    return res.json({
      message: consent
        ? "Promotional SMS consent enabled."
        : "Promotional SMS consent withdrawn.",
      customer,
    });
  } catch (error) {
    console.error("UPDATE SMS CONSENT ERROR:", error);
    return res.status(500).json({
      message: "Failed to update customer consent.",
    });
  }
};

exports.sendCampaign = async (req, res) => {
  try {
    if (!isTermiiConfigured()) {
      return res.status(503).json({
        message:
          "SMS sending is disabled. Configure Termii API credentials and an approved sender ID first.",
      });
    }

    const title = String(req.body?.title || "").trim();
    const message = String(req.body?.message || "").trim();
    const customerIds = Array.isArray(req.body?.customerIds)
      ? [...new Set(req.body.customerIds.map(String))]
      : [];

    if (!title || title.length > 120) {
      return res.status(400).json({
        message:
          "Campaign title is required and must not exceed 120 characters.",
      });
    }

    if (!message || message.length > 1000) {
      return res.status(400).json({
        message: "Message is required and must not exceed 1000 characters.",
      });
    }

    if (!customerIds.length) {
      return res.status(400).json({
        message: "Select at least one eligible customer.",
      });
    }

    // Bound the work done by one HTTP request.
    if (customerIds.length > 100) {
      return res.status(400).json({
        message:
          "A campaign is limited to 100 customers. Split the audience into smaller campaigns.",
      });
    }

    if (customerIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({
        message: "One or more customer IDs are invalid.",
      });
    }

    const customers = await Customer.find({
      _id: { $in: customerIds },
      isDeleted: false,
      isActive: true,
      smsMarketingConsent: true,
    }).select("_id name phone");

    if (customers.length !== customerIds.length) {
      return res.status(400).json({
        message:
          "Some selected customers are inactive, missing, or have not opted in to promotional SMS. Refresh the audience and try again.",
      });
    }

    const recipients = [];
    const seenPhones = new Set();

    for (const customer of customers) {
      const phone = normalizePhone(customer.phone);

      if (!phone) continue;
      if (seenPhones.has(phone)) continue;

      seenPhones.add(phone);

      recipients.push({
        customerId: customer._id,
        name: customer.name,
        phone,
        status: "pending",
      });
    }

    if (!recipients.length) {
      return res.status(400).json({
        message: "No selected customers have valid Nigerian phone numbers.",
      });
    }

    const campaign = await SMSCampaign.create({
      title,
      message,
      type: "marketing",
      status: "processing",
      recipients,
      totalRecipients: recipients.length,
      createdBy: getActor(req),
    });

    let sentCount = 0;
    let failedCount = 0;

    // Sequential sends limit the pressure on the provider and preserve
    // an individual outcome for each recipient.
    for (let i = 0; i < campaign.recipients.length; i += 1) {
      const recipient = campaign.recipients[i];

      recipient.attemptedAt = new Date();

      try {
        const result = await sendTermiiSMS({
          to: recipient.phone,
          message,
        });

        recipient.status = "sent";
        recipient.providerMessageId = String(result.message_id || "");
        recipient.error = "";
        sentCount += 1;
      } catch (error) {
        recipient.status = "failed";
        recipient.error = String(error.message || "SMS send failed").slice(
          0,
          500,
        );
        failedCount += 1;

        console.error(
          "SMS RECIPIENT FAILED:",
          recipient.phone,
          recipient.error,
        );
      }

      campaign.sentCount = sentCount;
      campaign.failedCount = failedCount;

      // Persist progress, so the operator can see outcomes if later
      // recipients fail.
      await campaign.save();
    }

    campaign.status =
      sentCount === 0 ? "failed" : failedCount > 0 ? "partial" : "completed";

    campaign.completedAt = new Date();
    await campaign.save();

    return res.status(201).json({
      message: "Campaign processing finished.",
      campaign,
    });
  } catch (error) {
    console.error("SEND SMS CAMPAIGN ERROR:", error);
    return res.status(500).json({
      message: "Failed to process SMS campaign.",
    });
  }
};

exports.getCampaigns = async (req, res) => {
  try {
    const campaigns = await SMSCampaign.find()
      .select("-recipients.phone")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json(campaigns);
  } catch (error) {
    console.error("GET SMS CAMPAIGNS ERROR:", error);
    return res.status(500).json({
      message: "Failed to load SMS campaign history.",
    });
  }
};
