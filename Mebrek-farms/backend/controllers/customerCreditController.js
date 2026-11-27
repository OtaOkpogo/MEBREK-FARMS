const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const CustomerCreditAccount = require("../models/CustomerCreditAccount");
const CustomerCreditLedger = require("../models/CustomerCreditLedger");
const { logAudit } = require("../utils/auditLogger");

const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const getActor = (req) => ({
  id: req.user?.id || req.user?._id || null,
  name: req.user?.name || req.user?.fullName || "",
  role: req.user?.role || "",
});

const ensureCustomer = async (customerId, session) => {
  if (!mongoose.isValidObjectId(customerId)) {
    throw new Error("A valid customer ID is required.");
  }

  const customer = await Customer.findOne({
    _id: customerId,
    isDeleted: false,
  }).session(session || null);

  if (!customer) throw new Error("Customer not found.");
  return customer;
};

const ensureAccount = async (customerId, session) =>
  CustomerCreditAccount.findOneAndUpdate(
    { customerId },
    { $setOnInsert: { customerId, balance: 0, revision: 0 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session },
  );

const writeAdjustment = async ({
  customerId,
  amount,
  direction,
  entryType,
  reason,
  refundMethod,
  req,
}) => {
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const customer = await ensureCustomer(customerId, session);
      const account = await ensureAccount(customer._id, session);
      const actor = getActor(req);
      const value = roundMoney(amount);

      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Amount must be greater than zero.");
      }

      let updatedAccount;

      if (direction === "debit") {
        updatedAccount = await CustomerCreditAccount.findOneAndUpdate(
          { _id: account._id, balance: { $gte: value } },
          { $inc: { balance: -value, revision: 1 } },
          { new: true, session },
        );

        if (!updatedAccount) {
          throw new Error("The customer does not have enough available credit.");
        }
      } else {
        updatedAccount = await CustomerCreditAccount.findByIdAndUpdate(
          account._id,
          { $inc: { balance: value, revision: 1 } },
          { new: true, session },
        );
      }

      const [entry] = await CustomerCreditLedger.create(
        [
          {
            customerId: customer._id,
            entryType,
            direction,
            amount: value,
            balanceAfter: updatedAccount.balance,
            description:
              entryType === "refund"
                ? `Customer credit refunded by ${refundMethod}.`
                : "Authorised customer credit adjustment.",
            reason: String(reason || "").trim(),
            refundMethod: refundMethod || undefined,
            createdBy: actor.id,
            createdByName: actor.name,
            createdByRole: actor.role,
          },
        ],
        { session },
      );

      result = {
        customer: {
          _id: customer._id,
          name: customer.name,
          phone: customer.phone,
        },
        account: updatedAccount,
        entry,
      };
    });
  } finally {
    await session.endSession();
  }

  return result;
};

// GET /api/egg-sales/credits/:customerId
exports.getCustomerCredit = async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({ message: "Invalid customer ID." });
    }

    const customer = await Customer.findOne({
      _id: customerId,
      isDeleted: false,
    }).select("name phone email customerType");

    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    const account = await CustomerCreditAccount.findOne({ customerId }).lean();
    const entries = await CustomerCreditLedger.find({ customerId })
      .sort({ createdAt: -1 })
      .populate("saleId", "invoiceNumber date totalAmount")
      .populate("createdBy", "name role")
      .lean();

    return res.json({
      customer,
      availableCredit: Number(account?.balance || 0),
      accountRevision: Number(account?.revision || 0),
      entries,
    });
  } catch (error) {
    console.error("GET CUSTOMER CREDIT ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

// POST /api/egg-sales/credits/refund (superadmin only)
exports.refundCustomerCredit = async (req, res) => {
  try {
    const { customerId, amount, method, reason } = req.body;

    if (!String(reason || "").trim()) {
      return res.status(400).json({ message: "A refund reason is required." });
    }

    if (!["Cash", "Transfer", "POS"].includes(method)) {
      return res.status(400).json({
        message: "Refund method must be Cash, Transfer or POS.",
      });
    }

    const result = await writeAdjustment({
      customerId,
      amount,
      direction: "debit",
      entryType: "refund",
      reason,
      refundMethod: method,
      req,
    });

    await logAudit(req, {
      action: "REFUND",
      module: "Customer Credit",
      description: `Refunded ${amount} customer credit to ${result.customer.name}`,
      entityId: result.customer._id,
      entityName: result.customer.name,
      metadata: {
        customerId,
        amount: roundMoney(amount),
        method,
        reason,
        balanceAfter: result.account.balance,
      },
    });

    return res.json({
      message: "Customer credit refund recorded successfully.",
      ...result,
    });
  } catch (error) {
    console.error("REFUND CUSTOMER CREDIT ERROR:", error);
    return res.status(400).json({ message: error.message });
  }
};

// POST /api/egg-sales/credits/adjust (superadmin only)
exports.adjustCustomerCredit = async (req, res) => {
  try {
    const { customerId, amount, direction, reason } = req.body;

    if (!String(reason || "").trim()) {
      return res.status(400).json({ message: "An adjustment reason is required." });
    }

    if (!["credit", "debit"].includes(direction)) {
      return res.status(400).json({
        message: "Adjustment direction must be credit or debit.",
      });
    }

    const result = await writeAdjustment({
      customerId,
      amount,
      direction,
      entryType: "adjustment",
      reason,
      req,
    });

    await logAudit(req, {
      action: "ADJUST",
      module: "Customer Credit",
      description: `Adjusted customer credit for ${result.customer.name}`,
      entityId: result.customer._id,
      entityName: result.customer.name,
      metadata: {
        customerId,
        amount: roundMoney(amount),
        direction,
        reason,
        balanceAfter: result.account.balance,
      },
    });

    return res.json({
      message: "Customer credit adjustment recorded successfully.",
      ...result,
    });
  } catch (error) {
    console.error("ADJUST CUSTOMER CREDIT ERROR:", error);
    return res.status(400).json({ message: error.message });
  }
};

