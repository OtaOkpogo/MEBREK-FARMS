import { useEffect, useState } from "react";
import {
  fetchWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
} from "../services/workerService";

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [form, setForm] = useState({
    name: "",
    role: "",
    phone: "",
    salary: "",
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    const res = await fetchWorkers();
    setWorkers(res.data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (editingId) {
      await updateWorker(editingId, form);
    } else {
      await createWorker(form);
    }

    setForm({ name: "", role: "", phone: "", salary: "" });
    setEditingId(null);
    loadWorkers();
  };

  const handleEdit = (worker) => {
    setForm(worker);
    setEditingId(worker._id);
  };

  const handleDelete = async (id) => {
    await deleteWorker(id);
    loadWorkers();
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">👷 Workers Management</h2>

      {/* FORM */}
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 mb-6">
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="border p-2 rounded"
          required
        />

        <input
          placeholder="Role"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="border p-2 rounded"
          required
        />

        <input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="border p-2 rounded"
        />

        <input
          placeholder="Salary"
          value={form.salary}
          onChange={(e) => setForm({ ...form, salary: e.target.value })}
          className="border p-2 rounded"
        />

        <button className="col-span-2 bg-green-600 text-white py-2 rounded">
          {editingId ? "Update Worker" : "Add Worker"}
        </button>
      </form>

      {/* TABLE */}
      <table className="w-full border">
        <thead className="bg-green-600 text-white">
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Phone</th>
            <th>Salary</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {workers.map((w) => (
            <tr key={w._id} className="border-b">
              <td>{w.name}</td>
              <td>{w.role}</td>
              <td>{w.phone}</td>
              <td>{w.salary}</td>

              <td>
                <button onClick={() => handleEdit(w)} className="mr-2">
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(w._id)}
                  className="text-red-600"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
