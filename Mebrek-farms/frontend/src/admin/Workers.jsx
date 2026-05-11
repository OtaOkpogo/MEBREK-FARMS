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

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    try {
      const data = await fetchWorkers();

      setWorkers(data);
    } catch (err) {
      console.error(err);
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

      setFormData({
        name: "",
        role: "",
        salary: "",
      });

      loadWorkers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (worker) => {
    setFormData({
      name: worker.name,
      role: worker.role,
      salary: worker.salary,
    });

    setEditingId(worker._id);
  };

  const handleDelete = async (id) => {
    try {
      await deleteWorker(id);

      loadWorkers();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {/* PAGE HEADER */}

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-green-700">
          Workers Management 👨‍🌾
        </h1>

        <p className="text-gray-600 mt-2">
          Manage farm workers, salaries, and roles
        </p>
      </div>

      {/* FORM SECTION */}

      <div className="bg-white rounded-2xl shadow p-6 mb-10">
        <h2 className="text-2xl font-bold mb-6">
          {editingId ? "Update Worker ✏️" : "Add New Worker ➕"}
        </h2>

        <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-4">
          {/* NAME */}

          <input
            type="text"
            placeholder="Worker Name"
            value={formData.name}
            onChange={(e) =>
              setFormData({
                ...formData,
                name: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
            required
          />

          {/* ROLE */}

          <input
            type="text"
            placeholder="Worker Role"
            value={formData.role}
            onChange={(e) =>
              setFormData({
                ...formData,
                role: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
            required
          />

          {/* SALARY */}

          <input
            type="number"
            placeholder="Monthly Salary"
            value={formData.salary}
            onChange={(e) =>
              setFormData({
                ...formData,
                salary: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
            required
          />

          {/* BUTTON */}

          <button
            className="
              bg-green-600
              hover:bg-green-700
              text-white
              py-3
              rounded-lg
              transition
            "
          >
            {editingId ? "Update Worker" : "Add Worker"}
          </button>
        </form>
      </div>

      {/* TABLE SECTION */}

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold mb-6">Farm Workers List 📋</h2>

        {workers.length === 0 ? (
          <p className="text-gray-500">No workers found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-3">Name</th>

                  <th>Role</th>

                  <th>Salary</th>

                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {workers.map((worker) => (
                  <tr key={worker._id} className="border-b hover:bg-gray-50">
                    {/* NAME */}

                    <td className="py-4 font-medium">{worker.name}</td>

                    {/* ROLE */}

                    <td>{worker.role}</td>

                    {/* SALARY */}

                    <td className="font-semibold text-green-700">
                      ₦{Number(worker.salary).toLocaleString()}
                    </td>

                    {/* ACTIONS */}

                    <td className="space-x-2">
                      <button
                        onClick={() => handleEdit(worker)}
                        className="
                          bg-blue-500
                          hover:bg-blue-600
                          text-white
                          px-4
                          py-1
                          rounded
                        "
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => handleDelete(worker._id)}
                        className="
                          bg-red-500
                          hover:bg-red-600
                          text-white
                          px-4
                          py-1
                          rounded
                        "
                      >
                        Delete
                      </button>
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
