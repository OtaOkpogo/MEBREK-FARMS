const Customer = require("../models/Customer");

// ============================================================
// CREATE CUSTOMER
// ============================================================

exports.createCustomer = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      address,
      customerType,
      notes,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Customer name is required",
      });
    }

    // Prevent obvious duplicate customers by phone
    if (phone && phone.trim()) {
      const existingCustomer = await Customer.findOne({
        phone: phone.trim(),
        isDeleted: false,
      });

      if (existingCustomer) {
        return res.status(409).json({
          message: "A customer with this phone number already exists",
          customer: existingCustomer,
        });
      }
    }

    const customer = await Customer.create({
      name: name.trim(),
      phone: phone?.trim() || "",
      email: email?.trim() || "",
      address: address?.trim() || "",
      customerType: customerType || "Individual",
      notes: notes?.trim() || "",

      createdBy: {
        id: req.admin?._id || null,
        name: req.admin?.name || "",
      },

      updatedBy: {
        id: req.admin?._id || null,
        name: req.admin?.name || "",
      },
    });

    res.status(201).json({
      message: "Customer created successfully",
      customer,
    });
  } catch (error) {
    console.error("CREATE CUSTOMER ERROR:", error);

    res.status(500).json({
      message: "Failed to create customer",
      error: error.message,
    });
  }
};

// ============================================================
// GET CUSTOMERS
// ============================================================

exports.getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({
      isDeleted: false,
    }).sort({
      name: 1,
    });

    res.json(customers);
  } catch (error) {
    console.error("GET CUSTOMERS ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch customers",
      error: error.message,
    });
  }
};

// ============================================================
// GET SINGLE CUSTOMER
// ============================================================

exports.getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    res.json(customer);
  } catch (error) {
    console.error("GET CUSTOMER ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch customer",
      error: error.message,
    });
  }
};

// ============================================================
// SEARCH CUSTOMERS
// ============================================================

exports.searchCustomers = async (req, res) => {
  try {
    const search = (req.query.search || "").trim();

    if (!search) {
      const customers = await Customer.find({
        isDeleted: false,
        isActive: true,
      }).sort({ name: 1 });

      return res.json(customers);
    }

    const customers = await Customer.find({
      isDeleted: false,
      isActive: true,
      $or: [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    })
      .sort({ name: 1 })
      .limit(20);

    res.json(customers);
  } catch (error) {
    console.error("SEARCH CUSTOMERS ERROR:", error);

    res.status(500).json({
      message: "Failed to search customers",
      error: error.message,
    });
  }
};

// ============================================================
// UPDATE CUSTOMER
// ============================================================

exports.updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const {
      name,
      phone,
      email,
      address,
      customerType,
      notes,
      isActive,
    } = req.body;

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          message: "Customer name is required",
        });
      }

      customer.name = name.trim();
    }

    if (phone !== undefined) {
      const trimmedPhone = phone.trim();

      if (trimmedPhone) {
        const duplicate = await Customer.findOne({
          phone: trimmedPhone,
          _id: { $ne: customer._id },
          isDeleted: false,
        });

        if (duplicate) {
          return res.status(409).json({
            message: "Another customer already uses this phone number",
          });
        }
      }

      customer.phone = trimmedPhone;
    }

    if (email !== undefined) {
      customer.email = email.trim();
    }

    if (address !== undefined) {
      customer.address = address.trim();
    }

    if (customerType !== undefined) {
      customer.customerType = customerType;
    }

    if (notes !== undefined) {
      customer.notes = notes.trim();
    }

    if (isActive !== undefined) {
      customer.isActive = Boolean(isActive);
    }

    customer.updatedBy = {
      id: req.admin?._id || null,
      name: req.admin?.name || "",
    };

    await customer.save();

    res.json({
      message: "Customer updated successfully",
      customer,
    });
  } catch (error) {
    console.error("UPDATE CUSTOMER ERROR:", error);

    res.status(500).json({
      message: "Failed to update customer",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE CUSTOMER — SOFT DELETE
// ============================================================

exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    customer.isDeleted = true;
    customer.isActive = false;
    customer.deletedAt = new Date();

    customer.deletedBy = {
      id: req.admin?._id || null,
      name: req.admin?.name || "",
      role: req.admin?.role || "",
    };

    await customer.save();

    res.json({
      message: "Customer deleted successfully",
    });
  } catch (error) {
    console.error("DELETE CUSTOMER ERROR:", error);

    res.status(500).json({
      message: "Failed to delete customer",
      error: error.message,
    });
  }
};
