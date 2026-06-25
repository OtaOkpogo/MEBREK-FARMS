import { useEffect, useState } from "react";

import {
  fetchStaff,
  createStaff,
  updateStaff,
  deleteStaff,
} from "../services/staffService";

export default function StaffAccounts() {
  const [staff, setStaff] = useState([]);

  const [editingId, setEditingId] =
    useState(null);

  const [formData, setFormData] =
    useState({
      name: "",
      email: "",
      password: "",
      role: "staff",
      status: "active",
    });

  const loadStaff = async () => {
    try {
      const data = await fetchStaff();

      setStaff(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingId) {
        await updateStaff(
          editingId,
          formData
        );
      } else {
        await createStaff(formData);
      }

      setEditingId(null);

      setFormData({
        name: "",
        email: "",
        password: "",
        role: "staff",
        status: "active",
      });

      loadStaff();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (user) => {
    setEditingId(user._id);

    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      status: user.status,
    });
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Delete this user?"
      )
    )
      return;

    await deleteStaff(id);

    loadStaff();
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">
        Staff Accounts 👥
      </h1>

      <div className="bg-white p-6 rounded-xl shadow mb-8">
        <form
          onSubmit={handleSubmit}
          className="grid md:grid-cols-2 gap-4"
        >
          <input
            type="text"
            placeholder="Full Name"
            value={formData.name}
            onChange={(e) =>
              setFormData({
                ...formData,
                name: e.target.value,
              })
            }
            className="border p-3 rounded"
            required
          />

          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) =>
              setFormData({
                ...formData,
                email: e.target.value,
              })
            }
            className="border p-3 rounded"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) =>
              setFormData({
                ...formData,
                password: e.target.value,
              })
            }
            className="border p-3 rounded"
            required={!editingId}
          />

          <select
            value={formData.role}
            onChange={(e) =>
              setFormData({
                ...formData,
                role: e.target.value,
              })
            }
            className="border p-3 rounded"
          >
            <option value="staff">
              Staff
            </option>

            <option value="manager">
              Manager
            </option>

            <option value="superadmin">
              Super Admin
            </option>
          </select>

          <select
            value={formData.status}
            onChange={(e) =>
              setFormData({
                ...formData,
                status: e.target.value,
              })
            }
            className="border p-3 rounded"
          >
            <option value="active">
              Active
            </option>

            <option value="inactive">
              Inactive
            </option>
          </select>

          <button
            type="submit"
            className="
              bg-green-600
              text-white
              p-3
              rounded
            "
          >
            {editingId
              ? "Update User"
              : "Create User"}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl shadow">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {staff.map((user) => (
              <tr
                key={user._id}
                className="border-b"
              >
                <td>{user.name}</td>

                <td>{user.email}</td>

                <td>{user.role}</td>

                <td>
                  {user.status}
                </td>

                <td className="space-x-2">
                  <button
                    onClick={() =>
                      handleEdit(user)
                    }
                    className="
                      bg-blue-500
                      text-white
                      px-3
                      py-1
                      rounded
                    "
                  >
                    Edit
                  </button>

                  <button
                    onClick={() =>
                      handleDelete(
                        user._id
                      )
                    }
                    className="
                      bg-red-500
                      text-white
                      px-3
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
    </div>
  );
}
