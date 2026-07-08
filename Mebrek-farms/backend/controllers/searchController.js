const Staff = require('../models/Staff'); // adjust name to your actual model
const Production = require('../models/Production');
const EggSale = require('../models/EggSale');
const FeedInventory = require('../models/FeedInventory');
const RoomInventory = require('../models/RoomInventory');
const Notification = require('../models/Notification');

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.globalSearch = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({
        workers: [], production: [], eggSales: [],
        feedInventory: [], roomInventory: [], notifications: []
      });
    }

    const rx = new RegExp(escapeRegex(q), 'i');
    const role = req.user.role; // from protect middleware
    const LIMIT = 5;

    // Build query list conditionally based on role
    const queries = {
      workers: role === 'staff' ? null : Staff.find({
        $or: [{ name: rx }, { email: rx }, { role: rx }]
      }).select('name email role').limit(LIMIT),

      production: Production.find({
        $or: [{ pen: rx }, { remarks: rx }]
      }).select('pen date remarks').limit(LIMIT),

      eggSales: EggSale.find({
        $or: [{ customerName: rx }, { phone: rx }, { paymentStatus: rx }, { remarks: rx }]
      }).select('customerName phone paymentStatus amount').limit(LIMIT),

      feedInventory: FeedInventory.find({
        $or: [{ feedName: rx }, { category: rx }, { supplier: rx }]
      }).select('feedName category supplier').limit(LIMIT),

      roomInventory: RoomInventory.find({
        isDeleted: { $ne: true },
        $or: [{ roomName: rx }, { itemName: rx }, { category: rx }, { serialNumber: rx }]
      }).select('roomName itemName category serialNumber').limit(LIMIT),

      notifications: Notification.find({
        $or: [{ subject: rx }, { message: rx }, { senderName: rx }],
        ...(role === 'staff' ? { recipients: req.user._id } : {})
      }).select('subject message senderName createdAt').limit(LIMIT),
    };

    const keys = Object.keys(queries).filter(k => queries[k] !== null);
    const results = await Promise.all(keys.map(k => queries[k]));

    const response = {
      workers: [], production: [], eggSales: [],
      feedInventory: [], roomInventory: [], notifications: []
    };
    keys.forEach((k, i) => { response[k] = results[i]; });

    res.json(response);
  } catch (err) {
    console.error('Global search error:', err);
    res.status(500).json({ message: 'Search failed' });
  }
};
