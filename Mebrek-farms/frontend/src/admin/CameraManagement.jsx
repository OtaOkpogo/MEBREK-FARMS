import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import {
  fetchCameras,
  createCamera,
  updateCamera,
  disableCamera,
  enableCamera,
  deleteCamera,
} from "../services/cameraService";

import { PENS } from "../constants/pens";
import socket from "../services/socket";

const emptyForm = {
  name: "",
  pen: "",
  channel: "",
  location: "",
  description: "",
};

export default function CameraManagement() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState(emptyForm);
  const [editingCamera, setEditingCamera] = useState(null);
  const [search, setSearch] = useState("");

  // =========================================
  // LOAD CAMERAS
  // =========================================

  const loadCameras = async () => {
    try {
      setLoading(true);

      const data = await fetchCameras();

      setCameras(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("LOAD CAMERAS ERROR:", error);

      toast.error(error.response?.data?.error || "Failed to load cameras");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCameras();
  }, []);

  // =========================================
  // SOCKET LIVE UPDATES
  // =========================================

  useEffect(() => {
    const handleCreated = (camera) => {
      setCameras((prev) => [camera, ...prev]);

      toast.success(`Camera "${camera.name}" added`);
    };

    const handleUpdated = (camera) => {
      setCameras((prev) =>
        prev.map((item) => (item._id === camera._id ? camera : item)),
      );
    };

    const handleDisabled = (data) => {
      const camera = data.camera || data;

      setCameras((prev) =>
        prev.map((item) => (item._id === camera._id ? camera : item)),
      );

      toast.info(`Camera "${camera.name}" disabled`);
    };

    const handleEnabled = (data) => {
      const camera = data.camera || data;

      setCameras((prev) =>
        prev.map((item) => (item._id === camera._id ? camera : item)),
      );

      toast.success(`Camera "${camera.name}" enabled`);
    };

    const handleDeleted = (camera) => {
      setCameras((prev) => prev.filter((item) => item._id !== camera._id));

      toast.warning(`Camera "${camera.name}" deleted`);
    };

    socket.on("cameraCreated", handleCreated);
    socket.on("cameraUpdated", handleUpdated);
    socket.on("cameraDisabled", handleDisabled);
    socket.on("cameraEnabled", handleEnabled);
    socket.on("cameraDeleted", handleDeleted);

    return () => {
      socket.off("cameraCreated", handleCreated);
      socket.off("cameraUpdated", handleUpdated);
      socket.off("cameraDisabled", handleDisabled);
      socket.off("cameraEnabled", handleEnabled);
      socket.off("cameraDeleted", handleDeleted);
    };
  }, []);

  // =========================================
  // FORM HANDLING
  // =========================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =========================================
  // RESET FORM
  // =========================================

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingCamera(null);
  };

  // =========================================
  // SUBMIT
  // =========================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);

      const payload = {
        ...formData,
        channel: Number(formData.channel),
      };

      if (editingCamera) {
        const updated = await updateCamera(editingCamera._id, payload);

        setCameras((prev) =>
          prev.map((item) => (item._id === updated._id ? updated : item)),
        );

        toast.success("Camera updated successfully.");
      } else {
        const created = await createCamera(payload);

        setCameras((prev) => [created, ...prev]);

        toast.success("Camera added successfully.");
      }

      resetForm();
    } catch (error) {
      console.error("SAVE CAMERA ERROR:", error);

      toast.error(error.response?.data?.error || "Failed to save camera");
    } finally {
      setSaving(false);
    }
  };

  // =========================================
  // EDIT
  // =========================================

  const handleEdit = (camera) => {
    setEditingCamera(camera);
    setFormData({
      name: camera.name || "",
      pen: camera.pen || "",
      channel: camera.channel || "",
      location: camera.location || "",
      description: camera.description || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =========================================
  // ENABLE / DISABLE
  // =========================================

  const handleToggle = async (camera) => {
    try {
      let result;

      if (camera.isEnabled) {
        result = await disableCamera(camera._id);

        toast.success("Camera disabled.");
      } else {
        result = await enableCamera(camera._id);

        toast.success("Camera enabled.");
      }

      const updatedCamera = result.camera;

      setCameras((prev) =>
        prev.map((item) =>
          item._id === updatedCamera._id ? updatedCamera : item,
        ),
      );
    } catch (error) {
      console.error("TOGGLE CAMERA ERROR:", error);

      toast.error(
        error.response?.data?.error || "Failed to update camera status",
      );
    }
  };

  // =========================================
  // DELETE
  // =========================================

  const handleDelete = async (camera) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${camera.name}"?`,
    );

    if (!confirmed) return;

    try {
      await deleteCamera(camera._id);

      setCameras((prev) => prev.filter((item) => item._id !== camera._id));

      toast.success("Camera deleted successfully.");
    } catch (error) {
      console.error("DELETE CAMERA ERROR:", error);

      toast.error(error.response?.data?.error || "Failed to delete camera");
    }
  };

  // =========================================
  // FILTER
  // =========================================

  const filteredCameras = cameras.filter((camera) => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) return true;

    return (
      camera.name?.toLowerCase().includes(keyword) ||
      camera.pen?.toLowerCase().includes(keyword) ||
      camera.location?.toLowerCase().includes(keyword) ||
      String(camera.channel).includes(keyword)
    );
  });

  // =========================================
  // LOADING
  // =========================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        {" "}
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />{" "}
      </div>
    );
  }

  // =========================================
  // RENDER
  // =========================================

  return (
    <div className="p-6">
      {/* HEADER */}

      <div className="mb-6">
        <h1 className="text-3xl font-bold">📹 Farm CCTV Camera Management</h1>

        <p className="text-gray-500 mt-1">
          Manage the 44 Hikvision farm cameras.
        </p>
      </div>

      {/* STATISTICS */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500 text-sm">Total Cameras</p>

          <p className="text-3xl font-bold text-green-600">{cameras.length}</p>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500 text-sm">Enabled</p>

          <p className="text-3xl font-bold text-blue-600">
            {cameras.filter((camera) => camera.isEnabled).length}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500 text-sm">Disabled</p>

          <p className="text-3xl font-bold text-red-600">
            {cameras.filter((camera) => !camera.isEnabled).length}
          </p>
        </div>
      </div>

      {/* CAMERA FORM */}

      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-bold">
            {editingCamera ? "Edit Camera" : "Add Camera"}
          </h2>

          {editingCamera && (
            <button
              type="button"
              onClick={resetForm}
              className="text-gray-600 hover:text-gray-900"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Camera Name"
            className="border p-3 rounded-lg"
            required
          />

          <select
            name="pen"
            value={formData.pen}
            onChange={handleChange}
            className="border p-3 rounded-lg"
            required
          >
            <option value="">Select Pen</option>

            {PENS.map((pen) => (
              <option key={pen} value={pen}>
                {pen}
              </option>
            ))}
          </select>

          <input
            type="number"
            name="channel"
            value={formData.channel}
            onChange={handleChange}
            placeholder="NVR Channel"
            min="1"
            className="border p-3 rounded-lg"
            required
          />

          <input
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder="Camera Location"
            className="border p-3 rounded-lg"
          />

          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Camera Description"
            rows="2"
            className="border p-3 rounded-lg md:col-span-3"
          />

          <button
            type="submit"
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg md:col-span-3 disabled:opacity-60"
          >
            {saving
              ? "Saving..."
              : editingCamera
                ? "Update Camera"
                : "Add Camera"}
          </button>
        </form>
      </div>

      {/* SEARCH */}

      <div className="mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cameras by name, pen, location, or channel..."
          className="w-full border p-3 rounded-lg"
        />
      </div>

      {/* CAMERAS */}

      {filteredCameras.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <div className="text-6xl mb-4">📹</div>

          <h2 className="text-xl font-bold">No cameras found</h2>

          <p className="text-gray-500 mt-2">
            Add your first farm camera above.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-green-600 text-white">
              <tr>
                <th className="p-3 text-left">Camera</th>

                <th className="p-3 text-left">Pen</th>

                <th className="p-3 text-left">Channel</th>

                <th className="p-3 text-left">Location</th>

                <th className="p-3 text-left">Status</th>

                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredCameras.map((camera) => (
                <tr key={camera._id} className="border-b hover:bg-green-50">
                  <td className="p-3 font-semibold">{camera.name}</td>

                  <td className="p-3">{camera.pen}</td>

                  <td className="p-3">Channel {camera.channel}</td>

                  <td className="p-3">{camera.location || "-"}</td>

                  <td className="p-3">
                    {camera.isEnabled ? (
                      <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                        Enabled
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                        Disabled
                      </span>
                    )}
                  </td>

                  <td className="p-3">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleEdit(camera)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => handleToggle(camera)}
                        className={`text-white px-3 py-2 rounded ${
                          camera.isEnabled
                            ? "bg-orange-500 hover:bg-orange-600"
                            : "bg-green-600 hover:bg-green-700"
                        }`}
                      >
                        {camera.isEnabled ? "Disable" : "Enable"}
                      </button>

                      <button
                        onClick={() => handleDelete(camera)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
