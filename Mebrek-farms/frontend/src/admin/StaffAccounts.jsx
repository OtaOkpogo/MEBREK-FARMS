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
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "staff",
    status: "active",
  });

  // ============================================================
  // LOAD STAFF
  // ============================================================

  const loadStaff = async () => {
    try {
      setLoading(true);

      const data = await fetchStaff();

      console.log("STAFF RESPONSE:", data);
      console.log("IS STAFF ARRAY:", Array.isArray(data));

      setStaff(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("LOAD STAFF ERROR:", err);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  // ============================================================
  // FORM CHANGE
  // ============================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ============================================================
  // CREATE / UPDATE
  // ============================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingId) {
        await updateStaff(editingId, {
          name: formData.name,
          email: formData.email,
        });

        alert("Staff account updated successfully");
      } else {
        await createStaff({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        });

        alert("Staff account created successfully");
      }

      setEditingId(null);

      setFormData({
        name: "",
        email: "",
        password: "",
        role: "staff",
        status: "active",
      });

      await loadStaff();
    } catch (err) {
      console.error("STAFF SAVE ERROR:", err);

      alert(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to save staff account",
      );
    }
  };

  // ============================================================
  // EDIT
  // ============================================================

  const handleEdit = (user) => {
    setEditingId(user._id);

    setFormData({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "staff",
      status: user.status || "active",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ============================================================
  // CANCEL EDIT
  // ============================================================

  const handleCancelEdit = () => {
    setEditingId(null);

    setFormData({
      name: "",
      email: "",
      password: "",
      role: "staff",
      status: "active",
    });
  };

  // ============================================================
  // DELETE
  // ============================================================

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user?")) return;

    try {
      await deleteStaff(id);

      alert("Staff account deleted successfully");

      await loadStaff();
    } catch (err) {
      console.error("DELETE STAFF ERROR:", err);

      alert(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to delete staff account",
      );
    }
  };

  // ============================================================
  // TOGGLE STATUS
  // ============================================================

  const handleToggleStatus = async (id) => {
    try {
      await toggleStatus(id);

      await loadStaff();
    } catch (err) {
      console.error("TOGGLE STATUS ERROR:", err);

      alert(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to change account status",
      );
    }
  };

  // ============================================================
  // RESET PASSWORD
  // ============================================================

  const handleResetPassword = async (id) => {
    const password = prompt("Enter the new password (minimum 6 characters):");

    if (!password) return;

    if (password.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    try {
      await resetPassword(id, password);

      alert("Password reset successful");
    } catch (err) {
      console.error("RESET PASSWORD ERROR:", err);

      alert(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to reset password",
      );
    }
  };

  // ============================================================
  // CHANGE ROLE
  // ============================================================

  const handleRoleChange = async (id, currentRole) => {
    const role = prompt("Enter role: superadmin, manager, staff", currentRole);

    if (!role) return;

    const normalizedRole = role.trim().toLowerCase();

    if (!["superadmin", "manager", "staff"].includes(normalizedRole)) {
      alert("Invalid role. Use superadmin, manager, or staff.");
      return;
    }

    try {
      await updateRole(id, normalizedRole);

      await loadStaff();
    } catch (err) {
      console.error("UPDATE ROLE ERROR:", err);

      alert(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to update role",
      );
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Staff Accounts 👥</h1>

      {/* ========================================================
          CREATE / EDIT FORM
      ======================================================== */}

      <div className="bg-white p-6 rounded-xl shadow mb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold">
            {editingId ? "Edit Staff Account" : "Create Staff Account"}
          </h2>

          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="bg-gray-500 text-white px-4 py-2 rounded"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            className="border p-3 rounded"
            required
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            className="border p-3 rounded"
            required
          />

          {!editingId && (
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              className="border p-3 rounded"
              required
            />
          )}

          {!editingId && (
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="border p-3 rounded"
            >
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
              <option value="superadmin">Super Admin</option>
            </select>
          )}

          {editingId && (
            <div className="border rounded p-3 bg-gray-50">
              <p className="text-sm text-gray-500">
                Role: <strong className="text-gray-800">{formData.role}</strong>
              </p>

              <p className="text-xs text-gray-500 mt-1">
                Use the Role button below to change the role.
              </p>
            </div>
          )}

          {!editingId && (
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="border p-3 rounded"
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-green-600 text-white p-3 rounded disabled:opacity-50"
          >
            {editingId ? "Update User" : "Create User"}
          </button>
        </form>
      </div>

      {/* ========================================================
          STAFF TABLE
      ======================================================== */}

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
            {loading && staff.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center p-6">
                  Loading staff accounts...
                </td>
              </tr>
            ) : staff.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center p-6">
                  No staff accounts found
                </td>
              </tr>
            ) : (
              staff.map((user) => (
                <tr key={user._id} className="border-b">
                  <td className="p-2">{user.name}</td>

                  <td className="p-2">{user.email}</td>

                  <td className="p-2 capitalize">{user.role}</td>

                  <td className="p-2 capitalize">{user.status}</td>

                  <td className="p-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(user)}
                        className="bg-blue-500 text-white px-3 py-1 rounded"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRoleChange(user._id, user.role)}
                        className="bg-purple-500 text-white px-3 py-1 rounded"
                      >
                        Role
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(user._id)}
                        className="bg-yellow-500 text-white px-3 py-1 rounded"
                      >
                        {user.status === "active" ? "Disable" : "Activate"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResetPassword(user._id)}
                        className="bg-indigo-500 text-white px-3 py-1 rounded"
                      >
                        Reset Password
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(user._id)}
                        className="bg-red-500 text-white px-3 py-1 rounded"
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
    </div>
  );
}
