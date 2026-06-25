import { useEffect, useState } from "react";

import {
  fetchStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  updateRole,
  toggleStatus,
  resetPassword,
} from "../services/staffService";

export default function StaffAccounts() {
  const [staff, setStaff] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
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
        await updateStaff(editingId, formData);
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
    if (!window.confirm("Delete this user?")) return;

    try {
      await deleteStaff(id);
      loadStaff();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await toggleStatus(id);
      loadStaff();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetPassword = async (id) => {
    const password = prompt("Enter new password");

    if (!password) return;

    try {
      await resetPassword(id, password);
      alert("Password reset successful");
    } catch (err) {
      console.error(err);
    }
  };

  const handleRoleChange = async (id, currentRole) => {
    const role = prompt("Enter role: superadmin, manager, staff", currentRole);

    if (!role) return;

    try {
      await updateRole(id, role);
      loadStaff();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Staff Accounts 👥</h1>

      <div className="bg-white p-6 rounded-xl shadow mb-8">
        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
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
            <option value="staff">Staff</option>

            <option value="manager">Manager</option>

            <option value="superadmin">Super Admin</option>
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
            <option value="active">Active</option>

            <option value="disabled">Disabled</option>
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
            {editingId ? "Update User" : "Create User"}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl shadow overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Role</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {staff.map((user) => (
              <tr key={user._id} className="border-b">
                <td className="p-2">{user.name}</td>

                <td className="p-2">{user.email}</td>

                <td className="p-2">{user.role}</td>

                <td className="p-2">{user.status}</td>

                <td className="p-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleEdit(user)}
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
                      onClick={() => handleRoleChange(user._id, user.role)}
                      className="
                        bg-purple-500
                        text-white
                        px-3
                        py-1
                        rounded
                      "
                    >
                      Role
                    </button>

                    <button
                      onClick={() => handleToggleStatus(user._id)}
                      className="
                        bg-yellow-500
                        text-white
                        px-3
                        py-1
                        rounded
                      "
                    >
                      {user.status === "active" ? "Disable" : "Activate"}
                    </button>

                    <button
                      onClick={() => handleResetPassword(user._id)}
                      className="
                        bg-indigo-500
                        text-white
                        px-3
                        py-1
                        rounded
                      "
                    >
                      Reset Password
                    </button>

                    <button
                      onClick={() => handleDelete(user._id)}
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
                  </div>
                </td>
              </tr>
            ))}

            {staff.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center p-6">
                  No staff accounts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
