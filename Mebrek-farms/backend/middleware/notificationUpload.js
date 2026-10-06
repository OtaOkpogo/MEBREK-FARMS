const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ============================================================
// UPLOAD DIRECTORY
// ============================================================

const uploadDirectory = path.join(__dirname, "..", "uploads", "notifications");

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}

// ============================================================
// STORAGE
// ============================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);

    const baseName = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .substring(0, 50);

    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9,
    )}-${baseName}${extension}`;

    cb(null, uniqueName);
  },
});

// ============================================================
// ALLOWED FILE TYPES
// ============================================================

const allowedMimeTypes = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",

  // Audio / voice notes
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/webm",
  "audio/ogg",
  "audio/aac",
]);

// ============================================================
// FILE FILTER
// ============================================================

const fileFilter = (req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(
      new Error(`Unsupported attachment type: ${file.mimetype}`),
      false,
    );
  }

  cb(null, true);
};

// ============================================================
// MULTER INSTANCE
// ============================================================

const notificationUpload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
});

// ============================================================
// ATTACHMENT MIDDLEWARE
// ============================================================

const uploadNotificationAttachments = (req, res, next) => {
  notificationUpload.array("attachments", 5)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "Each attachment must be 10 MB or smaller.",
        });
      }

      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          message: "You can attach a maximum of 5 files.",
        });
      }

      return res.status(400).json({
        message: err.message,
      });
    }

    if (err) {
      return res.status(400).json({
        message: err.message || "Attachment upload failed.",
      });
    }

    next();
  });
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  uploadNotificationAttachments,
};
