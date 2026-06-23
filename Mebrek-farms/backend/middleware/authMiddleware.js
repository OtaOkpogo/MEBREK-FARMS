const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    console.log("==== AUTH CHECK ====");

    const authHeader = req.headers.authorization;

    console.log("Authorization:", authHeader);

    if (!authHeader) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];

    console.log("Token:", token);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log("Decoded:", decoded);

    req.admin = decoded;

    next();
  } catch (err) {
    console.log("JWT ERROR:", err);

    return res.status(400).json({
      message: err.message,
    });
  }
};
