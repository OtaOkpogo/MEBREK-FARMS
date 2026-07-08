const Supplier = require("../models/Supplier");

// POST /api/suppliers
exports.createSupplier = async (req, res) => {
  try {
    const { name, phone, email, address, productCategories, contactPerson, notes } =
      req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: "Name and phone are required" });
    }

    const existing = await Supplier.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ message: "A supplier with this name already exists" });
    }

    const supplier = await Supplier.create({
      name,
      phone,
      email,
      address,
      productCategories,
      contactPerson,
      notes,
    });

    res.status(201).json(supplier);
  } catch (error) {
    console.error("CREATE SUPPLIER ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/suppliers
// Optional filters: ?status=active&category=Furniture&search=abc
exports.getSuppliers = async (req, res) => {
  try {
    const { status, category, search } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.productCategories = category;
    if (search) filter.$text = { $search: search };

    const suppliers = await Supplier.find(filter).sort({ name: 1 });

    res.json(suppliers);
  } catch (error) {
    console.error("GET SUPPLIERS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/suppliers/:id
exports.getSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    res.json(supplier);
  } catch (error) {
    console.error("GET SUPPLIER ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/suppliers/:id
exports.updateSupplier = async (req, res) => {
  try {
    const { name, phone, email, address, productCategories, contactPerson, notes, status } =
      req.body;

    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    if (name && name.trim() !== supplier.name) {
      const nameTaken = await Supplier.findOne({
        name: name.trim(),
        _id: { $ne: supplier._id },
      });
      if (nameTaken) {
        return res.status(409).json({ message: "A supplier with this name already exists" });
      }
      supplier.name = name.trim();
    }

    if (phone !== undefined) supplier.phone = phone;
    if (email !== undefined) supplier.email = email;
    if (address !== undefined) supplier.address = address;
    if (productCategories !== undefined) supplier.productCategories = productCategories;
    if (contactPerson !== undefined) supplier.contactPerson = contactPerson;
    if (notes !== undefined) supplier.notes = notes;
    if (status !== undefined) supplier.status = status;

    await supplier.save();

    res.json(supplier);
  } catch (error) {
    console.error("UPDATE SUPPLIER ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/suppliers/:id
// Soft-delete: sets status to "inactive" rather than removing the document,
// so historical purchase orders referencing this supplier stay intact.
// If you genuinely need hard-delete for suppliers with zero order history,
// let me know and I'll add a separate permanentlyDeleteSupplier() that
// checks for PurchaseOrder references first.
exports.deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    supplier.status = "inactive";
    await supplier.save();

    res.json({ message: "Supplier deactivated successfully" });
  } catch (error) {
    console.error("DELETE SUPPLIER ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};
