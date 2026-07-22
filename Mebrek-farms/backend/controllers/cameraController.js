const Camera = require("../models/Camera");

// =========================================
// SUPERADMIN CHECK
// =========================================

const requireSuperadmin = (req, res) => {
  if (req.user?.role !== "superadmin") {
    res.status(403).json({
      error: "Access denied. Superadmin privileges required.",
    });

    return false;
  }

  return true;
};

// =========================================
// GET ALL CAMERAS
// =========================================

exports.getCameras = async (req, res) => {
  try {
    if (!requireSuperadmin(req, res)) return;

    const cameras = await Camera.find({
      isDeleted: false,
    }).sort({
      createdAt: -1,
    });

    res.json(cameras);
  } catch (err) {
    console.error("GET CAMERAS ERROR:", err);

    res.status(500).json({
      error: "Failed to load cameras",
    });
  }
};

// =========================================
// CREATE CAMERA
// =========================================

exports.createCamera = async (req, res) => {
  try {
    if (!requireSuperadmin(req, res)) return;

    const {
      name,
      pen,
      channel,
      location,
      description,
      nvrIp,
      rtspPort,
      nvrUsername,
      nvrPassword,
    } = req.body;

    if (!name || !pen || !channel) {
      return res.status(400).json({
        error: "Camera name, pen, and channel are required.",
      });
    }

    const camera = await Camera.create({
      name,
      pen,
      channel,
      location,
      description,
      nvrIp,
      rtspPort,
      nvrUsername,
      nvrPassword,

      createdBy: req.user.id,
      createdByName: req.user.name,
    });

    const io = req.app.get("io");

    if (io) {
      io.emit("cameraCreated", camera);
    }

    res.status(201).json(camera);
  } catch (err) {
    console.error("CREATE CAMERA ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// =========================================
// UPDATE CAMERA
// =========================================

exports.updateCamera = async (req, res) => {
  try {
    if (!requireSuperadmin(req, res)) return;

    const camera = await Camera.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!camera) {
      return res.status(404).json({
        error: "Camera not found.",
      });
    }

    const allowedFields = [
      "name",
      "pen",
      "channel",
      "location",
      "description",
      "nvrIp",
      "rtspPort",
      "nvrUsername",
      "nvrPassword",
      "streamUrl",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        camera[field] = req.body[field];
      }
    });

    await camera.save();

    const io = req.app.get("io");

    if (io) {
      io.emit("cameraUpdated", camera);
    }

    res.json(camera);
  } catch (err) {
    console.error("UPDATE CAMERA ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// =========================================
// DISABLE CAMERA
// =========================================

exports.disableCamera = async (req, res) => {
  try {
    if (!requireSuperadmin(req, res)) return;

    const camera = await Camera.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!camera) {
      return res.status(404).json({
        error: "Camera not found.",
      });
    }

    camera.isEnabled = false;

    await camera.save();

    const io = req.app.get("io");

    if (io) {
      io.emit("cameraDisabled", camera);
    }

    res.json({
      message: "Camera disabled successfully.",
      camera,
    });
  } catch (err) {
    console.error("DISABLE CAMERA ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// =========================================
// ENABLE CAMERA
// =========================================

exports.enableCamera = async (req, res) => {
  try {
    if (!requireSuperadmin(req, res)) return;

    const camera = await Camera.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!camera) {
      return res.status(404).json({
        error: "Camera not found.",
      });
    }

    camera.isEnabled = true;

    await camera.save();

    const io = req.app.get("io");

    if (io) {
      io.emit("cameraEnabled", camera);
    }

    res.json({
      message: "Camera enabled successfully.",
      camera,
    });
  } catch (err) {
    console.error("ENABLE CAMERA ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// =========================================
// DELETE CAMERA
// SOFT DELETE
// =========================================

exports.deleteCamera = async (req, res) => {
  try {
    if (!requireSuperadmin(req, res)) return;

    const camera = await Camera.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!camera) {
      return res.status(404).json({
        error: "Camera not found.",
      });
    }

    camera.isDeleted = true;
    camera.deletedAt = new Date();
    camera.deletedBy = req.user.id;
    camera.deletedByName = req.user.name;
    camera.deletedByRole = req.user.role;

    await camera.save({
      validateModifiedOnly: true,
    });

    const io = req.app.get("io");

    if (io) {
      io.emit("cameraDeleted", camera);
    }

    res.json({
      message: "Camera deleted successfully.",
    });
  } catch (err) {
    console.error("DELETE CAMERA ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
};
