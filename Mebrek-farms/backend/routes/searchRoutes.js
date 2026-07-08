const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { globalSearch } = require('../controllers/searchController');

router.get('/', protect, globalSearch);

module.exports = router;
