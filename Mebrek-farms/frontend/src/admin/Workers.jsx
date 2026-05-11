import { useEffect, useState } from "react";

import {
  fetchWorkers,
  createWorker,
  deleteWorker,
} from "../services/workerService";

export default function Workers() {
  const [workers, setWorkers] = useState([]);

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
      await createWorker(formData);

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
      <h1 className="text-4xl font-bold text-green-700 mb-8">
        Workers Management 👨‍🌾
      </h1>

      {/* FORM */}

      <div className="bg-white p-6 rounded-2xl shadow mb-10">
        <h2 className="text-2xl font-bold mb-6">Add Worker</h2>

        <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-4">
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

          <input
            type="text"
            placeholder="Role"
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

          <input
            type="number"
            placeholder="Salary"
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

          <button className="bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition">
            Add Worker
          </button>
        </form>
      </div>

      {/* TABLE */}

      <div className="bg-white p-6 rounded-2xl shadow">
        <h2 className="text-2xl font-bold mb-6">Farm Workers</h2>

        {workers.length === 0 ? (
          <p>No workers found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-3">Name</th>
                  <th>Role</th>
                  <th>Salary</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {workers.map((worker) => (
                  <tr key={worker._id} className="border-b hover:bg-gray-50">
                    <td className="py-3">{worker.name}</td>

                    <td>{worker.role}</td>

                    <td>₦{worker.salary}</td>

                    <td>
                      <button
                        onClick={() => handleDelete(worker._id)}
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
        )}
      </div>
    </div>
  );
}
