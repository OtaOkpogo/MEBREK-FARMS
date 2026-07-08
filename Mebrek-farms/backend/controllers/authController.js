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
      role: role || "staff",
      status: "active",
    });

    res.status(201).json({
      message: "Admin registered successfully",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
        lastLogin: admin.lastLogin,
      },
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

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

    if (admin.status !== "active") {
      return res.status(403).json({
        message: "Your account has been disabled",
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // Track last login
    admin.lastLogin = new Date();
    await admin.save();

    const token = jwt.sign(
      {
        id: admin._id,
        name: admin.name,
        role: admin.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      },
    );

    res.json({
      token,
      role: admin.role,
      name: admin.name,
      status: admin.status,
      lastLogin: admin.lastLogin,

      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
        lastLogin: admin.lastLogin,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
};

// ================= CURRENT USER =================

exports.getMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select("-password");

    if (!admin) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json(admin);
  } catch (error) {
    console.error("GET ME ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
};

// ================= GET ALL ADMINS =================

exports.getAdmins = async (req, res) => {
  try {
    const admins = await Admin.find()
      .select("-password")
      .sort({ createdAt: -1 });

    res.json(admins);
  } catch (error) {
    console.error("GET ADMINS ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
};

// ================= UPDATE ROLE =================

exports.updateAdminRole = async (req, res) => {
  try {
    const { role } = req.body;

    const allowedRoles = ["superadmin", "manager", "staff"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid role",
      });
    }

    const admin = await Admin.findByIdAndUpdate(
      req.params.id,
      { role },
      {
        new: true,
        runValidators: true,
      },
    ).select("-password");

    if (!admin) {
      return res.status(404).json({
        message: "Account not found",
      });
    }

    res.json({
      message: "Role updated successfully",
      admin,
    });
  } catch (error) {
    console.error("UPDATE ROLE ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
};

// ================= TOGGLE ACCOUNT STATUS =================

exports.toggleAdminStatus = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return res.status(404).json({
        message: "Account not found",
      });
    }

    admin.status = admin.status === "active" ? "disabled" : "active";

    await admin.save();

    res.json({
      message: `Account ${admin.status}`,
      admin,
    });
  } catch (error) {
    console.error("TOGGLE STATUS ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
};

// ================= RESET PASSWORD =================

exports.resetAdminPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await Admin.findByIdAndUpdate(
      req.params.id,
      {
        password: hashedPassword,
      },
      {
        new: true,
      },
    );

    if (!admin) {
      return res.status(404).json({
        message: "Account not found",
      });
    }

    res.json({
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
};

// ================= DELETE ACCOUNT =================

exports.deleteAdmin = async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        message: "You cannot delete your own account",
      });
    }

    const admin = await Admin.findByIdAndDelete(req.params.id);

    if (!admin) {
      return res.status(404).json({
        message: "Account not found",
      });
    }

    res.json({
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("DELETE ADMIN ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
};
