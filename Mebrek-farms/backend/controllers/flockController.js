const mongoose = require("mongoose");

const Flock = require("../models/Flock");
const FlockAllocation = require("../models/FlockAllocation");
const FlockTransfer = require("../models/FlockTransfer");
const FlockPopulationHistory = require("../models/FlockPopulationHistory");

const { logAudit } = require("../utils/auditLogger");

const PENS = Flock.PENS || require("../constants/pens");
const MAX_LAYING_AGE_WEEKS = Flock.MAX_LAYING_AGE_WEEKS || 104;

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

const getUserId = (req) => req.user?.id || req.user?._id || null;

const isSuperAdmin = (req) => req.user?.role === "superadmin";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const isValidPen = (pen) => PENS.includes(pen);

const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isWholeNumber = (value) =>
  Number.isInteger(Number(value)) && Number(value) >= 0;

const isPositiveWholeNumber = (value) =>
  Number.isInteger(Number(value)) && Number(value) > 0;

const isFutureDate = (date) => date.getTime() > Date.now();

const buildFlockResponse = (flock) => {
  if (!flock) return null;

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

const getFlockAuditSnapshot = (flock) => {
  if (!flock) return null;

  return {
    flockId: flock.flockId,
    pen: flock.pen,
    placementDate: flock.placementDate,
    startingAgeWeeks: flock.startingAgeWeeks,
    initialBirdCount: flock.initialBirdCount ?? null,
    populationTrackingStatus: flock.populationTrackingStatus || "NOT_SET",
    remarks: flock.remarks,
    status: flock.status,
    saleDate: flock.saleDate || null,
    isDeleted: flock.isDeleted,
    deletedAt: flock.deletedAt || null,
  };
};

const getFlockAuditName = (flock) =>
  flock ? `${flock.flockId} - ${flock.pen}` : "Unknown Flock";

const getActiveAllocations = (flockId, session = null) => {
  let query = FlockAllocation.find({
    flock: flockId,
    status: "ACTIVE",
  });

  if (session) query = query.session(session);

  return query.sort({ allocationDate: 1, createdAt: 1 });
};

/*
|--------------------------------------------------------------------------
| POPULATION SUMMARY
|--------------------------------------------------------------------------
*/

const getPopulationSummary = async (flockId, session = null) => {
  let query = FlockAllocation.find({
    flock: flockId,
  });

  if (session) query = query.session(session);

  const allAllocations = await query.sort({
    allocationDate: 1,
    createdAt: 1,
  });

  const activeAllocations = allAllocations.filter(
    (allocation) => allocation.status === "ACTIVE",
  );

  // Use active allocations when available.
  // For a fully closed flock, use its closed allocations to preserve
  // the confirmed final population.
  const allocationsToCount = activeAllocations.length
    ? activeAllocations
    : allAllocations;

  if (!allocationsToCount.length) {
    return {
      totalBirds: null,
      populationKnown: false,
      activeAllocationCount: 0,
      allocations: activeAllocations,
    };
  }

  const unknownPopulation = allocationsToCount.some(
    (allocation) =>
      allocation.currentBirds === null || allocation.currentBirds === undefined,
  );

  const totalBirds = unknownPopulation
    ? null
    : allocationsToCount.reduce(
        (sum, allocation) => sum + allocation.currentBirds,
        0,
      );

  return {
    totalBirds,
    populationKnown: !unknownPopulation,
    activeAllocationCount: activeAllocations.length,
    allocations: activeAllocations,
  };
};

/*
|--------------------------------------------------------------------------
| POPULATION TRACKING STATUS
|--------------------------------------------------------------------------
*/

const updatePopulationTrackingStatus = async (flock, session, userId) => {
  let query = FlockAllocation.find({
    flock: flock._id,
  });

  if (session) query = query.session(session);

  const allAllocations = await query;

  const populationKnown =
    allAllocations.length > 0 &&
    allAllocations.every(
      (allocation) =>
        allocation.currentBirds !== null &&
        allocation.currentBirds !== undefined,
    );

  flock.populationTrackingStatus = populationKnown ? "TRACKED" : "NOT_SET";
  flock.updatedBy = userId;

  await flock.save({ session });

  return populationKnown;
};

/*
|--------------------------------------------------------------------------
| VERIFY FLOCK ACCESS
|--------------------------------------------------------------------------
*/

const getAccessibleFlock = async (id, req) => {
  const flock = await Flock.findById(id);

  if (!flock) return null;

  if (flock.isDeleted && !isSuperAdmin(req)) {
    return null;
  }

  return flock;
};

/*
|--------------------------------------------------------------------------
| CHECK POPULATION HISTORY DATE
|--------------------------------------------------------------------------
| Prevents changing current population using an event dated earlier than
| an already-recorded population event.
|--------------------------------------------------------------------------
*/

const validateAllocationEventDate = async (allocation, eventDate, session) => {
  if (eventDate < allocation.allocationDate) {
    throw new Error("EVENT_BEFORE_ALLOCATION");
  }

  let query = FlockPopulationHistory.findOne({
    allocation: allocation._id,
  }).sort({ eventDate: -1, createdAt: -1 });

  if (session) query = query.session(session);

  const latestHistory = await query;

  if (latestHistory && eventDate < latestHistory.eventDate) {
    throw new Error("BACKDATED_POPULATION_EVENT");
  }
};

/*
|--------------------------------------------------------------------------
| GET FLOCK WITH ALLOCATIONS
|--------------------------------------------------------------------------
*/

const getFlockWithAllocations = async (flockId) => {
  const flock = await Flock.findById(flockId)
    .populate("createdBy", "name email role")
    .populate("updatedBy", "name email role")
    .populate("soldBy", "name email role")
    .populate("deletedBy", "name email role");

  if (!flock) return null;

  const population = await getPopulationSummary(flockId);

  const flockResponse = buildFlockResponse(flock);

  return {
    ...flockResponse,

    // Derive tracking status from the verified population.
    populationTrackingStatus: population.populationKnown
      ? "TRACKED"
      : "NOT_SET",

    allocations: population.allocations,

    population: {
      totalBirds: population.totalBirds,
      populationKnown: population.populationKnown,
      activeAllocationCount: population.activeAllocationCount,
    },
  };
};

/*
|--------------------------------------------------------------------------
| TRANSACTION HELPER
|--------------------------------------------------------------------------
*/

const runTransaction = async (callback) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = await callback(session);
    });

    return result;
  } finally {
    await session.endSession();
  }
};

/*
|--------------------------------------------------------------------------
| SERVER ERROR HANDLER
|--------------------------------------------------------------------------
*/

const sendServerError = (res, message, error) => {
  console.error(message, error);

  return res.status(500).json({
    success: false,
    message,
    error: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
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

      if (!isValidPen(decodedPen)) {
        return res.status(400).json({
          success: false,
          message: "Invalid pen",
        });
      }

      const allocations = await FlockAllocation.find({
        pen: decodedPen,
        status: "ACTIVE",
      }).select("flock");

      const allocatedFlockIds = allocations.map(
        (allocation) => allocation.flock,
      );

      filter.$or = [{ pen: decodedPen }, { _id: { $in: allocatedFlockIds } }];
    }

    const flocks = await Flock.find(filter)
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role")
      .populate("soldBy", "name email role")
      .populate("deletedBy", "name email role")
      .sort({ placementDate: -1 });

    const results = await Promise.all(
      flocks.map((flock) => getFlockWithAllocations(flock._id)),
    );

    return res.status(200).json({
      success: true,
      count: results.length,
      flocks: results,
    });
  } catch (error) {
    return sendServerError(res, "Failed to fetch flocks", error);
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

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flock ID",
      });
    }

    const flock = await getAccessibleFlock(id, req);

    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "Flock not found",
      });
    }

    return res.status(200).json({
      success: true,
      flock: await getFlockWithAllocations(id),
    });
  } catch (error) {
    return sendServerError(res, "Failed to fetch flock", error);
  }
};

/*
|--------------------------------------------------------------------------
| GET ACTIVE FLOCKS IN A PEN
|--------------------------------------------------------------------------
| GET /api/flocks/pen/:pen/active
|--------------------------------------------------------------------------
*/

const getActiveFlockByPen = async (req, res) => {
  try {
    const decodedPen = decodeURIComponent(req.params.pen);

    if (!isValidPen(decodedPen)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pen",
      });
    }

    const allocations = await FlockAllocation.find({
      pen: decodedPen,
      status: "ACTIVE",
    })
      .populate({
        path: "flock",
        match: {
          status: "ACTIVE",
          isDeleted: false,
        },
        select: "flockId pen placementDate startingAgeWeeks status remarks",
      })
      .sort({ allocationDate: 1 });

    const activeAllocations = allocations.filter(
      (allocation) => allocation.flock,
    );

    if (!activeAllocations.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        pen: decodedPen,
        flocks: [],
        allocations: [],
        flock: null,
      });
    }

    const responseAllocations = activeAllocations.map((allocation) => ({
      ...allocation.toObject(),
      flock: buildFlockResponse(allocation.flock),
    }));

    return res.status(200).json({
      success: true,
      count: responseAllocations.length,
      pen: decodedPen,
      allocations: responseAllocations,
      flocks: responseAllocations.map((item) => item.flock),
      flock:
        responseAllocations.length === 1 ? responseAllocations[0].flock : null,
    });
  } catch (error) {
    return sendServerError(res, "Failed to fetch active flocks in pen", error);
  }
};

/*
|--------------------------------------------------------------------------
| GET PEN OCCUPANCY SUMMARY
|--------------------------------------------------------------------------
| GET /api/flocks/pen-occupancy
|--------------------------------------------------------------------------
| Returns the combined current population of every pen across all active,
| non-deleted flocks.
|--------------------------------------------------------------------------
*/

const getPenOccupancySummary = async (req, res) => {
  try {
    const allocations = await FlockAllocation.find({
      status: "ACTIVE",
    })
      .populate({
        path: "flock",
        match: {
          status: "ACTIVE",
          isDeleted: false,
        },
        select: "flockId status isDeleted",
      })
      .sort({ pen: 1, allocationDate: 1, createdAt: 1 });

    // Ignore allocations belonging to sold, deleted, or missing flocks.
    const validAllocations = allocations.filter(
      (allocation) => allocation.flock,
    );

    // Initialize every configured pen so empty pens are also displayed.
    const occupancyMap = new Map(
      PENS.map((pen) => [
        pen,
        {
          pen,
          totalBirds: 0,
          populationKnown: true,
          activeAllocationCount: 0,
          activeFlockCount: 0,
          unknownAllocationCount: 0,
          flockIds: new Set(),
        },
      ]),
    );

    for (const allocation of validAllocations) {
      const summary = occupancyMap.get(allocation.pen);

      // Ignore unexpected pen values rather than creating unconfigured pens.
      if (!summary) continue;

      summary.activeAllocationCount += 1;
      summary.flockIds.add(allocation.flock._id.toString());

      if (
        allocation.currentBirds === null ||
        allocation.currentBirds === undefined
      ) {
        summary.populationKnown = false;
        summary.unknownAllocationCount += 1;
      } else {
        summary.totalBirds += allocation.currentBirds;
      }
    }

    const occupancy = Array.from(occupancyMap.values()).map((summary) => {
      const { flockIds, ...result } = summary;

      return {
        ...result,
        // Never present a partial sum as the pen's confirmed population.
        totalBirds: result.populationKnown ? result.totalBirds : null,
        activeFlockCount: flockIds.size,
      };
    });

    const totalKnown = occupancy.every((pen) => pen.populationKnown);

    const totalBirds = totalKnown
      ? occupancy.reduce((sum, pen) => sum + pen.totalBirds, 0)
      : null;

    return res.status(200).json({
      success: true,
      count: occupancy.length,
      summary: {
        totalBirds,
        populationKnown: totalKnown,
        totalActiveAllocations: validAllocations.length,
        totalActiveFlocks: new Set(
          validAllocations.map((allocation) => allocation.flock._id.toString()),
        ).size,
        pensWithUnknownPopulation: occupancy.filter(
          (pen) => !pen.populationKnown,
        ).length,
      },
      occupancy,
    });
  } catch (error) {
    return sendServerError(res, "Failed to fetch pen occupancy summary", error);
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
    const {
      flockId,
      pen,
      placementDate,
      startingAgeWeeks,
      initialBirdCount,
      remarks,
    } = req.body;

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

    if (!isValidPen(pen)) {
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

    const duplicate = await Flock.findOne({
      flockId: normalizedFlockId,
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "Flock ID already exists",
        existingFlock: buildFlockResponse(duplicate),
      });
    }

    const age = Number(startingAgeWeeks);

    if (!Number.isInteger(age) || age < 0 || age > MAX_LAYING_AGE_WEEKS) {
      return res.status(400).json({
        success: false,
        message: `Starting age must be a whole number between 0 and ${MAX_LAYING_AGE_WEEKS} weeks`,
      });
    }

    const parsedPlacementDate = parseDate(placementDate);

    if (!parsedPlacementDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid placement date",
      });
    }

    if (isFutureDate(parsedPlacementDate)) {
      return res.status(400).json({
        success: false,
        message: "Placement date cannot be in the future",
      });
    }

    let population = null;

    if (
      initialBirdCount !== undefined &&
      initialBirdCount !== null &&
      initialBirdCount !== ""
    ) {
      if (!isWholeNumber(initialBirdCount)) {
        return res.status(400).json({
          success: false,
          message:
            "Initial bird population must be a whole number of 0 or more",
        });
      }

      population = Number(initialBirdCount);
    }

    const createdFlock = await runTransaction(async (session) => {
      const [flock] = await Flock.create(
        [
          {
            flockId: normalizedFlockId,
            pen,
            placementDate: parsedPlacementDate,
            startingAgeWeeks: age,
            initialBirdCount: population,
            populationTrackingStatus:
              population === null ? "NOT_SET" : "TRACKED",
            remarks: typeof remarks === "string" ? remarks.trim() : "",
            status: "ACTIVE",
            isDeleted: false,
            createdBy: getUserId(req),
          },
        ],
        { session },
      );

      const [allocation] = await FlockAllocation.create(
        [
          {
            flock: flock._id,
            pen,
            openingBirds: population,
            currentBirds: population,
            allocationDate: parsedPlacementDate,
            status: "ACTIVE",
            createdBy: getUserId(req),
          },
        ],
        { session },
      );

      // Always record initial placement.
      // Unknown population remains null, never zero.
      await FlockPopulationHistory.create(
        [
          {
            flock: flock._id,
            allocation: allocation._id,
            pen,
            eventType: "INITIAL_PLACEMENT",
            quantityChange: population,
            balanceAfter: population,
            eventDate: parsedPlacementDate,
            sourceType: "FLOCK",
            sourceId: flock._id,
            remarks:
              population === null
                ? "Initial flock placement recorded; population not yet established"
                : "Initial flock population recorded",
            createdBy: getUserId(req),
          },
        ],
        { session },
      );

      return flock;
    });

    await logAudit(req, {
      action: "CREATE",
      module: "Flocks",
      description: `Created flock ${createdFlock.flockId} in ${pen}`,
      entityId: createdFlock._id,
      entityName: getFlockAuditName(createdFlock),
      before: null,
      after: getFlockAuditSnapshot(createdFlock),
      metadata: {
        initialBirdCount: population,
        populationTrackingStatus: population === null ? "NOT_SET" : "TRACKED",
      },
    });

    return res.status(201).json({
      success: true,
      message: "Flock created successfully",
      flock: await getFlockWithAllocations(createdFlock._id),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A flock with this ID already exists",
      });
    }

    return sendServerError(res, "Failed to create flock", error);
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

    if (!isValidId(id)) {
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

    const beforeAudit = getFlockAuditSnapshot(flock);

    const { flockId, pen, placementDate, startingAgeWeeks, remarks } = req.body;

    if (pen !== undefined && pen !== flock.pen) {
      return res.status(400).json({
        success: false,
        message:
          "A flock cannot be moved by editing its pen. Use the flock transfer operation to preserve its allocation and population history.",
      });
    }

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

    if (placementDate !== undefined) {
      const parsedDate = parseDate(placementDate);

      if (!parsedDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid placement date",
        });
      }

      if (isFutureDate(parsedDate)) {
        return res.status(400).json({
          success: false,
          message: "Placement date cannot be in the future",
        });
      }

      // Do not allow placement date to move beyond existing allocations.
      const earliestAllocation = await FlockAllocation.findOne({
        flock: flock._id,
      }).sort({ allocationDate: 1 });

      if (
        earliestAllocation &&
        parsedDate > earliestAllocation.allocationDate
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Placement date cannot be later than the flock's first allocation date.",
        });
      }

      flock.placementDate = parsedDate;
    }

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

    if (remarks !== undefined) {
      flock.remarks = typeof remarks === "string" ? remarks.trim() : "";
    }

    flock.updatedBy = getUserId(req);

    await flock.save();

    await logAudit(req, {
      action: "UPDATE",
      module: "Flocks",
      description: `Updated flock ${flock.flockId}`,
      entityId: flock._id,
      entityName: getFlockAuditName(flock),
      before: beforeAudit,
      after: getFlockAuditSnapshot(flock),
    });

    return res.status(200).json({
      success: true,
      message: "Flock updated successfully",
      flock: await getFlockWithAllocations(flock._id),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Flock ID already exists",
      });
    }

    return sendServerError(res, "Failed to update flock", error);
  }
};

/*
|--------------------------------------------------------------------------
| TRANSFER BIRDS BETWEEN PENS
|--------------------------------------------------------------------------
| POST /api/flocks/:id/transfers
|--------------------------------------------------------------------------
*/

const createFlockTransfer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flock ID",
      });
    }

    const { fromPen, toPen, birdsMoved, transferDate, reason, remarks } =
      req.body;

    if (!fromPen || !toPen || birdsMoved === undefined || birdsMoved === null) {
      return res.status(400).json({
        success: false,
        message: "Source pen, destination pen and number of birds are required",
      });
    }

    if (!isValidPen(fromPen) || !isValidPen(toPen)) {
      return res.status(400).json({
        success: false,
        message: "Invalid source or destination pen",
      });
    }

    if (fromPen === toPen) {
      return res.status(400).json({
        success: false,
        message: "Source and destination pens must be different",
      });
    }

    if (!isPositiveWholeNumber(birdsMoved)) {
      return res.status(400).json({
        success: false,
        message:
          "Number of birds moved must be a whole number greater than zero",
      });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        message: "A transfer reason is required",
      });
    }

    const parsedTransferDate = transferDate
      ? parseDate(transferDate)
      : new Date();

    if (!parsedTransferDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid transfer date",
      });
    }

    if (isFutureDate(parsedTransferDate)) {
      return res.status(400).json({
        success: false,
        message: "Transfer date cannot be in the future",
      });
    }

    const flock = await Flock.findById(id);

    if (!flock || flock.isDeleted || flock.status !== "ACTIVE") {
      return res.status(404).json({
        success: false,
        message: "Active flock not found",
      });
    }

    const moved = Number(birdsMoved);

    const transfer = await runTransaction(async (session) => {
      const source = await FlockAllocation.findOne({
        flock: flock._id,
        pen: fromPen,
        status: "ACTIVE",
      }).session(session);

      if (!source) {
        throw new Error("SOURCE_ALLOCATION_NOT_FOUND");
      }

      if (source.currentBirds === null || source.currentBirds === undefined) {
        throw new Error("SOURCE_POPULATION_UNKNOWN");
      }

      if (source.currentBirds < moved) {
        throw new Error("INSUFFICIENT_BIRDS");
      }

      await validateAllocationEventDate(source, parsedTransferDate, session);

      let destination = await FlockAllocation.findOne({
        flock: flock._id,
        pen: toPen,
        status: "ACTIVE",
      }).session(session);

      if (!destination) {
        [destination] = await FlockAllocation.create(
          [
            {
              flock: flock._id,
              pen: toPen,
              openingBirds: 0,
              currentBirds: 0,
              allocationDate: parsedTransferDate,
              status: "ACTIVE",
              createdBy: getUserId(req),
            },
          ],
          { session },
        );
      } else {
        await validateAllocationEventDate(
          destination,
          parsedTransferDate,
          session,
        );
      }

      if (
        destination.currentBirds === null ||
        destination.currentBirds === undefined
      ) {
        throw new Error("DESTINATION_POPULATION_UNKNOWN");
      }

      source.currentBirds -= moved;
      source.updatedBy = getUserId(req);

      if (source.currentBirds === 0) {
        source.status = "CLOSED";
        source.closedAt = parsedTransferDate;
        source.closedReason = "TRANSFERRED";
      }

      destination.currentBirds += moved;
      destination.updatedBy = getUserId(req);

      await source.save({ session });
      await destination.save({ session });

      const [createdTransfer] = await FlockTransfer.create(
        [
          {
            flock: flock._id,
            fromPen,
            toPen,
            fromAllocation: source._id,
            toAllocation: destination._id,
            birdsMoved: moved,
            transferDate: parsedTransferDate,
            reason: String(reason).trim(),
            remarks: typeof remarks === "string" ? remarks.trim() : "",
            status: "COMPLETED",
            transferredBy: getUserId(req),
          },
        ],
        { session },
      );

      await FlockPopulationHistory.create(
        [
          {
            flock: flock._id,
            allocation: source._id,
            pen: fromPen,
            eventType: "TRANSFER_OUT",
            quantityChange: -moved,
            balanceAfter: source.currentBirds,
            eventDate: parsedTransferDate,
            sourceType: "TRANSFER",
            sourceId: createdTransfer._id,
            remarks: `Transferred ${moved} birds to ${toPen}`,
            createdBy: getUserId(req),
          },
          {
            flock: flock._id,
            allocation: destination._id,
            pen: toPen,
            eventType: "TRANSFER_IN",
            quantityChange: moved,
            balanceAfter: destination.currentBirds,
            eventDate: parsedTransferDate,
            sourceType: "TRANSFER",
            sourceId: createdTransfer._id,
            remarks: `Received ${moved} birds from ${fromPen}`,
            createdBy: getUserId(req),
          },
        ],
        { session, ordered: true },
      );

      await updatePopulationTrackingStatus(flock, session, getUserId(req));

      return createdTransfer;
    });

    await logAudit(req, {
      action: "CREATE",
      module: "Flock Transfers",
      description: `Transferred ${moved} birds of ${flock.flockId} from ${fromPen} to ${toPen}`,
      entityId: transfer._id,
      entityName: `${flock.flockId}: ${fromPen} to ${toPen}`,
      before: null,
      after: {
        flock: flock._id,
        fromPen,
        toPen,
        birdsMoved: moved,
        transferDate: parsedTransferDate,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Flock transfer completed successfully",
      transfer,
      flock: await getFlockWithAllocations(flock._id),
    });
  } catch (error) {
    const messages = {
      SOURCE_ALLOCATION_NOT_FOUND:
        "This flock has no active allocation in the selected source pen.",
      SOURCE_POPULATION_UNKNOWN:
        "The source pen population is unknown. Record the population before transferring birds.",
      DESTINATION_POPULATION_UNKNOWN:
        "The destination allocation has an unknown population. Resolve it before transferring birds.",
      INSUFFICIENT_BIRDS:
        "The source pen does not have enough birds for this transfer.",
      EVENT_BEFORE_ALLOCATION:
        "The event date cannot be earlier than the allocation date.",
      BACKDATED_POPULATION_EVENT:
        "This transfer date is earlier than an existing population history entry. Use the current date or correct the existing history first.",
    };

    if (messages[error.message]) {
      return res.status(400).json({
        success: false,
        message: messages[error.message],
      });
    }

    return sendServerError(res, "Failed to complete flock transfer", error);
  }
};

/*
|--------------------------------------------------------------------------
| CANCEL FLOCK TRANSFER
|--------------------------------------------------------------------------
| PATCH /api/flocks/:id/transfers/:transferId/cancel
|--------------------------------------------------------------------------
*/

const cancelFlockTransfer = async (req, res) => {
  try {
    const { id, transferId } = req.params;
    const { cancellationReason } = req.body;

    if (!isValidId(id) || !isValidId(transferId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flock or transfer ID",
      });
    }

    if (typeof cancellationReason !== "string" || !cancellationReason.trim()) {
      return res.status(400).json({
        success: false,
        message: "A cancellation reason is required",
      });
    }

    const flock = await Flock.findById(id);

    if (!flock || flock.isDeleted || flock.status !== "ACTIVE") {
      return res.status(404).json({
        success: false,
        message: "Active flock not found",
      });
    }

    const cancellationDate = new Date();
    const reason = cancellationReason.trim();

    const result = await runTransaction(async (session) => {
      const currentFlock = await Flock.findById(id).session(session);

      if (
        !currentFlock ||
        currentFlock.isDeleted ||
        currentFlock.status !== "ACTIVE"
      ) {
        throw new Error("FLOCK_NOT_ACTIVE");
      }

      const transfer = await FlockTransfer.findOne({
        _id: transferId,
        flock: id,
      }).session(session);

      if (!transfer) {
        throw new Error("TRANSFER_NOT_FOUND");
      }

      if (transfer.status === "CANCELLED") {
        throw new Error("TRANSFER_ALREADY_CANCELLED");
      }

      if (transfer.status !== "COMPLETED") {
        throw new Error("TRANSFER_NOT_COMPLETED");
      }

      if (
        !transfer.fromAllocation ||
        !transfer.toAllocation ||
        !transfer.birdsMoved ||
        transfer.birdsMoved < 1
      ) {
        throw new Error("INVALID_TRANSFER_RECORD");
      }

      const originalSource = await FlockAllocation.findOne({
        _id: transfer.fromAllocation,
        flock: id,
        pen: transfer.fromPen,
      }).session(session);

      const destination = await FlockAllocation.findOne({
        _id: transfer.toAllocation,
        flock: id,
        pen: transfer.toPen,
      }).session(session);

      if (!originalSource || !destination) {
        throw new Error("TRANSFER_ALLOCATION_NOT_FOUND");
      }

      if (
        destination.status !== "ACTIVE" ||
        destination.currentBirds === null ||
        destination.currentBirds === undefined
      ) {
        throw new Error("DESTINATION_NOT_AVAILABLE");
      }

      if (destination.currentBirds < transfer.birdsMoved) {
        throw new Error("INSUFFICIENT_DESTINATION_BIRDS");
      }

      let source = originalSource;
      let reopeningOriginalSource = false;

      if (originalSource.status === "CLOSED") {
        if (originalSource.closedReason !== "TRANSFERRED") {
          throw new Error("SOURCE_CANNOT_BE_REOPENED");
        }

        const existingActiveSource = await FlockAllocation.findOne({
          flock: id,
          pen: transfer.fromPen,
          status: "ACTIVE",
        }).session(session);

        if (existingActiveSource) {
          source = existingActiveSource;
        } else {
          reopeningOriginalSource = true;
        }
      }

      if (source.currentBirds === null || source.currentBirds === undefined) {
        throw new Error("SOURCE_POPULATION_UNKNOWN");
      }

      await validateAllocationEventDate(source, cancellationDate, session);

      await validateAllocationEventDate(destination, cancellationDate, session);

      const previousSourcePopulation = source.currentBirds;
      const previousDestinationPopulation = destination.currentBirds;

      // Restore the birds to the original source pen.
      source.currentBirds += transfer.birdsMoved;
      source.updatedBy = getUserId(req);

      if (reopeningOriginalSource) {
        source.status = "ACTIVE";
        source.closedAt = null;
        source.closedReason = null;
      }

      // Remove the birds from the destination pen.
      destination.currentBirds -= transfer.birdsMoved;
      destination.updatedBy = getUserId(req);

      await source.save({ session });
      await destination.save({ session });

      // Keep the original transfer history intact.
      // These records document the cancellation reversal.
      await FlockPopulationHistory.create(
        [
          {
            flock: currentFlock._id,
            allocation: source._id,
            pen: transfer.fromPen,
            eventType: "TRANSFER_IN",
            quantityChange: transfer.birdsMoved,
            balanceAfter: source.currentBirds,
            eventDate: cancellationDate,
            sourceType: "TRANSFER",
            sourceId: transfer._id,
            remarks: `Cancellation reversal: restored ${transfer.birdsMoved} birds to ${transfer.fromPen}. Reason: ${reason}`,
            createdBy: getUserId(req),
          },
          {
            flock: currentFlock._id,
            allocation: destination._id,
            pen: transfer.toPen,
            eventType: "TRANSFER_OUT",
            quantityChange: -transfer.birdsMoved,
            balanceAfter: destination.currentBirds,
            eventDate: cancellationDate,
            sourceType: "TRANSFER",
            sourceId: transfer._id,
            remarks: `Cancellation reversal: returned ${transfer.birdsMoved} birds from ${transfer.toPen} to ${transfer.fromPen}. Reason: ${reason}`,
            createdBy: getUserId(req),
          },
        ],
        { session, ordered: true },
      );

      transfer.status = "CANCELLED";
      transfer.cancelledBy = getUserId(req);
      transfer.cancelledAt = cancellationDate;
      transfer.cancellationReason = reason;

      await transfer.save({ session });

      await updatePopulationTrackingStatus(
        currentFlock,
        session,
        getUserId(req),
      );

      return {
        transfer,
        source,
        destination,
        previousSourcePopulation,
        previousDestinationPopulation,
      };
    });

    await logAudit(req, {
      action: "STATUS_CHANGE",
      module: "Flock Transfers",
      description: `Cancelled transfer of ${result.transfer.birdsMoved} birds for ${flock.flockId}: ${result.transfer.fromPen} to ${result.transfer.toPen}`,
      entityId: result.transfer._id,
      entityName: `${flock.flockId}: ${result.transfer.fromPen} to ${result.transfer.toPen}`,
      before: {
        status: "COMPLETED",
        sourcePopulation: result.previousSourcePopulation,
        destinationPopulation: result.previousDestinationPopulation,
      },
      after: {
        status: "CANCELLED",
        cancellationReason: reason,
        cancelledAt: cancellationDate,
        sourcePopulation: result.source.currentBirds,
        destinationPopulation: result.destination.currentBirds,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Flock transfer cancelled successfully",
      transfer: result.transfer,
      flock: await getFlockWithAllocations(flock._id),
    });
  } catch (error) {
    const messages = {
      FLOCK_NOT_ACTIVE: {
        status: 400,
        message:
          "The flock is no longer active. This transfer cannot be cancelled.",
      },
      TRANSFER_NOT_FOUND: {
        status: 404,
        message: "Transfer not found for this flock.",
      },
      TRANSFER_ALREADY_CANCELLED: {
        status: 409,
        message: "This transfer has already been cancelled.",
      },
      TRANSFER_NOT_COMPLETED: {
        status: 400,
        message: "Only completed transfers can be cancelled.",
      },
      INVALID_TRANSFER_RECORD: {
        status: 400,
        message: "The transfer record is incomplete or invalid.",
      },
      TRANSFER_ALLOCATION_NOT_FOUND: {
        status: 400,
        message:
          "The original source or destination allocation could not be found.",
      },
      DESTINATION_NOT_AVAILABLE: {
        status: 400,
        message:
          "The destination allocation is no longer active or its population is unknown.",
      },
      INSUFFICIENT_DESTINATION_BIRDS: {
        status: 400,
        message:
          "The destination pen no longer has enough birds to reverse this transfer.",
      },
      SOURCE_CANNOT_BE_REOPENED: {
        status: 400,
        message:
          "The original source allocation was closed for a reason other than this transfer and cannot be reopened.",
      },
      SOURCE_POPULATION_UNKNOWN: {
        status: 400,
        message:
          "The source pen population is unknown. Resolve it before cancelling this transfer.",
      },
      EVENT_BEFORE_ALLOCATION: {
        status: 400,
        message:
          "The cancellation date cannot be earlier than the allocation date.",
      },
      BACKDATED_POPULATION_EVENT: {
        status: 400,
        message:
          "A later population event exists. The transfer cannot be cancelled without first resolving the population history.",
      },
    };

    const knownError = messages[error.message];

    if (knownError) {
      return res.status(knownError.status).json({
        success: false,
        message: knownError.message,
      });
    }

    return sendServerError(res, "Failed to cancel flock transfer", error);
  }
};

/*
|--------------------------------------------------------------------------
| GET FLOCK ALLOCATIONS
|--------------------------------------------------------------------------
| GET /api/flocks/:id/allocations
|--------------------------------------------------------------------------
*/

const getFlockAllocations = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flock ID",
      });
    }

    const flock = await getAccessibleFlock(id, req);

    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "Flock not found",
      });
    }

    const allocations = await FlockAllocation.find({
      flock: id,
    }).sort({ allocationDate: 1, createdAt: 1 });

    return res.status(200).json({
      success: true,
      count: allocations.length,
      allocations,
    });
  } catch (error) {
    return sendServerError(res, "Failed to fetch flock allocations", error);
  }
};

/*
|--------------------------------------------------------------------------
| GET FLOCK TRANSFERS
|--------------------------------------------------------------------------
| GET /api/flocks/:id/transfers
|--------------------------------------------------------------------------
*/

const getFlockTransfers = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flock ID",
      });
    }

    const flock = await getAccessibleFlock(id, req);

    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "Flock not found",
      });
    }

    const transfers = await FlockTransfer.find({ flock: id })
      .populate("fromAllocation")
      .populate("toAllocation")
      .populate("transferredBy", "name email")
      .populate("cancelledBy", "name email")
      .sort({ transferDate: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: transfers.length,
      transfers,
    });
  } catch (error) {
    return sendServerError(res, "Failed to fetch flock transfers", error);
  }
};

/*
|--------------------------------------------------------------------------
| GET FLOCK POPULATION HISTORY
|--------------------------------------------------------------------------
| GET /api/flocks/:id/population-history
|--------------------------------------------------------------------------
*/

const getFlockPopulationHistory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flock ID",
      });
    }

    const flock = await getAccessibleFlock(id, req);

    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "Flock not found",
      });
    }

    const history = await FlockPopulationHistory.find({ flock: id })
      .populate("allocation")
      .populate("createdBy", "name email")
      .sort({ eventDate: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: history.length,
      history,
    });
  } catch (error) {
    return sendServerError(
      res,
      "Failed to fetch flock population history",
      error,
    );
  }
};

/*
|--------------------------------------------------------------------------
| ADJUST FLOCK POPULATION
|--------------------------------------------------------------------------
| POST /api/flocks/:id/population-adjustments
|--------------------------------------------------------------------------
|
| Either:
| { "allocationId": "...", "newPopulation": 450 }
|
| Or:
| { "allocationId": "...", "quantityChange": -10 }
|--------------------------------------------------------------------------
*/

const createFlockPopulationAdjustment = async (req, res) => {
  try {
    const { id } = req.params;

    const { allocationId, newPopulation, quantityChange, remarks } = req.body;

    if (!isValidId(id) || !isValidId(allocationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flock or allocation ID",
      });
    }

    const hasNewPopulation =
      newPopulation !== undefined && newPopulation !== null;

    const hasQuantityChange =
      quantityChange !== undefined && quantityChange !== null;

    if (hasNewPopulation === hasQuantityChange) {
      return res.status(400).json({
        success: false,
        message:
          "Provide either a new population or a population change, not both.",
      });
    }

    if (hasNewPopulation && !isWholeNumber(newPopulation)) {
      return res.status(400).json({
        success: false,
        message: "New population must be a whole number of 0 or more",
      });
    }

    if (hasQuantityChange && !Number.isInteger(Number(quantityChange))) {
      return res.status(400).json({
        success: false,
        message: "Population change must be a whole number",
      });
    }

    const flock = await Flock.findById(id);

    if (!flock || flock.isDeleted || flock.status !== "ACTIVE") {
      return res.status(404).json({
        success: false,
        message: "Active flock not found",
      });
    }

    const result = await runTransaction(async (session) => {
      const allocation = await FlockAllocation.findOne({
        _id: allocationId,
        flock: id,
        status: "ACTIVE",
      }).session(session);

      if (!allocation) {
        throw new Error("ALLOCATION_NOT_FOUND");
      }

      const eventDate = new Date();

      await validateAllocationEventDate(allocation, eventDate, session);

      const previousPopulation = allocation.currentBirds;

      let nextPopulation;
      let delta;

      if (hasNewPopulation) {
        nextPopulation = Number(newPopulation);

        delta =
          previousPopulation === null || previousPopulation === undefined
            ? null
            : nextPopulation - previousPopulation;
      } else {
        if (previousPopulation === null || previousPopulation === undefined) {
          throw new Error("POPULATION_UNKNOWN");
        }

        delta = Number(quantityChange);
        nextPopulation = previousPopulation + delta;
      }

      if (nextPopulation < 0) {
        throw new Error("NEGATIVE_POPULATION");
      }

      allocation.currentBirds = nextPopulation;
      allocation.updatedBy = getUserId(req);

      await allocation.save({ session });

      const [history] = await FlockPopulationHistory.create(
        [
          {
            flock: flock._id,
            allocation: allocation._id,
            pen: allocation.pen,
            eventType: "ADJUSTMENT",
            quantityChange: delta,
            balanceAfter: nextPopulation,
            eventDate,
            sourceType: "ADJUSTMENT",
            sourceId: allocation._id,
            remarks:
              typeof remarks === "string" && remarks.trim()
                ? remarks.trim()
                : "Manual population adjustment",
            createdBy: getUserId(req),
          },
        ],
        { session },
      );

      await updatePopulationTrackingStatus(flock, session, getUserId(req));

      return {
        allocation,
        history,
        previousPopulation,
      };
    });

    await logAudit(req, {
      action: "UPDATE",
      module: "Flock Population",
      description: `Adjusted population for ${flock.flockId} in ${result.allocation.pen}`,
      entityId: result.allocation._id,
      entityName: `${flock.flockId} - ${result.allocation.pen}`,
      before: {
        currentBirds: result.previousPopulation,
      },
      after: {
        currentBirds: result.allocation.currentBirds,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Flock population adjusted successfully",
      allocation: result.allocation,
      history: result.history,
      flock: await getFlockWithAllocations(flock._id),
    });
  } catch (error) {
    const messages = {
      ALLOCATION_NOT_FOUND: "Active flock allocation not found",
      POPULATION_UNKNOWN:
        "This allocation has an unknown population. Set a new population first.",
      NEGATIVE_POPULATION:
        "The adjustment cannot result in a negative bird population.",
      EVENT_BEFORE_ALLOCATION:
        "The adjustment date cannot be earlier than the allocation date.",
      BACKDATED_POPULATION_EVENT:
        "The adjustment date is earlier than an existing population history entry.",
    };

    if (messages[error.message]) {
      return res.status(400).json({
        success: false,
        message: messages[error.message],
      });
    }

    return sendServerError(res, "Failed to adjust flock population", error);
  }
};

/*
|--------------------------------------------------------------------------
| SELL FLOCK / RECORD BIRD SALE
|--------------------------------------------------------------------------
| PATCH /api/flocks/:id/sell
|--------------------------------------------------------------------------
|
| Partial sale:
| {
|   "saleDate": "2026-11-23",
|   "allocationSales": [
|     { "allocationId": "...", "birdsSold": 100 }
|   ]
| }
|
| Full sale:
| {
|   "saleDate": "2026-11-23",
|   "sellAll": true
| }
|
| A full sale must be explicitly confirmed with sellAll: true.
|--------------------------------------------------------------------------
*/

const sellFlock = async (req, res) => {
  try {
    const { id } = req.params;

    const { saleDate, allocationSales, sellAll } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flock ID",
      });
    }

    if (sellAll !== undefined && typeof sellAll !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "sellAll must be true or false",
      });
    }

    if (sellAll === true && allocationSales !== undefined) {
      return res.status(400).json({
        success: false,
        message: "Provide either sellAll: true or allocationSales, not both.",
      });
    }

    if (
      sellAll !== true &&
      (!Array.isArray(allocationSales) || allocationSales.length === 0)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Provide allocationSales for a partial sale or explicitly set sellAll: true for a full sale.",
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

    const parsedSaleDate = saleDate ? parseDate(saleDate) : new Date();

    if (!parsedSaleDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale date",
      });
    }

    if (isFutureDate(parsedSaleDate)) {
      return res.status(400).json({
        success: false,
        message: "Sale date cannot be in the future",
      });
    }

    const beforeAudit = getFlockAuditSnapshot(flock);

    const result = await runTransaction(async (session) => {
      const allocations = await getActiveAllocations(flock._id, session);

      if (!allocations.length) {
        throw new Error("NO_ACTIVE_ALLOCATIONS");
      }

      if (sellAll === true) {
        if (
          allocations.some(
            (allocation) =>
              allocation.currentBirds === null ||
              allocation.currentBirds === undefined,
          )
        ) {
          throw new Error("UNKNOWN_POPULATION");
        }
      }

      let sales;

      if (sellAll === true) {
        sales = allocations
          .filter((allocation) => allocation.currentBirds > 0)
          .map((allocation) => ({
            allocationId: allocation._id.toString(),
            birdsSold: allocation.currentBirds,
          }));
      } else {
        sales = allocationSales;
      }

      const allocationMap = new Map(
        allocations.map((allocation) => [
          allocation._id.toString(),
          allocation,
        ]),
      );

      const seenAllocationIds = new Set();
      const processed = [];
      let totalSold = 0;

      for (const item of sales) {
        if (!item || !isValidId(item.allocationId)) {
          throw new Error("INVALID_SALE_ALLOCATION");
        }

        const allocationId = item.allocationId.toString();

        if (seenAllocationIds.has(allocationId)) {
          throw new Error("DUPLICATE_SALE_ALLOCATION");
        }

        seenAllocationIds.add(allocationId);

        if (!isPositiveWholeNumber(item.birdsSold)) {
          throw new Error("INVALID_SALE_QUANTITY");
        }

        const allocation = allocationMap.get(allocationId);

        if (!allocation) {
          throw new Error("SALE_ALLOCATION_NOT_FOUND");
        }

        if (
          allocation.currentBirds === null ||
          allocation.currentBirds === undefined
        ) {
          throw new Error("UNKNOWN_SALE_ALLOCATION_POPULATION");
        }

        const quantity = Number(item.birdsSold);

        if (quantity > allocation.currentBirds) {
          throw new Error("SALE_EXCEEDS_POPULATION");
        }

        await validateAllocationEventDate(allocation, parsedSaleDate, session);

        allocation.currentBirds -= quantity;
        allocation.updatedBy = getUserId(req);

        if (allocation.currentBirds === 0) {
          allocation.status = "CLOSED";
          allocation.closedAt = parsedSaleDate;
          allocation.closedReason = "SOLD";
        }

        await allocation.save({ session });

        await FlockPopulationHistory.create(
          [
            {
              flock: flock._id,
              allocation: allocation._id,
              pen: allocation.pen,
              eventType: "SALE",
              quantityChange: -quantity,
              balanceAfter: allocation.currentBirds,
              eventDate: parsedSaleDate,
              sourceType: "SALE",
              sourceId: flock._id,
              remarks: `Sold ${quantity} birds from ${allocation.pen}`,
              createdBy: getUserId(req),
            },
          ],
          { session },
        );

        totalSold += quantity;

        processed.push({
          allocationId: allocation._id,
          pen: allocation.pen,
          birdsSold: quantity,
          remainingBirds: allocation.currentBirds,
        });
      }

      // For an explicitly requested full sale, also close allocations
      // that already had a confirmed population of zero.
      if (sellAll === true) {
        for (const allocation of allocations) {
          if (allocation.status === "ACTIVE" && allocation.currentBirds === 0) {
            await validateAllocationEventDate(
              allocation,
              parsedSaleDate,
              session,
            );

            allocation.status = "CLOSED";
            allocation.closedAt = parsedSaleDate;
            allocation.closedReason = "SOLD";
            allocation.updatedBy = getUserId(req);

            await allocation.save({ session });
          }
        }
      }

      const remaining = await getActiveAllocations(flock._id, session);

      const fullyDepopulated =
        remaining.length === 0 ||
        remaining.every(
          (allocation) =>
            allocation.currentBirds !== null &&
            allocation.currentBirds !== undefined &&
            allocation.currentBirds === 0,
        );

      if (fullyDepopulated) {
        // Close any remaining confirmed-zero allocations.
        for (const allocation of remaining) {
          allocation.status = "CLOSED";
          allocation.closedAt = parsedSaleDate;
          allocation.closedReason = "SOLD";
          allocation.updatedBy = getUserId(req);

          await allocation.save({ session });
        }

        flock.status = "SOLD";
        flock.saleDate = parsedSaleDate;
        flock.soldBy = getUserId(req);
      }

      flock.updatedBy = getUserId(req);

      await flock.save({ session });

      await updatePopulationTrackingStatus(flock, session, getUserId(req));

      return {
        totalSold,
        fullyDepopulated,
        allocations: processed,
      };
    });

    await logAudit(req, {
      action: result.fullyDepopulated ? "STATUS_CHANGE" : "UPDATE",
      module: "Flocks",
      description: `Recorded sale of ${result.totalSold} birds from ${flock.flockId}`,
      entityId: flock._id,
      entityName: getFlockAuditName(flock),
      before: beforeAudit,
      after: getFlockAuditSnapshot(flock),
      metadata: {
        birdsSold: result.totalSold,
        fullyDepopulated: result.fullyDepopulated,
        saleDate: parsedSaleDate,
        allocationSales: result.allocations,
        sellAll: sellAll === true,
      },
    });

    return res.status(200).json({
      success: true,
      message: result.fullyDepopulated
        ? "Flock fully sold and marked as SOLD"
        : "Bird sale recorded successfully; flock remains ACTIVE",
      sale: {
        birdsSold: result.totalSold,
        saleDate: parsedSaleDate,
        fullyDepopulated: result.fullyDepopulated,
        allocations: result.allocations,
      },
      flock: await getFlockWithAllocations(flock._id),
    });
  } catch (error) {
    const messages = {
      NO_ACTIVE_ALLOCATIONS: "This flock has no active allocations to sell.",
      UNKNOWN_POPULATION:
        "The population of one or more allocations is unknown. Record the population before selling the entire flock.",
      UNKNOWN_SALE_ALLOCATION_POPULATION:
        "The selected allocation has an unknown population. Record its population before selling birds.",
      INVALID_SALE_ALLOCATION: "An invalid allocation ID was supplied.",
      DUPLICATE_SALE_ALLOCATION:
        "The same allocation cannot appear more than once in a sale.",
      INVALID_SALE_QUANTITY:
        "Each sale quantity must be a whole number greater than zero.",
      SALE_ALLOCATION_NOT_FOUND:
        "One of the selected allocations does not belong to this active flock.",
      SALE_EXCEEDS_POPULATION:
        "The number of birds sold cannot exceed the allocation's current population.",
      EVENT_BEFORE_ALLOCATION:
        "The sale date cannot be earlier than the allocation date.",
      BACKDATED_POPULATION_EVENT:
        "The sale date is earlier than an existing population history entry. Use the current date or correct the existing history first.",
    };

    if (messages[error.message]) {
      return res.status(400).json({
        success: false,
        message: messages[error.message],
      });
    }

    return sendServerError(res, "Failed to record flock sale", error);
  }
};

/*
|--------------------------------------------------------------------------
| SOFT DELETE FLOCK
|--------------------------------------------------------------------------
| DELETE /api/flocks/:id
|--------------------------------------------------------------------------
*/

const deleteFlock = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
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

    if (flock.status === "ACTIVE") {
      return res.status(400).json({
        success: false,
        message:
          "An active flock cannot be deleted. Sell or depopulate the flock first.",
      });
    }

    const beforeAudit = getFlockAuditSnapshot(flock);

    flock.isDeleted = true;
    flock.deletedAt = new Date();
    flock.deletedBy = getUserId(req);
    flock.updatedBy = getUserId(req);

    await flock.save();

    await logAudit(req, {
      action: "DELETE",
      module: "Flocks",
      description: `Deleted flock ${flock.flockId}`,
      entityId: flock._id,
      entityName: getFlockAuditName(flock),
      before: beforeAudit,
      after: getFlockAuditSnapshot(flock),
      metadata: {
        deletionType: "soft",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Flock deleted successfully",
      flock: buildFlockResponse(flock),
    });
  } catch (error) {
    return sendServerError(res, "Failed to delete flock", error);
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

    if (!isValidId(id)) {
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

    const beforeAudit = getFlockAuditSnapshot(flock);

    // Restore does not create a new allocation or overwrite history.
    flock.isDeleted = false;
    flock.deletedAt = null;
    flock.deletedBy = null;
    flock.updatedBy = getUserId(req);

    await flock.save();

    await logAudit(req, {
      action: "RESTORE",
      module: "Flocks",
      description: `Restored flock ${flock.flockId}`,
      entityId: flock._id,
      entityName: getFlockAuditName(flock),
      before: beforeAudit,
      after: getFlockAuditSnapshot(flock),
    });

    return res.status(200).json({
      success: true,
      message: "Flock restored successfully",
      flock: await getFlockWithAllocations(flock._id),
    });
  } catch (error) {
    return sendServerError(res, "Failed to restore flock", error);
  }
};

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  getFlocks,
  getFlock,
  getActiveFlockByPen,
  getPenOccupancySummary,
  createFlock,
  updateFlock,
  createFlockTransfer,
  cancelFlockTransfer,
  getFlockAllocations,
  getFlockTransfers,
  getFlockPopulationHistory,
  createFlockPopulationAdjustment,
  sellFlock,
  deleteFlock,
  restoreFlock,
  MAX_LAYING_AGE_WEEKS,
  PENS,
};
