import { useEffect, useMemo, useState } from "react";

import {
  fetchWarehouse,
  createWarehouseItem,
  updateWarehouseItem,
  deleteWarehouseItem,
  restoreWarehouseItem,
} from "../services/warehouseService";

export default function Warehouse() {
  const role = localStorage.getItem("role");

  const canDelete = role === "superadmin" || role === "manager";

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState([]);

  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState(null);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    itemName: "",
    category: "",
    quantity: "",
    unit: "bags",
    location: "",
    status: "In Stock",
  });

  // ================= LOAD =================

  const loadWarehouse = async () => {
    try {
      setLoading(true);

      const data = await fetchWarehouse();

      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message || "Failed to load warehouse inventory.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWarehouse();
  }, []);

  // ================= INPUT =================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: name === "quantity" ? Number(value) : value,
    }));
  };

  // ================= CREATE / UPDATE =================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setSaving(true);

    setError("");

    setSuccess("");

    try {
      if (editingId) {
        await updateWarehouseItem(editingId, formData);

        setSuccess("Warehouse item updated successfully.");
      } else {
        await createWarehouseItem(formData);

        setSuccess("Warehouse item added successfully.");
      }

      setFormData({
        itemName: "",
        category: "",
        quantity: "",
        unit: "bags",
        location: "",
        status: "In Stock",
      });

      setEditingId(null);

      await loadWarehouse();
    } catch (err) {
      console.error(err);

      setError(err.response?.data?.message || "Unable to save warehouse item.");
    } finally {
      setSaving(false);
    }
  };

  // ================= EDIT =================

  const handleEdit = (item) => {
    setEditingId(item._id);

    setFormData({
      itemName: item.itemName || "",
      category: item.category || "",
      quantity: item.quantity || "",
      unit: item.unit || "bags",
      location: item.location || "",
      status: item.status || "In Stock",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ================= DELETE =================

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this warehouse item?")) return;

    try {
      await deleteWarehouseItem(id);

      setSuccess("Warehouse item deleted.");

      await loadWarehouse();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message || "Failed to delete warehouse item.",
      );
    }
  };

  // ================= RESTORE =================

  const handleRestore = async (id) => {
    if (!window.confirm("Restore this warehouse item?")) return;

    try {
      await restoreWarehouseItem(id);

      setSuccess("Warehouse item restored.");

      await loadWarehouse();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message || "Failed to restore warehouse item.",
      );
    }
  };

  // ================= SEARCH =================

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const keyword = search.toLowerCase();

      return (
        item.itemName?.toLowerCase().includes(keyword) ||
        item.category?.toLowerCase().includes(keyword) ||
        item.location?.toLowerCase().includes(keyword) ||
        item.status?.toLowerCase().includes(keyword)
      );
    });
  }, [items, search]);

  // ================= SUMMARY =================

  const totalItems = filteredItems.length;

  const totalQuantity = filteredItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );

  const inStock = filteredItems.filter(
    (item) => item.status === "In Stock",
  ).length;

  const lowStock = filteredItems.filter(
    (item) => item.status === "Low Stock",
  ).length;

  const outOfStock = filteredItems.filter(
    (item) => item.status === "Out of Stock",
  ).length;
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* HEADER */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-green-700">
            Warehouse Management
          </h1>

          <p className="text-gray-500 mt-2">
            Manage warehouse inventory, monitor stock levels and update items.
          </p>
        </div>
      </div>

      {/* SUMMARY CARDS */}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-8">
        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-gray-500 text-sm">Total Items</p>

          <h2 className="text-3xl font-bold text-green-700 mt-2">
            {totalItems}
          </h2>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-gray-500 text-sm">Total Quantity</p>

          <h2 className="text-3xl font-bold text-blue-600 mt-2">
            {totalQuantity}
          </h2>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-gray-500 text-sm">In Stock</p>

          <h2 className="text-3xl font-bold text-green-600 mt-2">{inStock}</h2>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-gray-500 text-sm">Low Stock</p>

          <h2 className="text-3xl font-bold text-yellow-500 mt-2">
            {lowStock}
          </h2>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-gray-500 text-sm">Out Of Stock</p>

          <h2 className="text-3xl font-bold text-red-600 mt-2">{outOfStock}</h2>
        </div>
      </div>

      {/* ALERTS */}

      {success && (
        <div className="mb-6 bg-green-100 border border-green-300 text-green-700 px-5 py-4 rounded-xl">
          {success}
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-100 border border-red-300 text-red-700 px-5 py-4 rounded-xl">
          {error}
        </div>
      )}

      {/* FORM */}

      <div className="bg-white rounded-2xl shadow p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {editingId ? "Edit Warehouse Item" : "Add Warehouse Item"}
          </h2>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          <input
            type="text"
            name="itemName"
            placeholder="Item Name"
            value={formData.itemName}
            onChange={handleChange}
            required
            className="border rounded-xl p-3 focus:ring-2 focus:ring-green-600 outline-none"
          />

          <input
            type="text"
            name="category"
            placeholder="Category"
            value={formData.category}
            onChange={handleChange}
            required
            className="border rounded-xl p-3 focus:ring-2 focus:ring-green-600 outline-none"
          />

          <input
            type="number"
            name="quantity"
            placeholder="Quantity"
            value={formData.quantity}
            onChange={handleChange}
            required
            className="border rounded-xl p-3 focus:ring-2 focus:ring-green-600 outline-none"
          />

          <input
            type="text"
            name="unit"
            placeholder="Unit"
            value={formData.unit}
            onChange={handleChange}
            className="border rounded-xl p-3 focus:ring-2 focus:ring-green-600 outline-none"
          />

          <input
            type="text"
            name="location"
            placeholder="Storage Location"
            value={formData.location}
            onChange={handleChange}
            className="border rounded-xl p-3 focus:ring-2 focus:ring-green-600 outline-none"
          />

          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="border rounded-xl p-3 focus:ring-2 focus:ring-green-600 outline-none"
          >
            <option>In Stock</option>
            <option>Low Stock</option>
            <option>Out of Stock</option>
          </select>

          <div className="md:col-span-2 lg:col-span-3 flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-green-700 hover:bg-green-800 text-white px-8 py-3 rounded-xl transition"
            >
              {saving ? "Saving..." : editingId ? "Update Item" : "Add Item"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);

                  setFormData({
                    itemName: "",
                    category: "",
                    quantity: "",
                    unit: "bags",
                    location: "",
                    status: "In Stock",
                  });
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-3 rounded-xl transition"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* SEARCH */}

      <div className="bg-white rounded-2xl shadow p-5 mb-6">
        <input
          type="text"
          placeholder="Search warehouse inventory..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-green-600 outline-none"
        />
      </div>
      {/* INVENTORY TABLE */}

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="px-6 py-5 border-b flex items-center justify-between">
          <h2 className="text-2xl font-bold">Warehouse Inventory</h2>

          <span className="text-sm text-gray-500">
            {filteredItems.length} item
            {filteredItems.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-500">
            Loading warehouse inventory...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            No warehouse items found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="px-6 py-4 font-semibold">Item</th>

                  <th className="px-6 py-4 font-semibold">Category</th>

                  <th className="px-6 py-4 font-semibold">Quantity</th>

                  <th className="px-6 py-4 font-semibold">Unit</th>

                  <th className="px-6 py-4 font-semibold">Location</th>

                  <th className="px-6 py-4 font-semibold">Status</th>

                  {role === "superadmin" && (
                    <th className="px-6 py-4 font-semibold">Deleted By</th>
                  )}

                  <th className="px-6 py-4 font-semibold text-center">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item._id}
                    className={`border-t hover:bg-gray-50 transition ${
                      item.isDeleted ? "bg-red-50 text-gray-500" : ""
                    }`}
                  >
                    <td className="px-6 py-4 font-medium">
                      {item.itemName}
                      {item.isDeleted && (
                        <span className="ml-2 bg-red-600 text-white px-2 py-1 rounded text-xs">
                          Deleted
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">{item.category}</td>

                    <td className="px-6 py-4">{item.quantity}</td>

                    <td className="px-6 py-4">{item.unit}</td>

                    <td className="px-6 py-4">{item.location || "-"}</td>

                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium
      ${
        item.status === "In Stock"
          ? "bg-green-100 text-green-700"
          : item.status === "Low Stock"
            ? "bg-yellow-100 text-yellow-700"
            : "bg-red-100 text-red-700"
      }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    {role === "superadmin" && (
                      <td className="px-6 py-4">
                        {item.isDeleted ? (
                          <div>
                            <div className="font-semibold text-red-600 capitalize">
                              {item.deletedBy}
                            </div>

                            <div className="text-xs text-gray-500">
                              {item.deletedAt
                                ? new Date(item.deletedAt).toLocaleString()
                                : "-"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )}

                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-3">
                        {!item.isDeleted && (
                          <button
                            onClick={() => handleEdit(item)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                          >
                            Edit
                          </button>
                        )}

                        {canDelete && !item.isDeleted && (
                          <button
                            onClick={() => handleDelete(item._id)}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
                          >
                            Delete
                          </button>
                        )}

                        {role === "superadmin" && item.isDeleted && (
                          <button
                            onClick={() => handleRestore(item._id)}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
