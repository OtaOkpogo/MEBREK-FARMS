const Feed = require("../models/Feed");

exports.addStock = async ({
  feedName,
  quantity,
  unit,
  unitPrice,
  supplier,
}) => {
  let feed = await Feed.findOne({
    name: feedName,
    isDeleted: false,
  });

  if (feed) {
    feed.quantity += Number(quantity);
    feed.unit = unit;
    feed.pricePerUnit = Number(unitPrice);

    if (supplier) {
      feed.supplier = supplier;
    }

    await feed.save();
  } else {
    await Feed.create({
      name: feedName,
      quantity: Number(quantity),
      unit,
      pricePerUnit: Number(unitPrice),
      supplier,
    });
  }
};

exports.removeStock = async ({
  feedName,
  quantity,
}) => {
  const feed = await Feed.findOne({
    name: feedName,
    isDeleted: false,
  });

  if (!feed) return;

  feed.quantity = Math.max(
    0,
    feed.quantity - Number(quantity)
  );

  await feed.save();
};
