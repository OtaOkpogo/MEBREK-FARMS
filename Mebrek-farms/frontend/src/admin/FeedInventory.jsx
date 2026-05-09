import { useEffect, useState } from "react";

import {
  fetchFeeds,
  createFeed,
  deleteFeed,
} from "../services/feedService";

export default function FeedInventory() {
  const [feeds, setFeeds] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    quantity: "",
    unit: "bags",
    pricePerUnit: "",
    supplier: "",
  });

  useEffect(() => {
    loadFeeds();
  }, []);

  const loadFeeds = async () => {
    try {
      const data = await fetchFeeds();

      setFeeds(data);

    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await createFeed(formData);

      setFormData({
        name: "",
        quantity: "",
        unit: "bags",
        pricePerUnit: "",
        supplier: "",
      });

      loadFeeds();

    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteFeed(id);

      loadFeeds();

    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">
        🌽 Feed Inventory
      </h1>

      {/* FORM */}
      <form
        onSubmit={handleSubmit}
        className="grid md:grid-cols-2 gap-4 mb-8"
      >

        <input
          type="text"
          placeholder="Feed Name"
          value={formData.name}
          onChange={(e) =>
            setFormData({
              ...formData,
              name: e.target.value,
            })
          }
          className="border p-3 rounded-lg"
        />

        <input
          type="number"
          placeholder="Quantity"
          value={formData.quantity}
          onChange={(e) =>
            setFormData({
              ...formData,
              quantity: e.target.value,
            })
          }
          className="border p-3 rounded-lg"
        />

        <input
          type="number"
          placeholder="Price Per Unit"
          value={formData.pricePerUnit}
          onChange={(e) =>
            setFormData({
              ...formData,
              pricePerUnit: e.target.value,
            })
          }
          className="border p-3 rounded-lg"
        />

        <input
          type="text"
          placeholder="Supplier"
          value={formData.supplier}
          onChange={(e) =>
            setFormData({
              ...formData,
              supplier: e.target.value,
            })
          }
          className="border p-3 rounded-lg"
        />

        <button className="bg-green-600 text-white py-3 rounded-lg">
          Add Feed
        </button>

      </form>

      {/* TABLE */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">

        <table className="w-full">

          <thead className="bg-green-600 text-white">

            <tr>
              <th className="p-3">Feed</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Supplier</th>
              <th>Status</th>
              <th>Action</th>
            </tr>

          </thead>

          <tbody>

            {feeds.map((feed) => (

              <tr
                key={feed._id}
                className="border-b"
              >

                <td className="p-3">
                  {feed.name}
                </td>

                <td>
                  {feed.quantity} {feed.unit}
                </td>

                <td>
                  ₦{feed.pricePerUnit}
                </td>

                <td>
                  {feed.supplier}
                </td>

                <td>
                  {feed.quantity <= feed.lowStockThreshold ? (
                    <span className="text-red-600 font-bold">
                      Low Stock
                    </span>
                  ) : (
                    <span className="text-green-600">
                      In Stock
                    </span>
                  )}
                </td>

                <td>
                  <button
                    onClick={() =>
                      handleDelete(feed._id)
                    }
                    className="bg-red-500 text-white px-3 py-1 rounded"
                  >
                    Delete
                  </button>
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}
