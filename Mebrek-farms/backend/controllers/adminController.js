const Admin = require("../models/Admin");

const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");


// REGISTER ADMIN

exports.registerAdmin = async (
  req,
  res
) => {

  try {

    const {
      name,
      email,
      password,
      role,
    } = req.body;

    const existingAdmin =
      await Admin.findOne({ email });

    if (existingAdmin) {

      return res.status(400).json({
        message:
          "Admin already exists",
      });
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const admin =
      await Admin.create({
        name,
        email,
        password: hashedPassword,
        role:
          role || "staff",
      });

    res.status(201).json({
      message:
        "Admin created successfully",
      admin,
    });

  } catch (err) {

    res.status(500).json({
      message: err.message,
    });

  }
};


// LOGIN ADMIN

exports.loginAdmin = async (
  req,
  res
) => {

  try {

    const {
      email,
      password,
    } = req.body;

    const admin =
      await Admin.findOne({
        email,
      });

    if (!admin) {

      return res.status(400).json({
        message:
          "Invalid credentials",
      });
    }

    const isMatch =
      await bcrypt.compare(
        password,
        admin.password
      );

    if (!isMatch) {

      return res.status(400).json({
        message:
          "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        id: admin._id,
        role: admin.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      token,
      role: admin.role,
      name: admin.name,
    });

  } catch (err) {

    res.status(500).json({
      message: err.message,
    });

  }
};
