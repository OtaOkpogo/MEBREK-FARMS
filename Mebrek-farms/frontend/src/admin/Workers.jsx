import { useEffect, useState } from "react";
import {
  fetchWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
} from "../services/workerService";

import apiClient from "../services/apiClient";

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [stats, setStats] = useState({
    totalWorkers: 0,
    totalSalary: 0,
    avgSalary: 0,
    recentWorkers: [],
  });

  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    employeeId: "",
    firstName: "",
    lastName: "",
    role: "",
    department: "",
    phone: "",
    email: "",
    salary: "",
    employmentType: "Permanent",
    status: "Active",
    hireDate: "",
  });

  useEffect(() => {
    loadWorkers();
    loadStats();
  }, []);

  const loadWorkers = async () => {
    try {
      const data = await fetchWorkers();
      setWorkers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadStats = async () => {
    try {
      const data = await apiClient.get("/workers/stats");

      setStats({
        totalWorkers: data.totalWorkers || 0,
        totalSalary: data.totalSalary || 0,
        avgSalary: data.avgSalary || 0,
        recentWorkers: data.recentWorkers || [],
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      const payload = {
        ...formData,
        salary: Number(formData.salary),
      };

      if (editingId) {
        await updateWorker(editingId, payload);
      } else {
        await createWorker(payload);
      }

      setEditingId(null);

      setFormData({
        employeeId: "",
        firstName: "",
        lastName: "",
        role: "",
        department: "",
        phone: "",
        email: "",
        salary: "",
        employmentType: "Permanent",
        status: "Active",
        hireDate: "",
      });

      await loadWorkers();
      await loadStats();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (worker) => {
    setEditingId(worker._id);

    setFormData({
      employeeId: worker.employeeId || "",
      firstName: worker.firstName || "",
      lastName: worker.lastName || "",
      role: worker.role || "",
      department: worker.department || "",
      phone: worker.phone || "",
      email: worker.email || "",
      salary: worker.salary || "",
      employmentType: worker.employmentType || "Permanent",
      status: worker.status || "Active",
      hireDate: worker.hireDate ? worker.hireDate.substring(0, 10) : "",
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete worker?")) return;

    try {
      await deleteWorker(id);

      await loadWorkers();
      await loadStats();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Workers Management</h1>

      {/* Analytics Cards */}

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white shadow rounded p-5">
          <h3 className="text-gray-500">Total Workers</h3>

          <p className="text-3xl font-bold">{stats.totalWorkers}</p>
        </div>

        <div className="bg-white shadow rounded p-5">
          <h3 className="text-gray-500">Monthly Payroll</h3>

          <p className="text-3xl font-bold text-green-600">
            ₦{stats.totalSalary.toLocaleString()}
          </p>
        </div>

        <div className="bg-white shadow rounded p-5">
          <h3 className="text-gray-500">Average Salary</h3>

          <p className="text-3xl font-bold text-blue-600">
            ₦{Math.round(stats.avgSalary).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Worker Form */}

      <div className="bg-white shadow rounded p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">
          {editingId ? "Edit Worker" : "Add Worker"}
        </h2>

        <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-4">
          <input
            placeholder="Employee ID"
            value={formData.employeeId}
            onChange={(e) =>
              setFormData({
                ...formData,
                employeeId: e.target.value,
              })
            }
            className="border p-2 rounded"
          />

          <input
            placeholder="First Name"
            value={formData.firstName}
            onChange={(e) =>
              setFormData({
                ...formData,
                firstName: e.target.value,
              })
            }
            className="border p-2 rounded"
            required
          />

          <input
            placeholder="Last Name"
            value={formData.lastName}
            onChange={(e) =>
              setFormData({
                ...formData,
                lastName: e.target.value,
              })
            }
            className="border p-2 rounded"
            required
          />

          <input
            placeholder="Role"
            value={formData.role}
            onChange={(e) =>
              setFormData({
                ...formData,
                role: e.target.value,
              })
            }
            className="border p-2 rounded"
            required
          />

          <input
            placeholder="Department"
            value={formData.department}
            onChange={(e) =>
              setFormData({
                ...formData,
                department: e.target.value,
              })
            }
            className="border p-2 rounded"
          />

          <input
            placeholder="Phone"
            value={formData.phone}
            onChange={(e) =>
              setFormData({
                ...formData,
                phone: e.target.value,
              })
            }
            className="border p-2 rounded"
          />

          <input
            placeholder="Email"
            value={formData.email}
            onChange={(e) =>
              setFormData({
                ...formData,
                email: e.target.value,
              })
            }
            className="border p-2 rounded"
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
            className="border p-2 rounded"
          />

          <input
            type="date"
            value={formData.hireDate}
            onChange={(e) =>
              setFormData({
                ...formData,
                hireDate: e.target.value,
              })
            }
            className="border p-2 rounded"
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-green-600 text-white p-3 rounded"
          >
            {loading ? "Saving..." : editingId ? "Update Worker" : "Add Worker"}
          </button>
        </form>
      </div>

      {/* Workers Table */}

      <div className="bg-white shadow rounded p-6">
        <h2 className="text-xl font-bold mb-4">Workers List</h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th>Name</th>
                <th>Role</th>
                <th>Department</th>
                <th>Phone</th>
                <th>Salary</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {workers.map((worker) => (
                <tr key={worker._id} className="border-b">
                  <td>
                    {worker.firstName} {worker.lastName}
                  </td>

                  <td>{worker.role}</td>

                  <td>{worker.department}</td>

                  <td>{worker.phone}</td>

                  <td>₦{Number(worker.salary || 0).toLocaleString()}</td>

                  <td>{worker.status}</td>

                  <td className="space-x-2">
                    <button
                      onClick={() => handleEdit(worker)}
                      className="bg-blue-500 text-white px-3 py-1 rounded"
                    >
                      Edit
                    </button>

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
      </div>
    </div>
  );
}
