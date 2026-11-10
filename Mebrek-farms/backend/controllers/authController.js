const Admin = require("../models/Admin");
const Worker = require("../models/Worker");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const LoginActivity = require("../models/LoginActivity");

// ================= LOGIN AUDIT HELPER =================

const recordLoginActivity = async (req, details) => {
  try {
    await LoginActivity.create({
      ...details,
      ipAddress: req.ip || req.socket?.remoteAddress || "Unknown",
      userAgent: req.get("user-agent") || "Unknown",
    });
  } catch (error) {
    console.error("LOGIN ACTIVITY LOG ERROR:", error);
  }
};

// ================= WORKER LINK HELPER =================

const validateWorkerLink = async (workerId, currentAdminId = null) => {
  if (!workerId) {
    return {
      valid: true,
      workerId: null,
    };
  }

  if (!mongoose.Types.ObjectId.isValid(workerId)) {
    return {
      valid: false,
      message: "Invalid worker selection",
    };
  }

  const worker = await Worker.findById(workerId);

  if (!worker) {
    return {
      valid: false,
      message: "Selected worker does not exist",
    };
  }

  if (worker.status !== "Active") {
    return {
      valid: false,
      message: "Only active workers can be linked to accounts",
    };
  }

  const existingLink = await Admin.findOne({
    workerId,
    ...(currentAdminId ? { _id: { $ne: currentAdminId } } : {}),
  });

  if (existingLink) {
    return {
      valid: false,
      message: "This worker is already linked to another account",
    };
  }

  return {
    valid: true,
    workerId: worker._id,
  };
};

// ================= REGISTER ADMIN =================

exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, role, workerId } = req.body;

    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const allowedRoles = ["superadmin", "manager", "staff"];
    const selectedRole = role || "staff";

    if (!allowedRoles.includes(selectedRole)) {
      return res.status(400).json({
        message: "Invalid account role",
      });
    }

    const existingAdmin = await Admin.findOne({
      email: normalizedEmail,
    });

    if (existingAdmin) {
      return res.status(400).json({
        message: "Admin already exists",
      });
    }

    let linkedWorkerId = null;

    if (selectedRole === "superadmin") {
      if (workerId) {
        return res.status(400).json({
          message: "Superadmin accounts cannot be linked to worker profiles",
        });
      }
    } else if (workerId) {
      const validation = await validateWorkerLink(workerId);

      if (!validation.valid) {
        return res.status(400).json({
          message: validation.message,
        });
      }

      linkedWorkerId = validation.workerId;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: selectedRole,
      status: "active",
      workerId: linkedWorkerId,
    });

    res.status(201).json({
      message: "Admin registered successfully",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
        workerId: admin.workerId,
        lastLogin: admin.lastLogin,
      },
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        message: "This email or worker profile is already linked to an account",
      });
    }

    res.status(500).json({
      error: error.message,
    });
  }
};

// ================= LOGIN ADMIN =================

exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const admin = await Admin.findOne({
      email: normalizedEmail,
    });

    if (!admin) {
      await recordLoginActivity(req, {
        name: "Unknown User",
        email: normalizedEmail,
        role: "unknown",
        status: "failed",
        failureReason: "Invalid credentials",
      });

      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    if (admin.status !== "active") {
      await recordLoginActivity(req, {
        adminId: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: "blocked",
        failureReason: "Account disabled",
      });

      return res.status(403).json({
        message: "Your account has been disabled",
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      await recordLoginActivity(req, {
        adminId: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: "failed",
        failureReason: "Invalid credentials",
      });

      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    admin.lastLogin = new Date();
    await admin.save();

    await recordLoginActivity(req, {
      adminId: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      status: "success",
      failureReason: null,
    });

    const token = jwt.sign(
      {
        id: admin._id,
        name: admin.name,
        role: admin.role,
        workerId: admin.workerId || null,
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
        workerId: admin.workerId || null,
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
    const admin = await Admin.findById(req.user.id)
      .select("-password")
      .populate("workerId", "firstName lastName employeeId status");

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
      .populate("workerId", "firstName lastName employeeId status")
      .sort({ createdAt: -1 });

    res.json(admins);
  } catch (error) {
    console.error("GET ADMINS ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
};

// ================= UPDATE ADMIN DETAILS =================

exports.updateAdmin = async (req, res) => {
  try {
    const { name, email, workerId } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        message: "Name and email are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingAdmin = await Admin.findOne({
      email: normalizedEmail,
      _id: { $ne: req.params.id },
    });

    if (existingAdmin) {
      return res.status(400).json({
        message: "Email is already in use",
      });
    }

    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return res.status(404).json({
        message: "Account not found",
      });
    }

    admin.name = name.trim();
    admin.email = normalizedEmail;

    // Only change the worker link when workerId is supplied.
    if (Object.prototype.hasOwnProperty.call(req.body, "workerId")) {
      if (admin.role === "superadmin" && workerId) {
        return res.status(400).json({
          message: "Superadmin accounts cannot be linked to worker profiles",
        });
      }

      if (workerId) {
        const validation = await validateWorkerLink(workerId, admin._id);

        if (!validation.valid) {
          return res.status(400).json({
            message: validation.message,
          });
        }

        admin.workerId = validation.workerId;
      } else {
        admin.workerId = null;
      }
    }

    await admin.save();

    const updatedAdmin = await Admin.findById(admin._id)
      .select("-password")
      .populate("workerId", "firstName lastName employeeId status");

    res.json({
      message: "Account updated successfully",
      admin: updatedAdmin,
    });
  } catch (error) {
    console.error("UPDATE ADMIN ERROR:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        message: "This worker is already linked to another account",
      });
    }

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

    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return res.status(404).json({
        message: "Account not found",
      });
    }

    admin.role = role;

    // Superadmin accounts must not retain worker links.
    if (role === "superadmin") {
      admin.workerId = null;
    }

    await admin.save();

    const updatedAdmin = await Admin.findById(admin._id)
      .select("-password")
      .populate("workerId", "firstName lastName employeeId status");

    res.json({
      message: "Role updated successfully",
      admin: updatedAdmin,
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
    if (String(req.user.id) === String(req.params.id)) {
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
