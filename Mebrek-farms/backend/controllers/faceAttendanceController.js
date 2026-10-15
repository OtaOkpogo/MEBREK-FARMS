
const crypto = require("crypto");
const mongoose = require("mongoose");

const Worker = require("../models/Worker");
const Attendance = require("../models/Attendance");
const FaceTemplate = require("../models/FaceTemplate");

const MATCH_THRESHOLD = 0.48;
const MIN_MATCH_MARGIN = 0.05;
const TIME_ZONE = "Africa/Lagos";

function getEncryptionKey() {
  const secret = process.env.FACE_TEMPLATE_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "FACE_TEMPLATE_SECRET must be configured with a long private secret.",
    );
  }

  return crypto.scryptSync(
    secret,
    "MebrekFarmsFaceTemplate:v1",
    32,
  );
}

function validateDescriptor(value) {
  return (
    Array.isArray(value) &&
    value.length === 128 &&
    value.every(
      (number) =>
        typeof number === "number" &&
        Number.isFinite(number) &&
        number >= -1 &&
        number <= 1,
    )
  );
}

function encryptDescriptor(descriptor) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv,
  );

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(descriptor), "utf8"),
    cipher.final(),
  ]);

  return {
    encryptedDescriptor: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptDescriptor(template) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(template.iv, "base64"),
  );

  decipher.setAuthTag(Buffer.from(template.authTag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(
      Buffer.from(template.encryptedDescriptor, "base64"),
    ),
    decipher.final(),
  ]).toString("utf8");

  const descriptor = JSON.parse(decrypted);

  if (!validateDescriptor(descriptor)) {
    throw new Error("Stored face template is invalid.");
  }

  return descriptor;
}

function euclideanDistance(first, second) {
  let sum = 0;

  for (let i = 0; i < first.length; i += 1) {
    const difference = first[i] - second[i];
    sum += difference * difference;
  }

  return Math.sqrt(sum);
}

function getLagosDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function isLate(checkInTime, scheduledStartTime) {
  const actual = checkInTime.split(":").map(Number);
  const scheduled = scheduledStartTime.split(":").map(Number);

  return (
    actual[0] * 60 + actual[1] >
    scheduled[0] * 60 + scheduled[1]
  );
}

function calculateWorkingHours(checkInTime, checkOutTime) {
  if (!checkInTime || !checkOutTime) return 0;

  const [inHours, inMinutes] = checkInTime.split(":").map(Number);
  const [outHours, outMinutes] = checkOutTime.split(":").map(Number);

  let minutes =
    outHours * 60 + outMinutes - (inHours * 60 + inMinutes);

  if (minutes < 0) minutes += 24 * 60;

  return Math.round((minutes / 60) * 100) / 100;
}

function getAdminId(req) {
  return req.user?.id || req.user?._id || req.admin?.id || null;
}

// POST /api/face-attendance/enroll
// Superadmin only.
exports.enrollFace = async (req, res) => {
  try {
    const { workerId, descriptor } = req.body;

    if (!mongoose.isValidObjectId(workerId)) {
      return res.status(400).json({
        success: false,
        message: "A valid workerId is required.",
      });
    }

    if (!validateDescriptor(descriptor)) {
      return res.status(400).json({
        success: false,
        message: "A valid 128-number face descriptor is required.",
      });
    }

    const worker = await Worker.findById(workerId).select(
      "_id firstName lastName employeeId status",
    );

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found.",
      });
    }

    if (worker.status !== "Active") {
      return res.status(409).json({
        success: false,
        message: "Only active workers can be enrolled.",
      });
    }

    const encrypted = encryptDescriptor(descriptor);

    const template = await FaceTemplate.findOneAndUpdate(
      { workerId: worker._id },
      {
        $set: {
          ...encrypted,
          enrolledBy: getAdminId(req),
          enrolledAt: new Date(),
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    return res.status(200).json({
      success: true,
      message: "Face template enrolled successfully.",
      worker: {
        id: worker._id,
        employeeId: worker.employeeId,
        name: `${worker.firstName} ${worker.lastName}`.trim(),
      },
      enrolledAt: template.enrolledAt,
    });
  } catch (error) {
    console.error("Face enrollment failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Face enrollment failed.",
    });
  }
};

// DELETE /api/face-attendance/enroll/:workerId
// Superadmin only.
exports.removeFace = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.workerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid worker ID.",
      });
    }

    const result = await FaceTemplate.deleteOne({
      workerId: req.params.workerId,
    });

    if (!result.deletedCount) {
      return res.status(404).json({
        success: false,
        message: "This worker has no enrolled face template.",
      });
    }

    return res.json({
      success: true,
      message: "Face enrollment removed.",
    });
  } catch (error) {
    console.error("Face removal failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to remove face enrollment.",
    });
  }
};

// POST /api/face-attendance/recognize
// Authenticated attendance users.
exports.recognizeFace = async (req, res) => {
  try {
    const { descriptor } = req.body;

    if (!validateDescriptor(descriptor)) {
      return res.status(400).json({
        success: false,
        message: "A valid 128-number face descriptor is required.",
      });
    }

    const templates = await FaceTemplate.find()
      .select("+encryptedDescriptor +iv +authTag")
      .populate(
        "workerId",
        "firstName lastName employeeId role status startTime endTime",
      )
      .lean();

    const matches = [];

    for (const template of templates) {
      if (
        !template.workerId ||
        template.workerId.status !== "Active"
      ) {
        continue;
      }

      try {
        const savedDescriptor = decryptDescriptor(template);
        const distance = euclideanDistance(
          descriptor,
          savedDescriptor,
        );

        matches.push({
          worker: template.workerId,
          distance,
        });
      } catch (error) {
        // Skip unreadable templates; never treat them as a match.
        console.error(
          "Unable to read a face template:",
          template._id,
        );
      }
    }

    matches.sort((a, b) => a.distance - b.distance);

    const best = matches[0];
    const secondBest = matches[1];

    if (
      !best ||
      best.distance > MATCH_THRESHOLD ||
      (secondBest &&
        secondBest.distance - best.distance < MIN_MATCH_MARGIN)
    ) {
      return res.status(404).json({
        success: false,
        message: "Face not recognized. Please try again or use manual attendance.",
      });
    }

    const worker = best.worker;
    const { date, time } = getLagosDateTime();

    let attendance = await Attendance.findOne({
      workerId: worker._id,
      attendanceDate: date,
    });

    if (attendance?.isDeleted) {
      return res.status(409).json({
        success: false,
        message:
          "An attendance record for today has been deleted. Contact a manager.",
      });
    }

    let action;

    if (!attendance) {
      const scheduledStartTime = worker.startTime || "08:00";
      const late = isLate(time, scheduledStartTime);

      attendance = await Attendance.create({
        workerId: worker._id,
        workerName: `${worker.firstName} ${worker.lastName}`.trim(),
        role: worker.role,
        attendanceDate: date,
        status: late ? "Late" : "Present",
        checkInTime: time,
        checkOutTime: "",
        scheduledStartTime,
        scheduledEndTime: worker.endTime || "",
        isLate: late,
        workingHours: 0,
        remarks: "Recorded through face recognition",
      });

      action = "check-in";
    } else if (!attendance.checkInTime) {
      const scheduledStartTime =
        attendance.scheduledStartTime || worker.startTime || "08:00";

      attendance.checkInTime = time;
      attendance.scheduledStartTime = scheduledStartTime;
      attendance.scheduledEndTime =
        attendance.scheduledEndTime || worker.endTime || "";
      attendance.isLate = isLate(time, scheduledStartTime);
      attendance.status = attendance.isLate ? "Late" : "Present";
      attendance.remarks =
        attendance.remarks || "Recorded through face recognition";

      await attendance.save();
      action = "check-in";
    } else if (!attendance.checkOutTime) {
      attendance.checkOutTime = time;
      attendance.workingHours = calculateWorkingHours(
        attendance.checkInTime,
        time,
      );

      await attendance.save();
      action = "check-out";
    } else {
      return res.status(409).json({
        success: false,
        message: "This worker has already checked in and out today.",
      });
    }

    return res.json({
      success: true,
      message: `Face matched. ${action === "check-in" ? "Check-in" : "Check-out"} recorded.`,
      action,
      worker: {
        id: worker._id,
        employeeId: worker.employeeId,
        name: `${worker.firstName} ${worker.lastName}`.trim(),
        role: worker.role,
      },
      attendance: {
        id: attendance._id,
        date,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        status: attendance.status,
        workingHours: attendance.workingHours,
      },
    });
  } catch (error) {
    console.error("Face attendance failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Face attendance could not be processed.",
    });
  }
};

