import { useEffect, useState } from "react";

import {
  getRooms,
  addItem,
  updateItem,
  deleteItem,
  transferItem,
  submitRoomAudit,
  getRoomReport,
  uploadItemPhoto,
  deleteItemPhoto,
} from "../services/roomInventoryService";

const CONDITIONS = ["excellent", "good", "fair", "poor", "damaged"];
const STATUSES = ["in_use", "in_storage", "missing", "transferred"];

export default function RoomInventory() {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState({
    name: "",
    category: "",
    condition: "good",
    status: "in_use",
    quantity: 1,
  });
  const [photoUploading, setPhotoUploading] = useState(false);

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferForm, setTransferForm] = useState({
    toRoomId: "",
    reason: "",
  });

  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditForm, setAuditForm] = useState({ score: "", notes: "" });

  const loadRooms = async () => {
    setLoading(true);
    try {
      // Your backend returns a flat array of inventory items
      const items = await getRooms();

      // Group items into rooms
      const groupedRooms = [];

      items.forEach((item) => {
        let room = groupedRooms.find((r) => r.name === item.roomName);

        if (!room) {
          room = {
            _id: item.roomName,
            name: item.roomName,
            type: item.roomType || "Room",
            items: [],
          };

          groupedRooms.push(room);
        }

        room.items.push({
          _id: item._id,
          name: item.itemName,
          category: item.category,
          quantity: item.quantity,
          condition: item.condition,
          status: item.status,
          serialNumber: item.serialNumber,
          purchaseDate: item.purchaseDate,
          purchaseValue: item.purchaseValue,
          remarks: item.remarks,
          assignedTo: item.assignedTo,
          history: item.history || [],
          photos: item.photos || [],
        });
      });

      setRooms(groupedRooms);

      if (groupedRooms.length > 0) {
        setSelectedRoom((prev) => {
          if (!prev) return groupedRooms[0];

          return (
            groupedRooms.find((r) => r._id === prev._id) || groupedRooms[0]
          );
        });
      } else {
        setSelectedRoom(null);
      }
    } catch (err) {
      console.error(err);
      setError("Couldn't load rooms. Try refreshing the page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  // Keep the modal's editingItem in sync after a reload (e.g. after photo upload)
  useEffect(() => {
    if (editingItem && selectedRoom) {
      const fresh = (selectedRoom.items || []).find(
        (i) => i._id === editingItem._id,
      );
      if (fresh) setEditingItem(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom]);

  // ---------- Item handlers ----------

  const openAddItem = () => {
    setEditingItem(null);
    setItemForm({
      name: "",
      category: "",
      condition: "good",
      status: "in_use",
      quantity: 1,
    });
    setItemModalOpen(true);
  };

  const openEditItem = (item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      category: item.category || "",
      condition: item.condition,
      status: item.status,
      quantity: item.quantity ?? 1,
    });
    setItemModalOpen(true);
  };

  const handleItemSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRoom) return;

    try {
      if (editingItem) {
        await updateItem(selectedRoom._id, editingItem._id, itemForm);
      } else {
        await addItem(selectedRoom._id, itemForm);
      }
      setItemModalOpen(false);
      await loadRooms();
    } catch (err) {
      console.error(err);
      setError("Couldn't save the item. Check the details and try again.");
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!selectedRoom) return;
    if (!window.confirm("Remove this item from the room?")) return;

    try {
      await deleteItem(selectedRoom._id, itemId);
      await loadRooms();
    } catch (err) {
      console.error(err);
      setError("Couldn't delete the item.");
    }
  };

  // ---------- Photo handlers ----------

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || !selectedRoom || !editingItem) return;

    setPhotoUploading(true);
    try {
      await uploadItemPhoto(selectedRoom._id, editingItem._id, file);
      await loadRooms();
    } catch (err) {
      console.error(err);
      setError(
        "Couldn't upload the photo. Try a smaller image or a different format.",
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!selectedRoom || !editingItem) return;
    if (!window.confirm("Remove this photo?")) return;

    try {
      await deleteItemPhoto(selectedRoom._id, editingItem._id, photoId);
      await loadRooms();
    } catch (err) {
      console.error(err);
      setError("Couldn't delete the photo.");
    }
  };

  // ---------- Transfer handlers ----------

  const openTransfer = (item) => {
    setTransferTarget(item);
    setTransferForm({ toRoomId: "", reason: "" });
    setTransferModalOpen(true);
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRoom || !transferTarget) return;

    try {
      await transferItem(transferTarget._id, {
        fromRoomId: selectedRoom._id,
        toRoomId: transferForm.toRoomId,
        reason: transferForm.reason,
      });
      setTransferModalOpen(false);
      await loadRooms();
    } catch (err) {
      console.error(err);
      setError("Couldn't transfer the item.");
    }
  };

  // ---------- Audit handlers ----------

  const handleAuditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRoom) return;

    try {
      await submitRoomAudit(selectedRoom._id, {
        score: Number(auditForm.score),
        notes: auditForm.notes,
      });
      setAuditModalOpen(false);
      setAuditForm({ score: "", notes: "" });
      await loadRooms();
    } catch (err) {
      console.error(err);
      setError("Couldn't submit the audit.");
    }
  };

  // ---------- Report ----------

  const handlePrintReport = async () => {
    if (!selectedRoom) return;
    try {
      const blob = await getRoomReport(selectedRoom._id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
      setError("Couldn't generate the report.");
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Loading rooms...</div>;
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">Room Inventory</h1>
        {selectedRoom && (
          <div className="flex gap-2">
            <button
              onClick={() => setAuditModalOpen(true)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
            >
              Log audit
            </button>
            <button
              onClick={handlePrintReport}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
            >
              Print report
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-medium">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Room list */}
        <div className="md:col-span-1 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm font-medium text-gray-500">
            Rooms ({rooms.length})
          </div>
          <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
            {rooms.map((room) => (
              <li key={room._id}>
                <button
                  onClick={() => setSelectedRoom(room)}
                  className={`w-full text-left px-4 py-3 text-sm transition ${
                    selectedRoom?._id === room._id
                      ? "bg-emerald-50 text-emerald-700 font-medium"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <div>{room.name}</div>
                  <div className="text-xs text-gray-400">
                    {room.type} · {room.items?.length || 0} items
                  </div>
                </button>
              </li>
            ))}
            {rooms.length === 0 && (
              <li className="px-4 py-6 text-sm text-gray-400 text-center">
                No rooms yet.
              </li>
            )}
          </ul>
        </div>

        {/* Room detail */}
        <div className="md:col-span-3 bg-white border border-gray-200 rounded-xl">
          {selectedRoom ? (
            <>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    {selectedRoom.name}
                  </h2>
                  <p className="text-xs text-gray-400 capitalize">
                    {selectedRoom.type}
                  </p>
                </div>
                <button
                  onClick={openAddItem}
                  className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700"
                >
                  Add item
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-100">
                      <th className="px-5 py-2 font-medium">Item</th>
                      <th className="px-5 py-2 font-medium">Category</th>
                      <th className="px-5 py-2 font-medium">Condition</th>
                      <th className="px-5 py-2 font-medium">Status</th>
                      <th className="px-5 py-2 font-medium">Qty</th>
                      <th className="px-5 py-2 font-medium">Photos</th>
                      <th className="px-5 py-2 font-medium text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(selectedRoom.items || []).map((item) => (
                      <tr key={item._id} className="text-gray-700">
                        <td className="px-5 py-3">{item.name}</td>
                        <td className="px-5 py-3 text-gray-500">
                          {item.category || "—"}
                        </td>
                        <td className="px-5 py-3 capitalize">
                          {item.condition}
                        </td>
                        <td className="px-5 py-3 capitalize">
                          {item.status?.replace("_", " ")}
                        </td>
                        <td className="px-5 py-3">{item.quantity}</td>
                        <td className="px-5 py-3">
                          {item.photos?.length ? (
                            <div className="flex -space-x-2">
                              {item.photos.slice(0, 3).map((p) => (
                                <img
                                  key={p._id || p.url}
                                  src={p.url}
                                  alt=""
                                  className="w-7 h-7 rounded-full border-2 border-white object-cover"
                                />
                              ))}
                              {item.photos.length > 3 && (
                                <span className="w-7 h-7 rounded-full border-2 border-white bg-gray-100 text-[10px] flex items-center justify-center text-gray-500">
                                  +{item.photos.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">None</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-3 text-xs">
                            <button
                              onClick={() => openEditItem(item)}
                              className="text-emerald-600 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openTransfer(item)}
                              className="text-blue-600 hover:underline"
                            >
                              Transfer
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item._id)}
                              className="text-red-500 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!selectedRoom.items ||
                      selectedRoom.items.length === 0) && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-5 py-8 text-center text-gray-400"
                        >
                          No items logged for this room yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-gray-400">
              Select a room to view its inventory.
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit item modal */}
      {itemModalOpen && (
        <Modal onClose={() => setItemModalOpen(false)}>
          <h3 className="text-lg font-semibold mb-4">
            {editingItem ? "Edit item" : "Add item"}
          </h3>
          <form onSubmit={handleItemSubmit} className="flex flex-col gap-3">
            <Field label="Name">
              <input
                required
                value={itemForm.name}
                onChange={(e) =>
                  setItemForm({ ...itemForm, name: e.target.value })
                }
                className="input"
              />
            </Field>
            <Field label="Category">
              <input
                value={itemForm.category}
                onChange={(e) =>
                  setItemForm({ ...itemForm, category: e.target.value })
                }
                className="input"
              />
            </Field>
            <Field label="Condition">
              <select
                value={itemForm.condition}
                onChange={(e) =>
                  setItemForm({ ...itemForm, condition: e.target.value })
                }
                className="input"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={itemForm.status}
                onChange={(e) =>
                  setItemForm({ ...itemForm, status: e.target.value })
                }
                className="input"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Quantity">
              <input
                type="number"
                min={1}
                value={itemForm.quantity}
                onChange={(e) =>
                  setItemForm({ ...itemForm, quantity: e.target.value })
                }
                className="input"
              />
            </Field>

            {/* Photos — only available once the item exists */}
            {editingItem ? (
              <div className="flex flex-col gap-2">
                <span className="text-sm text-gray-600">Photos</span>
                <div className="flex flex-wrap gap-2">
                  {(editingItem.photos || []).map((p) => (
                    <div key={p._id || p.url} className="relative">
                      <img
                        src={p.url}
                        alt=""
                        className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(p._id)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
                        title="Remove photo"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <label className="w-16 h-16 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs cursor-pointer hover:border-emerald-400 hover:text-emerald-500">
                    {photoUploading ? "…" : "+ Add"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoSelect}
                      disabled={photoUploading}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                Save the item first to attach photos.
              </p>
            )}

            <ModalActions
              onCancel={() => setItemModalOpen(false)}
              submitLabel={editingItem ? "Save changes" : "Add item"}
            />
          </form>
        </Modal>
      )}

      {/* Transfer modal */}
      {transferModalOpen && (
        <Modal onClose={() => setTransferModalOpen(false)}>
          <h3 className="text-lg font-semibold mb-4">
            Transfer "{transferTarget?.name}"
          </h3>
          <form onSubmit={handleTransferSubmit} className="flex flex-col gap-3">
            <Field label="Move to room">
              <select
                required
                value={transferForm.toRoomId}
                onChange={(e) =>
                  setTransferForm({
                    ...transferForm,
                    toRoomId: e.target.value,
                  })
                }
                className="input"
              >
                <option value="">Select a room</option>
                {rooms
                  .filter((r) => r._id !== selectedRoom?._id)
                  .map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Reason (optional)">
              <input
                value={transferForm.reason}
                onChange={(e) =>
                  setTransferForm({
                    ...transferForm,
                    reason: e.target.value,
                  })
                }
                className="input"
              />
            </Field>
            <ModalActions
              onCancel={() => setTransferModalOpen(false)}
              submitLabel="Confirm transfer"
            />
          </form>
        </Modal>
      )}

      {/* Audit modal */}
      {auditModalOpen && (
        <Modal onClose={() => setAuditModalOpen(false)}>
          <h3 className="text-lg font-semibold mb-4">
            Log audit for "{selectedRoom?.name}"
          </h3>
          <form onSubmit={handleAuditSubmit} className="flex flex-col gap-3">
            <Field label="Score (0-100)">
              <input
                required
                type="number"
                min={0}
                max={100}
                value={auditForm.score}
                onChange={(e) =>
                  setAuditForm({ ...auditForm, score: e.target.value })
                }
                className="input"
              />
            </Field>
            <Field label="Notes">
              <textarea
                rows={3}
                value={auditForm.notes}
                onChange={(e) =>
                  setAuditForm({ ...auditForm, notes: e.target.value })
                }
                className="input"
              />
            </Field>
            <ModalActions
              onCancel={() => setAuditModalOpen(false)}
              submitLabel="Submit audit"
            />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------- Small shared pieces ----------

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-5 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-gray-600">
      {label}
      {children}
    </label>
  );
}

function ModalActions({ onCancel, submitLabel }) {
  return (
    <div className="flex justify-end gap-2 mt-2">
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700"
      >
        {submitLabel}
      </button>
    </div>
  );
}
