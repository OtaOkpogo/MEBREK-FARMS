const CustomerCreditAccount = require("../models/CustomerCreditAccount");
const CustomerCreditLedger = require("../models/CustomerCreditLedger");

const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const validateCreditAmount = (value) => {
  const amount = roundMoney(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Credit amount must be greater than zero.");
  }

  return amount;
};

const getOrCreateCreditAccount = async (customerId, session) => {
  if (!customerId) {
    throw new Error("A registered customer is required for customer credit.");
  }

  return CustomerCreditAccount.findOneAndUpdate(
    { customerId },
    {
      $setOnInsert: {
        customerId,
        balance: 0,
        revision: 0,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      session,
    },
  );
};

const addCustomerCredit = async ({
  customerId,
  amount,
  sale,
  user,
  session,
  description,
  reason,
  referenceKey,
}) => {
  const creditAmount = validateCreditAmount(amount);
  const account = await getOrCreateCreditAccount(customerId, session);

  account.balance = roundMoney(account.balance + creditAmount);
  account.revision += 1;

  await account.save({ session });

  const [entry] = await CustomerCreditLedger.create(
    [
      {
        customerId,
        entryType: "credit_created",
        direction: "credit",
        amount: creditAmount,
        balanceAfter: account.balance,
        saleId: sale?._id || null,
        invoiceNumber: sale?.invoiceNumber || "",
        referenceKey,
        description:
          description || "Customer credit created from an overpayment.",
        reason: reason || "",
        createdBy: user?.id || user?._id || null,
        createdByName: user?.name || "",
        createdByRole: user?.role || "",
      },
    ],
    { session },
  );

  return { account, entry };
};

const applyCustomerCredit = async ({
  customerId,
  amount,
  sale,
  user,
  session,
  description,
  referenceKey,
}) => {
  const creditAmount = validateCreditAmount(amount);
  const account = await getOrCreateCreditAccount(customerId, session);

  // The balance condition prevents applying more credit than is available.
  const updatedAccount = await CustomerCreditAccount.findOneAndUpdate(
    {
      _id: account._id,
      balance: { $gte: creditAmount },
    },
    {
      $inc: {
        balance: -creditAmount,
        revision: 1,
      },
    },
    {
      new: true,
      session,
    },
  );

  if (!updatedAccount) {
    throw new Error(
      "The customer's available credit is insufficient for this application.",
    );
  }

  const [entry] = await CustomerCreditLedger.create(
    [
      {
        customerId,
        entryType: "credit_applied",
        direction: "debit",
        amount: creditAmount,
        balanceAfter: updatedAccount.balance,
        saleId: sale?._id || null,
        invoiceNumber: sale?.invoiceNumber || "",
        referenceKey,
        description:
          description || "Customer credit applied to an egg sale.",
        createdBy: user?.id || user?._id || null,
        createdByName: user?.name || "",
        createdByRole: user?.role || "",
      },
    ],
    { session },
  );

  return { account: updatedAccount, entry };
};

module.exports = {
  roundMoney,
  validateCreditAmount,
  getOrCreateCreditAccount,
  addCustomerCredit,
  applyCustomerCredit,
};
