const Admin = require("../models/Admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ================= REGISTER ADMIN =================

exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    ```
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
```;
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    ```
res.status(500).json({
  error: error.message,
});
```;
  }
};

// ================= LOGIN ADMIN / STAFF =================

exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });

    // USER NOT FOUND
    if (!admin) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // ACCOUNT DISABLED
    if (admin.status !== "active") {
      return res.status(403).json({
        message: "Your account has been disabled",
      });
    }

    // PASSWORD CHECK
    const isMatch = await bcrypt.compare(password, admin.password);
    admin.lastLogin = new Date();

    await admin.save();

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // TRACK LAST LOGIN
    admin.lastLogin = new Date();
    await admin.save();

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

    // SUCCESS RESPONSE
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
