const mongoose = require("mongoose");
const Flock = require("../models/Flock");

const PENS = Flock.PENS || [
  "Battery Cage Row 1",
  "Battery Cage Row 2",
  "Battery Cage Row 3",
  "Deep Litter Pen 1",
  "Deep Litter Pen 2",
  "Deep Litter Pen 3",
  "Deep Litter Pen 4",
  "Deep Litter Pen 5",
  "Sick Bay",
  "Pen 150",
  "Brooding House",
];

const MAX_LAYING_AGE_WEEKS = Flock.MAX_LAYING_AGE_WEEKS || 104;

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

const getUserId = (req) => {
  return req.user?.id || req.user?._id || null;
};

const isSuperAdmin = (req) => {
  return req.user?.role === "superadmin";
};

const buildFlockResponse = (flock) => {
  if (!flock) {
    return null;
  }

  const data =
    typeof flock.toObject === "function"
      ? flock.toObject({ virtuals: true })
      : flock;

  return {
    ...data,

    maxLayingAgeWeeks: MAX_LAYING_AGE_WEEKS,

    currentAgeWeeks: flock.currentAgeWeeks ?? data.currentAgeWeeks ?? 0,

    weeksRemaining: flock.weeksRemaining ?? data.weeksRemaining ?? 0,

    expectedEndOfLay: flock.expectedEndOfLay ?? data.expectedEndOfLay ?? null,

    lifecycleStatus: flock.lifecycleStatus ?? data.lifecycleStatus ?? null,
  };
};

/*
|--------------------------------------------------------------------------
| GET ALL FLOCKS
|--------------------------------------------------------------------------
| GET /api/flocks
|--------------------------------------------------------------------------
*/

const getFlocks = async (req, res) => {
  try {
    const { status, pen, includeDeleted } = req.query;

    const filter = {};

    // Deleted flocks are hidden by default.
    if (includeDeleted === "true" && isSuperAdmin(req)) {
      filter.isDeleted = true;
    } else {
      filter.isDeleted = false;
    }

    if (status) {
      if (!["ACTIVE", "SOLD"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid flock status",
        });
      }

      filter.status = status;
    }

    if (pen) {
      const decodedPen = decodeURIComponent(pen);

      if (!PENS.includes(decodedPen)) {
        return res.status(400).json({
          success: false,
          message: "Invalid pen",
        });
      }

      filter.pen = decodedPen;
    }

    const flocks = await Flock.find(filter)
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role")
      .populate("soldBy", "name email role")
      .populate("deletedBy", "name email role")
      .sort({ placementDate: -1 });

    return res.status(200).json({
      success: true,
      count: flocks.length,
      flocks: flocks.map(buildFlockResponse),
    });
  } catch (error) {
    console.error("GET FLOCKS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch flocks",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET SINGLE FLOCK
|--------------------------------------------------------------------------
| GET /api/flocks/:id
|--------------------------------------------------------------------------
*/

const getFlock = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flock ID",
      });
    }

    const flock = await Flock.findById(id)
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role")
      .populate("soldBy", "name email role")
      .populate("deletedBy", "name email role");

    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "Flock not found",
      });
    }

    if (flock.isDeleted && !isSuperAdmin(req)) {
      return res.status(404).json({
        success: false,
        message: "Flock not found",
      });
    }

    return res.status(200).json({
      success: true,
      flock: buildFlockResponse(flock),
    });
  } catch (error) {
    console.error("GET FLOCK ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch flock",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET ACTIVE FLOCK BY PEN
|--------------------------------------------------------------------------
| GET /api/flocks/pen/:pen/active
|--------------------------------------------------------------------------
*/

const getActiveFlockByPen = async (req, res) => {
  try {
    const decodedPen = decodeURIComponent(req.params.pen);

    if (!PENS.includes(decodedPen)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pen",
      });
    }

    const flock = await Flock.findOne({
      pen: decodedPen,
      status: "ACTIVE",
      isDeleted: false,
    })
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role");

    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "No active flock found in this pen",
      });
    }

    return res.status(200).json({
      success: true,
      flock: buildFlockResponse(flock),
    });
  } catch (error) {
    console.error("GET ACTIVE FLOCK BY PEN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch active flock",
    });
  }
};

/*
|--------------------------------------------------------------------------
| CREATE FLOCK
|--------------------------------------------------------------------------
| POST /api/flocks
|--------------------------------------------------------------------------
*/

const createFlock = async (req, res) => {
  try {
    const { flockId, pen, placementDate, startingAgeWeeks, remarks } = req.body;

    if (
      !flockId ||
      !pen ||
      !placementDate ||
      startingAgeWeeks === undefined ||
      startingAgeWeeks === null
    ) {
      return res.status(400).json({
        success: false,
        message: "Flock ID, pen, placement date and starting age are required",
      });
    }

    if (!PENS.includes(pen)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pen selected",
      });
    }

    const normalizedFlockId = String(flockId).trim().toUpperCase();

    if (!normalizedFlockId) {
      return res.status(400).json({
        success: false,
        message: "Flock ID cannot be empty",
      });
    }

    const existingFlock = await Flock.findOne({
      flockId: normalizedFlockId,
    });

    if (existingFlock) {
      return res.status(409).json({
        success: false,
        message: "Flock ID already exists",
        existingFlock: buildFlockResponse(existingFlock),
      });
    }

    const age = Number(startingAgeWeeks);

    if (!Number.isInteger(age) || age < 0 || age > MAX_LAYING_AGE_WEEKS) {
      return res.status(400).json({
        success: false,
        message: `Starting age must be a whole number between 0 and ${MAX_LAYING_AGE_WEEKS} weeks`,
      });
    }

    const parsedPlacementDate = new Date(placementDate);

    if (Number.isNaN(parsedPlacementDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid placement date",
      });
    }

    const activeFlock = await Flock.findOne({
      pen,
      status: "ACTIVE",
      isDeleted: false,
    });

    if (activeFlock) {
      return res.status(409).json({
        success: false,
        message: "This pen already has an active flock",
        existingFlock: buildFlockResponse(activeFlock),
      });
    }

    const flock = await Flock.create({
      flockId: normalizedFlockId,
      pen,
      placementDate: parsedPlacementDate,
      startingAgeWeeks: age,
      remarks: remarks?.trim() || "",
      status: "ACTIVE",
      isDeleted: false,
      createdBy: getUserId(req),
    });

    const populatedFlock = await Flock.findById(flock._id).populate(
      "createdBy",
      "name email role",
    );

    return res.status(201).json({
      success: true,
      message: "Flock created successfully",
      flock: buildFlockResponse(populatedFlock),
    });
  } catch (error) {
    console.error("CREATE FLOCK ERROR:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A flock with this ID or pen already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create flock",
    });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE FLOCK
|--------------------------------------------------------------------------
| PUT /api/flocks/:id
|--------------------------------------------------------------------------
*/

const updateFlock = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flock ID",
      });
    }

    const flock = await Flock.findById(id);

    if (!flock || flock.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Flock not found",
      });
    }

    const { flockId, pen, placementDate, startingAgeWeeks, remarks } = req.body;

    /*
    |--------------------------------------------------------------------------
    | FLOCK ID
    |--------------------------------------------------------------------------
    */

    if (flockId !== undefined) {
      const normalizedFlockId = String(flockId).trim().toUpperCase();

      if (!normalizedFlockId) {
        return res.status(400).json({
          success: false,
          message: "Flock ID cannot be empty",
        });
      }

      const duplicate = await Flock.findOne({
        flockId: normalizedFlockId,
        _id: { $ne: flock._id },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Flock ID already exists",
          existingFlock: buildFlockResponse(duplicate),
        });
      }

      flock.flockId = normalizedFlockId;
    }

    /*
    |--------------------------------------------------------------------------
    | PEN
    |--------------------------------------------------------------------------
    */

    if (pen !== undefined) {
      if (!PENS.includes(pen)) {
        return res.status(400).json({
          success: false,
          message: "Invalid pen selected",
        });
      }

      if (flock.status === "ACTIVE" && pen !== flock.pen) {
        const activeFlock = await Flock.findOne({
          pen,
          status: "ACTIVE",
          isDeleted: false,
          _id: { $ne: flock._id },
        });

        if (activeFlock) {
          return res.status(409).json({
            success: false,
            message: "This pen already has an active flock",
            existingFlock: buildFlockResponse(activeFlock),
          });
        }
      }

      flock.pen = pen;
    }

    /*
    |--------------------------------------------------------------------------
    | PLACEMENT DATE
    |--------------------------------------------------------------------------
    */

    if (placementDate !== undefined) {
      const parsedPlacementDate = new Date(placementDate);

      if (Number.isNaN(parsedPlacementDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid placement date",
        });
      }

      flock.placementDate = parsedPlacementDate;
    }

    /*
    |--------------------------------------------------------------------------
    | STARTING AGE
    |--------------------------------------------------------------------------
    */

    if (startingAgeWeeks !== undefined) {
      const age = Number(startingAgeWeeks);

      if (!Number.isInteger(age) || age < 0 || age > MAX_LAYING_AGE_WEEKS) {
        return res.status(400).json({
          success: false,
          message: `Starting age must be a whole number between 0 and ${MAX_LAYING_AGE_WEEKS} weeks`,
        });
      }

      flock.startingAgeWeeks = age;
    }

    /*
    |--------------------------------------------------------------------------
    | REMARKS
    |--------------------------------------------------------------------------
    */

    if (remarks !== undefined) {
      flock.remarks = typeof remarks === "string" ? remarks.trim() : "";
    }

    flock.updatedBy = getUserId(req);

    await flock.save();

    const updatedFlock = await Flock.findById(flock._id)
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role");

    return res.status(200).json({
      success: true,
      message: "Flock updated successfully",
      flock: buildFlockResponse(updatedFlock),
    });
  } catch (error) {
    console.error("UPDATE FLOCK ERROR:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Another active flock already occupies this pen or the flock ID already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update flock",
    });
  }
};

/*
|--------------------------------------------------------------------------
| SELL FLOCK
|--------------------------------------------------------------------------
| PATCH /api/flocks/:id/sell
|--------------------------------------------------------------------------
*/

const sellFlock = async (req, res) => {
  try {
    const { id } = req.params;
    const { saleDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flock ID",
      });
    }

    const flock = await Flock.findById(id);

    if (!flock || flock.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Flock not found",
      });
    }

    if (flock.status === "SOLD") {
      return res.status(400).json({
        success: false,
        message: "Flock has already been sold",
      });
    }

    const parsedSaleDate = saleDate ? new Date(saleDate) : new Date();

    if (Number.isNaN(parsedSaleDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale date",
      });
    }

    flock.status = "SOLD";
    flock.saleDate = parsedSaleDate;
    flock.soldBy = getUserId(req);
    flock.updatedBy = getUserId(req);

    await flock.save();

    const soldFlock = await Flock.findById(flock._id)
      .populate("soldBy", "name email role")
      .populate("updatedBy", "name email role");

    return res.status(200).json({
      success: true,
      message: "Flock marked as sold successfully",
      flock: buildFlockResponse(soldFlock),
    });
  } catch (error) {
    console.error("SELL FLOCK ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to sell flock",
    });
  }
};

/*
|--------------------------------------------------------------------------
| DELETE FLOCK
|--------------------------------------------------------------------------
| DELETE /api/flocks/:id
|--------------------------------------------------------------------------
*/

const deleteFlock = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flock ID",
      });
    }

    const flock = await Flock.findById(id);

    if (!flock || flock.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Flock not found",
      });
    }

    /*
     * Prevent accidental deletion of an active flock.
     * Active flocks should first be sold/depopulated.
     */
    if (flock.status === "ACTIVE") {
      return res.status(400).json({
        success: false,
        message:
          "An active flock cannot be deleted. Sell or depopulate the flock first.",
      });
    }

    flock.isDeleted = true;
    flock.deletedAt = new Date();
    flock.deletedBy = getUserId(req);
    flock.updatedBy = getUserId(req);

    await flock.save();

    return res.status(200).json({
      success: true,
      message: "Flock deleted successfully",
      flock: buildFlockResponse(flock),
    });
  } catch (error) {
    console.error("DELETE FLOCK ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete flock",
    });
  }
};

/*
|--------------------------------------------------------------------------
| RESTORE FLOCK
|--------------------------------------------------------------------------
| PATCH /api/flocks/:id/restore
|--------------------------------------------------------------------------
*/

const restoreFlock = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flock ID",
      });
    }

    const flock = await Flock.findById(id);

    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "Flock not found",
      });
    }

    if (!flock.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Flock is not deleted",
      });
    }

    /*
     * If restoring an ACTIVE flock, ensure
     * its pen is still available.
     */
    if (flock.status === "ACTIVE") {
      const activeFlock = await Flock.findOne({
        pen: flock.pen,
        status: "ACTIVE",
        isDeleted: false,
        _id: { $ne: flock._id },
      });

      if (activeFlock) {
        return res.status(409).json({
          success: false,
          message:
            "Cannot restore flock because its pen already has an active flock",
          existingFlock: buildFlockResponse(activeFlock),
        });
      }
    }

    flock.isDeleted = false;
    flock.deletedAt = null;
    flock.deletedBy = null;
    flock.updatedBy = getUserId(req);

    await flock.save();

    return res.status(200).json({
      success: true,
      message: "Flock restored successfully",
      flock: buildFlockResponse(flock),
    });
  } catch (error) {
    console.error("RESTORE FLOCK ERROR:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Cannot restore flock because its pen is already occupied",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to restore flock",
    });
  }
};

module.exports = {
  getFlocks,
  getFlock,
  getActiveFlockByPen,
  createFlock,
  updateFlock,
  sellFlock,
  deleteFlock,
  restoreFlock,
  MAX_LAYING_AGE_WEEKS,
  PENS,
};
