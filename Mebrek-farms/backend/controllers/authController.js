const Admin = require("../models/Admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ================= REGISTER ADMIN =================

exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existingAdmin = await Admin.findOne({ email });

    if (existingAdmin) {
      return res.status(400).json({
        message: "Admin already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      name,
      email,
      password: hashedPassword,

      // default role
      role: role || "staff",
    });

    res.status(201).json({
      message: "Admin registered successfully",

      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

// ================= LOGIN ADMIN =================

exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // CREATE JWT TOKEN

    const token = jwt.sign(
      {
        id: admin._id,
        role: admin.role,
      },

      process.env.JWT_SECRET,

      {
        expiresIn: "1d",
      },
    );

    // RETURN LOGIN RESPONSE

    res.json({
      token,

      role: admin.role,

      name: admin.name,

      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};
