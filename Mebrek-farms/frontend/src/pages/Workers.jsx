import { useEffect, useState } from "react";

import {
  fetchWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
} from "../services/workerService";

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    role: "",
    salary: "",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    try {
      setLoading(true);
      const res = await fetchWorkers();

      setWorkers(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load workers");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingId) {
        await updateWorker(editingId, formData);
        setEditingId(null);
      } else {
        await createWorker(formData);
      }

      setFormData({ name: "", role: "", salary: "" });
      loadWorkers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (worker) => {
    setFormData({
      name: worker?.name || "",
      role: worker?.role || "",
      salary: worker?.salary || "",
    });
    setEditingId(worker?._id);
  };

  const handleDelete = async (id) => {
    await deleteWorker(id);
    loadWorkers();
  };

  if (loading) return <div className="p-6">Loading workers...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">Workers</h1>

      {/* FORM */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          value={formData.name}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value })
          }
          placeholder="Name"
        />

        <input
          value={formData.role}
          onChange={(e) =>
            setFormData({ ...formData, role: e.target.value })
          }
          placeholder="Role"
        />

        <input
          value={formData.salary}
          onChange={(e) =>
            setFormData({ ...formData, salary: e.target.value })
          }
          placeholder="Salary"
        />

        <button type="submit">
          {editingId ? "Update" : "Add"}
        </button>
      </form>

      {/* LIST */}
      {workers.map((w) => (
        <div key={w._id} className="border p-2 mb-2">
          <p>{w.name}</p>
          <p>{w.role}</p>
          <p>₦{w.salary}</p>

          <button onClick={() => handleEdit(w)}>Edit</button>
          <button onClick={() => handleDelete(w._id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
