const Admin = require("../models/Admin");
const bcrypt = require("bcryptjs");

// ================= CREATE STAFF =================

exports.createStaff = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    const existing = await Admin.findOne({
      email,
    });

    if (existing) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const staff = await Admin.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: role || "staff",
      status: "active",
    });

    res.status(201).json({
      message: "Staff account created successfully",
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        status: staff.status,
        phone: staff.phone,
      },
    });
  } catch (err) {
    console.error("CREATE STAFF ERROR:", err);

    res.status(500).json({
      message: err.message,
    });
  }
};

// ================= GET STAFF =================

exports.getStaff = async (req, res) => {
  try {
    const staff = await Admin.find().select("-password").sort({
      createdAt: -1,
    });

    res.json(staff);
  } catch (err) {
    console.error("GET STAFF ERROR:", err);

    res.status(500).json({
      message: err.message,
    });
  }
};

// ================= UPDATE STAFF =================

exports.updateStaff = async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      email: req.body.email,
      role: req.body.role,
      phone: req.body.phone,
      status: req.body.status,
    };

    const staff = await Admin.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!staff) {
      return res.status(404).json({
        message: "Staff not found",
      });
    }

    res.json(staff);
  } catch (err) {
    console.error("UPDATE STAFF ERROR:", err);

    res.status(500).json({
      message: err.message,
    });
  }
};

// ================= TOGGLE STATUS =================

exports.toggleStatus = async (req, res) => {
  try {
    const staff = await Admin.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        message: "Staff not found",
      });
    }

    staff.status = staff.status === "active" ? "inactive" : "active";

    await staff.save();

    res.json({
      message:
        staff.status === "active" ? "Account activated" : "Account deactivated",
      staff,
    });
  } catch (err) {
    console.error("TOGGLE STATUS ERROR:", err);

    res.status(500).json({
      message: err.message,
    });
  }
};

// ================= DELETE STAFF =================

exports.deleteStaff = async (req, res) => {
  try {
    const staff = await Admin.findByIdAndDelete(req.params.id);

    if (!staff) {
      return res.status(404).json({
        message: "Staff not found",
      });
    }

    res.json({
      message: "Staff deleted successfully",
    });
  } catch (err) {
    console.error("DELETE STAFF ERROR:", err);

    res.status(500).json({
      message: err.message,
    });
  }
};
