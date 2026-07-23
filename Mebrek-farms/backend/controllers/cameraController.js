const Camera = require("../models/Camera");

// =========================================
// SAFE CAMERA RESPONSE
// =========================================
// IMPORTANT:
// Never send NVR credentials or stream information
// to the frontend.
//
// Frontend receives only safe camera management data.
// Backend keeps:
// - nvrUsername
// - nvrPassword
// - nvrIp
// - rtspPort
// - streamUrl
// =========================================

const sanitizeCamera = (camera) => {
  const obj = camera.toObject ? camera.toObject() : camera;

  return {
    _id: obj._id,
    name: obj.name,
    pen: obj.pen,
    channel: obj.channel,
    location: obj.location,
    description: obj.description,

    isEnabled: obj.isEnabled,
    isDeleted: obj.isDeleted,

    deletedAt: obj.deletedAt,
    deletedBy: obj.deletedBy,
    deletedByName: obj.deletedByName,
    deletedByRole: obj.deletedByRole,

    createdBy: obj.createdBy,
    createdByName: obj.createdByName,

    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

// =========================================
// GET ALL CAMERAS
// =========================================

exports.getCameras = async (req, res) => {
  try {
    const cameras = await Camera.find({
      isDeleted: false,
    }).sort({
      createdAt: -1,
    });

    const safeCameras = cameras.map(sanitizeCamera);

    res.json(safeCameras);
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
    const {
      name,
      pen,
      channel,
      location,
      description,

      // These are accepted by backend
      // but NEVER returned to frontend.
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

      // Secure backend-only fields
      nvrIp,
      rtspPort,
      nvrUsername,
      nvrPassword,

      createdBy: req.user.id,
      createdByName: req.user.name,
    });

    // Create safe version for frontend
    const safeCamera = sanitizeCamera(camera);

    const io = req.app.get("io");

    if (io) {
      io.emit("cameraCreated", safeCamera);
    }

    res.status(201).json(safeCamera);
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

      // Backend-only fields
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

    // IMPORTANT:
    // Sanitize before sending anywhere.
    const safeCamera = sanitizeCamera(camera);

    const io = req.app.get("io");

    if (io) {
      io.emit("cameraUpdated", safeCamera);
    }

    res.json(safeCamera);
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

    // Safe response
    const safeCamera = sanitizeCamera(camera);

    const io = req.app.get("io");

    if (io) {
      io.emit("cameraDisabled", safeCamera);
    }

    res.json({
      message: "Camera disabled successfully.",
      camera: safeCamera,
    });
  } catch (err) {
    console.error("DISABLE CAMERA ERROR:", err);

    res.status(500).json({
      error: "Failed to disable camera.",
    });
  }
};

// =========================================
// ENABLE CAMERA
// =========================================

exports.enableCamera = async (req, res) => {
  try {
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

    // Safe response
    const safeCamera = sanitizeCamera(camera);

    const io = req.app.get("io");

    if (io) {
      io.emit("cameraEnabled", safeCamera);
    }

    res.json({
      message: "Camera enabled successfully.",
      camera: safeCamera,
    });
  } catch (err) {
    console.error("ENABLE CAMERA ERROR:", err);

    res.status(500).json({
      error: "Failed to enable camera.",
    });
  }
};

// =========================================
// DELETE CAMERA
// SOFT DELETE
// =========================================

exports.deleteCamera = async (req, res) => {
  try {
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

    // Safe response for Socket.IO
    const safeCamera = sanitizeCamera(camera);

    const io = req.app.get("io");

    if (io) {
      io.emit("cameraDeleted", safeCamera);
    }

    res.json({
      message: "Camera deleted successfully.",
    });
  } catch (err) {
    console.error("DELETE CAMERA ERROR:", err);

    res.status(500).json({
      error: "Failed to delete camera.",
    });
  }
};
