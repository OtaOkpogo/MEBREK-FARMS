const Admin = require("../models/Admin");
const bcrypt = require("bcryptjs");
const { logAudit } = require("../utils/auditLogger");

// ================= AUDIT SNAPSHOT HELPER =================

const getStaffAuditSnapshot = (staff) => {
  if (!staff) return null;

  return {
    id: staff._id,
    name: staff.name,
    email: staff.email,
    phone: staff.phone,
    role: staff.role,
    status: staff.status,
  };
};

// ================= CREATE STAFF =================

exports.createStaff = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    const existing = await Admin.findOne({ email });

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

    await logAudit(req, {
      action: "CREATE",
      module: "Staff Accounts",
      description: `Created staff account for ${staff.name}`,
      entityId: staff._id,
      entityName: staff.name,
      after: getStaffAuditSnapshot(staff),
      metadata: {
        assignedRole: staff.role,
        accountStatus: staff.status,
      },
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
    const staff = await Admin.find()
      .select("-password")
      .sort({ createdAt: -1 });

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
    const staff = await Admin.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        message: "Staff not found",
      });
    }

    const before = getStaffAuditSnapshot(staff);

    const updateData = {
      name: req.body.name,
      email: req.body.email,
      role: req.body.role,
      phone: req.body.phone,
      status: req.body.status,
    };

    const changedFields = [];

    Object.entries(updateData).forEach(([key, value]) => {
      if (
        value !== undefined &&
        String(staff[key] ?? "") !== String(value ?? "")
      ) {
        changedFields.push(key);
        staff[key] = value;
      }
    });

    // Avoid unnecessary saves and audit records.
    if (changedFields.length === 0) {
      const safeStaff = staff.toObject();
      delete safeStaff.password;

      return res.json(safeStaff);
    }

    await staff.save();

    const after = getStaffAuditSnapshot(staff);

    // Record role changes separately.
    if (changedFields.includes("role")) {
      await logAudit(req, {
        action: "ROLE_CHANGE",
        module: "Staff Accounts",
        description: `Changed ${staff.name}'s role from ${before.role} to ${after.role}`,
        entityId: staff._id,
        entityName: staff.name,
        before,
        after,
        metadata: {
          previousRole: before.role,
          newRole: after.role,
        },
      });
    }

    // Record account status changes separately.
    if (changedFields.includes("status")) {
      await logAudit(req, {
        action: "STATUS_CHANGE",
        module: "Staff Accounts",
        description: `Changed ${staff.name}'s account status from ${before.status} to ${after.status}`,
        entityId: staff._id,
        entityName: staff.name,
        before,
        after,
        metadata: {
          previousStatus: before.status,
          newStatus: after.status,
        },
      });
    }

    // Record ordinary profile changes.
    const profileChanges = changedFields.filter(
      (field) => !["role", "status"].includes(field),
    );

    if (profileChanges.length > 0) {
      await logAudit(req, {
        action: "UPDATE",
        module: "Staff Accounts",
        description: `Updated staff account details for ${staff.name}`,
        entityId: staff._id,
        entityName: staff.name,
        before,
        after,
        metadata: {
          changedFields: profileChanges,
        },
      });
    }

    const safeStaff = staff.toObject();
    delete safeStaff.password;

    res.json(safeStaff);
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

    const before = getStaffAuditSnapshot(staff);

    staff.status = staff.status === "active" ? "inactive" : "active";

    await staff.save();

    const after = getStaffAuditSnapshot(staff);

    await logAudit(req, {
      action: "STATUS_CHANGE",
      module: "Staff Accounts",
      description:
        staff.status === "active"
          ? `Activated ${staff.name}'s account`
          : `Deactivated ${staff.name}'s account`,
      entityId: staff._id,
      entityName: staff.name,
      before,
      after,
      metadata: {
        previousStatus: before.status,
        newStatus: after.status,
        operation: "TOGGLE_STATUS",
      },
    });

    const safeStaff = staff.toObject();
    delete safeStaff.password;

    res.json({
      message:
        staff.status === "active" ? "Account activated" : "Account deactivated",
      staff: safeStaff,
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
    const staff = await Admin.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        message: "Staff not found",
      });
    }

    const before = getStaffAuditSnapshot(staff);

    await Admin.findByIdAndDelete(req.params.id);

    await logAudit(req, {
      action: "DELETE",
      module: "Staff Accounts",
      description: `Deleted staff account belonging to ${staff.name}`,
      entityId: staff._id,
      entityName: staff.name,
      before,
      after: null,
      metadata: {
        deletedRole: staff.role,
        deletedStatus: staff.status,
      },
    });

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
