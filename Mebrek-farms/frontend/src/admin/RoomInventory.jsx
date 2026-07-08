import { useEffect, useState } from "react";
import {
  getRooms,
  addItem,
  updateItem,
  deleteItem,
} from "../services/roomInventoryService";

const CONDITIONS = ["Excellent", "Good", "Fair", "Damaged", "Needs Repair"];

const ROOM_TYPES = [
  "Staff Quarters",
  "Manager Residence",
  "Guest House",
  "Office",
  "Store",
  "Security Post",
  "Other",
];

const CATEGORIES = [
  "Furniture",
  "Electronics",
  "Appliances",
  "Kitchen",
  "Cleaning",
  "Bedding",
  "Tools",
  "Other",
];

// ===================== HELPERS =====================

function Badge({ children, color }) {
  const colors = {
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-700",
  };

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-semibold ${
        colors[color] || colors.gray
      }`}
    >
      {children}
    </span>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-white rounded-xl shadow border p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">{title}</p>

          <h2 className="text-3xl font-bold mt-2">{value}</h2>
        </div>

        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );
}

export default function RoomInventory() {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [form, setForm] = useState({
    roomName: "",
    roomType: "Staff Quarters",
    itemName: "",
    category: "Furniture",
    quantity: 1,
    condition: "Good",
    serialNumber: "",
    purchaseDate: "",
    purchaseValue: "",
    remarks: "",
  });

  // =========================
  // LOAD ROOMS
  // =========================

  const loadRooms = async () => {
    try {
      setLoading(true);

      const items = await getRooms();

      const grouped = {};

      (Array.isArray(items) ? items : []).forEach((item) => {
        if (!grouped[item.roomName]) {
          grouped[item.roomName] = {
            name: item.roomName,
            type: item.roomType,
            items: [],
          };
        }

        grouped[item.roomName].items.push(item);
      });

      const roomArray = Object.values(grouped);

      setRooms(roomArray);

      if (roomArray.length > 0) {
        setSelectedRoom(roomArray[0]);
      } else {
        setSelectedRoom(null);
      }

      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to load room inventory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  // =========================
  // ADD ITEM
  // =========================

  const openAddModal = () => {
    setEditingItem(null);

    setForm({
      roomName: selectedRoom?.name || "",
      roomType: selectedRoom?.type || "Staff Quarters",
      itemName: "",
      category: "Furniture",
      quantity: 1,
      condition: "Good",
      serialNumber: "",
      purchaseDate: "",
      purchaseValue: "",
      remarks: "",
    });

    setModalOpen(true);
  };

  // =========================
  // EDIT ITEM
  // =========================

  const openEditModal = (item) => {
    setEditingItem(item);

    setForm({
      roomName: item.roomName,
      roomType: item.roomType,
      itemName: item.itemName,
      category: item.category,
      quantity: item.quantity,
      condition: item.condition,
      serialNumber: item.serialNumber || "",
      purchaseDate: item.purchaseDate ? item.purchaseDate.substring(0, 10) : "",
      purchaseValue: item.purchaseValue || "",
      remarks: item.remarks || "",
    });

    setModalOpen(true);
  };

  // =========================
  // SAVE ITEM
  // =========================

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingItem) {
        await updateItem(editingItem._id, form);
      } else {
        await addItem(form);
      }

      setModalOpen(false);

      await loadRooms();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Unable to save item.");
    }
  };

  // =========================
  // DELETE ITEM
  // =========================

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this item?")) return;

    try {
      await deleteItem(id);

      await loadRooms();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Unable to delete item.");
    }
  };

  // =========================
  // SUMMARY STATS
  // (moved inside the component so they can read `rooms` state)
  // =========================

  const totalRooms = rooms.length;

  const totalItems = rooms.reduce((sum, room) => sum + room.items.length, 0);

  const totalValue = rooms.reduce(
    (sum, room) =>
      sum +
      room.items.reduce(
        (itemTotal, item) => itemTotal + Number(item.purchaseValue || 0),
        0,
      ),
    0,
  );

  if (loading) {
    return <div className="p-6 text-gray-500">Loading inventory...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Room Inventory</h1>

          <p className="text-gray-500">Manage all room assets.</p>
        </div>

        <button
          onClick={openAddModal}
          className="bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700"
        >
          + Add Item
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-100 text-red-700 p-3 rounded">{error}</div>
      )}

      {/* ================= SUMMARY STATS ================= */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <StatCard title="Rooms" value={totalRooms} icon="🏠" />

        <StatCard title="Inventory Items" value={totalItems} icon="📦" />

        <StatCard
          title="Inventory Value"
          value={`₦${totalValue.toLocaleString()}`}
          icon="💰"
        />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* ================= ROOMS ================= */}

        <div className="col-span-12 md:col-span-3 bg-white rounded-xl shadow border">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-700">Rooms</h2>
          </div>

          <div className="divide-y max-h-[650px] overflow-y-auto">
            {rooms.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                No rooms found.
              </div>
            ) : (
              rooms.map((room) => (
                <button
                  key={room.name}
                  onClick={() => setSelectedRoom(room)}
                  className={`w-full text-left p-4 transition

                    ${
                      selectedRoom?.name === room.name
                        ? "bg-emerald-50 border-l-4 border-emerald-600"
                        : "hover:bg-gray-50"
                    }

                  `}
                >
                  <h3 className="font-semibold text-gray-800">{room.name}</h3>

                  <p className="text-xs text-gray-500">{room.type}</p>

                  <p className="text-xs text-gray-400 mt-1">
                    {room.items.length} item(s)
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ================= ITEMS ================= */}

        <div className="col-span-12 md:col-span-9 bg-white rounded-xl shadow border">
          {selectedRoom ? (
            <>
              <div className="flex justify-between items-center p-5 border-b">
                <div>
                  <h2 className="text-xl font-semibold">{selectedRoom.name}</h2>

                  <p className="text-sm text-gray-500">{selectedRoom.type}</p>
                </div>

                <button
                  onClick={openAddModal}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg"
                >
                  Add Item
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3">Item</th>

                      <th className="text-left p-3">Category</th>

                      <th className="text-left p-3">Condition</th>

                      <th className="text-left p-3">Qty</th>

                      <th className="text-left p-3">Purchase Value</th>

                      <th className="text-center p-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedRoom.items.length === 0 ? (
                      <tr>
                        <td
                          colSpan="6"
                          className="text-center py-8 text-gray-400"
                        >
                          No inventory items found.
                        </td>
                      </tr>
                    ) : (
                      selectedRoom.items.map((item) => (
                        <tr
                          key={item._id}
                          className="border-t hover:bg-gray-50"
                        >
                          <td className="p-3">
                            <div className="font-medium">{item.itemName}</div>

                            <div className="text-xs text-gray-500">
                              {item.serialNumber || "No Serial Number"}
                            </div>
                          </td>

                          <td className="p-3">{item.category}</td>

                          <td className="p-3">
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold

                              ${
                                item.condition === "Excellent"
                                  ? "bg-green-100 text-green-700"
                                  : item.condition === "Good"
                                    ? "bg-blue-100 text-blue-700"
                                    : item.condition === "Fair"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-red-100 text-red-700"
                              }

                              `}
                            >
                              {item.condition}
                            </span>
                          </td>

                          <td className="p-3">{item.quantity}</td>

                          <td className="p-3">
                            ₦{Number(item.purchaseValue || 0).toLocaleString()}
                          </td>

                          <td className="p-3">
                            <div className="flex justify-center gap-3">
                              <button
                                onClick={() => openEditModal(item)}
                                className="text-blue-600 hover:underline"
                              >
                                Edit
                              </button>

                              <button
                                onClick={() => handleDelete(item._id)}
                                className="text-red-600 hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-gray-400">
              Select a room from the left.
            </div>
          )}
        </div>
      </div>
      {/* ================= ADD / EDIT MODAL ================= */}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {editingItem ? "Edit Item" : "Add New Item"}
              </h2>

              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-500 hover:text-red-500 text-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              {/* ROOM */}

              <div>
                <label className="block mb-1 text-sm font-medium">
                  Room Name
                </label>

                <input
                  required
                  value={form.roomName}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      roomName: e.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              {/* ROOM TYPE */}

              <div>
                <label className="block mb-1 text-sm font-medium">
                  Room Type
                </label>

                <select
                  value={form.roomType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      roomType: e.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {ROOM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* ITEM */}

              <div>
                <label className="block mb-1 text-sm font-medium">
                  Item Name
                </label>

                <input
                  required
                  value={form.itemName}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      itemName: e.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              {/* CATEGORY */}

              <div>
                <label className="block mb-1 text-sm font-medium">
                  Category
                </label>

                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category: e.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* QUANTITY */}

              <div>
                <label className="block mb-1 text-sm font-medium">
                  Quantity
                </label>

                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      quantity: Number(e.target.value),
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              {/* CONDITION */}

              <div>
                <label className="block mb-1 text-sm font-medium">
                  Condition
                </label>

                <select
                  value={form.condition}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      condition: e.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {CONDITIONS.map((condition) => (
                    <option key={condition} value={condition}>
                      {condition}
                    </option>
                  ))}
                </select>
              </div>

              {/* SERIAL */}

              <div>
                <label className="block mb-1 text-sm font-medium">
                  Serial Number
                </label>

                <input
                  value={form.serialNumber}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      serialNumber: e.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              {/* PURCHASE DATE */}

              <div>
                <label className="block mb-1 text-sm font-medium">
                  Purchase Date
                </label>

                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      purchaseDate: e.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              {/* PURCHASE VALUE */}

              <div>
                <label className="block mb-1 text-sm font-medium">
                  Purchase Value
                </label>

                <input
                  type="number"
                  value={form.purchaseValue}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      purchaseValue: e.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              {/* REMARKS */}

              <div className="col-span-2">
                <label className="block mb-1 text-sm font-medium">
                  Remarks
                </label>

                <textarea
                  rows={4}
                  value={form.remarks}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      remarks: e.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div className="col-span-2 flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2 rounded-lg border"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {editingItem ? "Update Item" : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
