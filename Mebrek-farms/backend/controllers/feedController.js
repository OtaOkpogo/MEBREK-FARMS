const Feed = require("../models/Feed");


// CREATE FEED
exports.createFeed = async (req, res) => {
  try {
    const feed = new Feed(req.body);

    await feed.save();

    res.json(feed);

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};


// GET ALL FEEDS
exports.getFeeds = async (req, res) => {
  try {
    const feeds = await Feed.find().sort({
      createdAt: -1,
    });

    res.json(feeds);

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};


// UPDATE FEED
exports.updateFeed = async (req, res) => {
  try {
    const feed = await Feed.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(feed);

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};


// DELETE FEED
exports.deleteFeed = async (req, res) => {
  try {
    await Feed.findByIdAndDelete(req.params.id);

    res.json({
      message: "Feed deleted",
    });

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};
