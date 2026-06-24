const Admin = require("../models/Admin");
const bcrypt = require("bcryptjs");

// CREATE STAFF
exports.createStaff = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
    } = req.body;

    const existing = await Admin.findOne({
      email,
    });

    if (existing) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const staff = await Admin.create({
      name,
      email,
      password: hashedPassword,
      role: role || "staff",
    });

    res.status(201).json(staff);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// GET STAFF
exports.getStaff = async (req, res) => {
  try {
    const staff = await Admin.find()
      .select("-password")
      .sort({
        createdAt: -1,
      });

    res.json(staff);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// UPDATE STAFF
exports.updateStaff = async (req, res) => {
  try {
    const staff =
      await Admin.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
        }
      ).select("-password");

    res.json(staff);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// DELETE STAFF
exports.deleteStaff = async (req, res) => {
  try {
    await Admin.findByIdAndDelete(
      req.params.id
    );

    res.json({
      message:
        "Staff deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};
