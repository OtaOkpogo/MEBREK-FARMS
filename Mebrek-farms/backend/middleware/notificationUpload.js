const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ============================================================
// UPLOAD DIRECTORY
// ============================================================

const uploadDirectory = path.join(
  __dirname,
  "..",
  "uploads",
  "notifications",
);

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
      .basename(
        file.originalname,
        extension,
      )
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .substring(0, 50);

    const uniqueName =
      `${Date.now()}-${Math.round(
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

  // Audio
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/webm",
  "audio/ogg",

  // Optional supporting documents
  "application/pdf",
]);

// ============================================================
// FILE FILTER
// ============================================================

const fileFilter = (req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(
      new Error(
        `Unsupported attachment type: ${file.mimetype}`,
      ),
      false,
    );
  }

  cb(null, true);
};

// ============================================================
// MULTER
// ============================================================

const notificationUpload = multer({
  storage,

  fileFilter,

  limits: {
    // 10 MB per file
    fileSize: 10 * 1024 * 1024,

    // Maximum 5 files in one message
    files: 5,
  },
});

module.exports = notificationUpload;
