// =========================================
// SUPERADMIN ONLY MIDDLEWARE
// =========================================
//
// This middleware assumes that the `protect`
// middleware has already authenticated the user.
//
// Usage:
// router.get("/", protect, superadminOnly, controller);
//
// Only users with role "superadmin" are allowed.
//

const superadminOnly = (req, res, next) => {
  if (req.user?.role !== "superadmin") {
    return res.status(403).json({
      error: "Access denied. Superadmin privileges required.",
    });
  }

  next();
};

module.exports = {
  superadminOnly,
};
