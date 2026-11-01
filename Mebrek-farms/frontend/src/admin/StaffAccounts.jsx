import { useEffect, useMemo, useState, useCallback } from "react";

import {
  fetchStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  updateRole,
  toggleStatus,
  resetPassword,
} from "../services/staffService";

const INITIAL_FORM = {
  name: "",
  email: "",
  password: "",
  role: "staff",
  status: "active",
};

const ROLES = ["superadmin", "manager", "staff"];

const getErrorMessage = (err, fallback) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  fallback;

const extractStaff = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.staff)) return response.staff;
  if (Array.isArray(response?.users)) return response.users;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.staff)) return response.data.staff;
  if (Array.isArray(response?.data?.users)) return response.data.users;
  if (Array.isArray(response?.data?.data)) return response.data.data;

  return [];
};

const normalizeStatus = (status) => String(status || "active").toLowerCase();

export default function StaffAccounts() {
  const [staff, setStaff] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);

  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");

  const [formData, setFormData] = useState(INITIAL_FORM);

  // ============================================================
  // LOAD STAFF
  // ============================================================

  const loadStaff = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      setLoadError("");

      const response = await fetchStaff();
      const staffList = extractStaff(response);

      setStaff(staffList);
    } catch (err) {
      console.error("LOAD STAFF ERROR:", err);

      setLoadError(getErrorMessage(err, "Unable to load staff accounts."));
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

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
  // RESET FORM
  // ============================================================

  const resetForm = () => {
    setEditingId(null);
    setFormData({ ...INITIAL_FORM });
  };

  // ============================================================
  // CREATE / UPDATE STAFF
  // ============================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();

    if (!name || !email) {
      alert("Please enter the staff name and email address.");
      return;
    }

    if (!editingId && formData.password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await updateStaff(editingId, {
          name,
          email,
        });

        alert("Staff account updated successfully.");
      } else {
        await createStaff({
          name,
          email,
          password: formData.password,
          role: formData.role,
          status: formData.status,
        });

        alert("Staff account created successfully.");
      }

      resetForm();
      await loadStaff(false);
    } catch (err) {
      console.error("STAFF SAVE ERROR:", err);

      alert(getErrorMessage(err, "Failed to save staff account."));
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // EDIT STAFF
  // ============================================================

  const handleEdit = (user) => {
    setEditingId(user._id);

    setFormData({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "staff",
      status: normalizeStatus(user.status),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ============================================================
  // DELETE STAFF
  // ============================================================

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this staff account? This action cannot be undone.",
    );

    if (!confirmed) return;

    try {
      setActionId(id);

      await deleteStaff(id);

      if (editingId === id) resetForm();

      alert("Staff account deleted successfully.");

      await loadStaff(false);
    } catch (err) {
      console.error("DELETE STAFF ERROR:", err);

      alert(getErrorMessage(err, "Failed to delete staff account."));
    } finally {
      setActionId(null);
    }
  };

  // ============================================================
  // ACTIVATE / DISABLE ACCOUNT
  // ============================================================

  const handleToggleStatus = async (user) => {
    const currentlyActive = normalizeStatus(user.status) === "active";

    const action = currentlyActive ? "disable" : "activate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${user.name}'s account?`,
    );

    if (!confirmed) return;

    try {
      setActionId(user._id);

      await toggleStatus(user._id);

      alert(
        currentlyActive
          ? "Staff account disabled successfully."
          : "Staff account activated successfully.",
      );

      await loadStaff(false);
    } catch (err) {
      console.error("TOGGLE STATUS ERROR:", err);

      alert(getErrorMessage(err, "Failed to change account status."));
    } finally {
      setActionId(null);
    }
  };

  // ============================================================
  // RESET PASSWORD
  // ============================================================

  const handleResetPassword = async (user) => {
    const password = window.prompt(
      `Enter a new password for ${user.name} (minimum 6 characters):`,
    );

    if (password === null) return;

    if (password.trim().length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    try {
      setActionId(user._id);

      await resetPassword(user._id, password);

      alert("Password reset successfully.");
    } catch (err) {
      console.error("RESET PASSWORD ERROR:", err);

      alert(getErrorMessage(err, "Failed to reset password."));
    } finally {
      setActionId(null);
    }
  };

  // ============================================================
  // CHANGE ROLE
  // ============================================================

  const handleRoleChange = async (user) => {
    const role = window.prompt(
      "Enter a role: superadmin, manager, or staff",
      user.role || "staff",
    );

    if (role === null) return;

    const normalizedRole = role.trim().toLowerCase();

    if (!ROLES.includes(normalizedRole)) {
      alert("Invalid role. Use superadmin, manager, or staff.");
      return;
    }

    if (normalizedRole === user.role) return;

    const confirmed = window.confirm(
      `Change ${user.name}'s role to ${normalizedRole}?`,
    );

    if (!confirmed) return;

    try {
      setActionId(user._id);

      await updateRole(user._id, normalizedRole);

      alert("Staff role updated successfully.");

      await loadStaff(false);
    } catch (err) {
      console.error("UPDATE ROLE ERROR:", err);

      alert(getErrorMessage(err, "Failed to update staff role."));
    } finally {
      setActionId(null);
    }
  };

  // ============================================================
  // SEARCH
  // ============================================================

  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return staff;

    return staff.filter((user) => {
      return (
        String(user.name || "")
          .toLowerCase()
          .includes(term) ||
        String(user.email || "")
          .toLowerCase()
          .includes(term) ||
        String(user.role || "")
          .toLowerCase()
          .includes(term) ||
        String(user.status || "")
          .toLowerCase()
          .includes(term)
      );
    });
  }, [staff, search]);

  // ============================================================
  // SUMMARY COUNTS
  // ============================================================

  const activeCount = staff.filter(
    (user) => normalizeStatus(user.status) === "active",
  ).length;

  const disabledCount = staff.length - activeCount;

  const managerCount = staff.filter((user) => user.role === "manager").length;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-[#f5f7f3] p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* PAGE HEADER */}

        <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-green-700">
              MEBREK FARMS MANAGEMENT
            </p>

            <h1 className="text-2xl font-bold text-gray-800 md:text-3xl">
              Staff Accounts
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage user accounts, access roles and account status.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadStaff()}
            disabled={loading}
            className="rounded-lg border border-green-200 bg-white px-4 py-2.5 text-sm font-semibold text-green-800 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "↻ Refresh Accounts"}
          </button>
        </div>

        {/* SUMMARY CARDS */}

        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Accounts</p>
            <p className="mt-2 text-3xl font-bold text-gray-800">
              {staff.length}
            </p>
            <p className="mt-1 text-xs text-gray-400">Registered users</p>
          </div>

          <div className="rounded-xl border border-green-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Active Accounts</p>
            <p className="mt-2 text-3xl font-bold text-green-700">
              {activeCount}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Accounts currently active
            </p>
          </div>

          <div className="rounded-xl border border-amber-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Disabled Accounts</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">
              {disabledCount}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Accounts currently disabled
            </p>
          </div>

          <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Managers</p>
            <p className="mt-2 text-3xl font-bold text-blue-700">
              {managerCount}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Users with manager access
            </p>
          </div>
        </div>

        {/* CREATE / EDIT FORM */}

        <div className="mb-8 rounded-xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                {editingId ? "Edit Staff Account" : "Create Staff Account"}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {editingId
                  ? "Update the selected user's details."
                  : "Add a new user to the farm management system."}
              </p>
            </div>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Full Name
                </label>

                <input
                  type="text"
                  name="name"
                  placeholder="Enter full name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email Address
                </label>

                <input
                  type="email"
                  name="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  required
                />
              </div>

              {!editingId && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Initial Password
                  </label>

                  <input
                    type="password"
                    name="password"
                    placeholder="Minimum 6 characters"
                    value={formData.password}
                    onChange={handleChange}
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    required
                  />
                </div>
              )}

              {!editingId && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Account Role
                  </label>

                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  >
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>
              )}

              {!editingId && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Initial Account Status
                  </label>

                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              )}

              {editingId && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                    Current Account Role
                  </p>

                  <p className="mt-1 font-semibold capitalize text-blue-900">
                    {formData.role}
                  </p>

                  <p className="mt-2 text-xs text-blue-700">
                    Use the Role action in the account table to change this
                    user's role.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving || loading}
                className="rounded-lg bg-green-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Staff Account"
                    : "Create Staff Account"}
              </button>

              {!editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Clear Form
                </button>
              )}
            </div>
          </form>
        </div>

        {/* STAFF TABLE */}

        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-100 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                Registered Staff Accounts
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {filteredStaff.length} account(s) displayed
              </p>
            </div>

            <div className="w-full md:max-w-sm">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, role or status..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
              />
            </div>
          </div>

          {loadError && (
            <div className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold">Unable to load staff accounts</p>
              <p className="mt-1">{loadError}</p>

              <button
                type="button"
                onClick={() => loadStaff()}
                className="mt-2 font-semibold underline"
              >
                Try again
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-[#f7f9f6]">
                <tr className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-4">Staff Member</th>
                  <th className="px-5 py-4">Email Address</th>
                  <th className="px-5 py-4">Role</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading && staff.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-5 py-12 text-center text-sm text-gray-500"
                    >
                      Loading staff accounts...
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-5 py-12 text-center">
                      <p className="font-medium text-gray-600">
                        {search
                          ? "No matching staff accounts found."
                          : "No staff accounts found."}
                      </p>

                      <p className="mt-1 text-sm text-gray-400">
                        {search
                          ? "Try another search term."
                          : "Create a staff account using the form above."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((user) => {
                    const isActive = normalizeStatus(user.status) === "active";

                    const isBusy = actionId === user._id;

                    return (
                      <tr
                        key={user._id}
                        className="transition hover:bg-gray-50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold uppercase text-green-800">
                              {(user.name || "U").charAt(0)}
                            </div>

                            <div>
                              <p className="font-semibold text-gray-800">
                                {user.name || "Unnamed User"}
                              </p>

                              <p className="text-xs text-gray-400">
                                Staff account
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {user.email || "No email"}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                              user.role === "superadmin"
                                ? "bg-purple-100 text-purple-800"
                                : user.role === "manager"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {user.role || "staff"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                              isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isActive ? "bg-green-600" : "bg-amber-500"
                              }`}
                            />
                            {isActive ? "Active" : "Disabled"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(user)}
                              disabled={isBusy || saving}
                              className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRoleChange(user)}
                              disabled={isBusy || saving}
                              className="rounded-md bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                            >
                              Role
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleStatus(user)}
                              disabled={isBusy || saving}
                              className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                                isActive
                                  ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  : "bg-green-50 text-green-700 hover:bg-green-100"
                              }`}
                            >
                              {isBusy
                                ? "Please wait..."
                                : isActive
                                  ? "Disable"
                                  : "Activate"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleResetPassword(user)}
                              disabled={isBusy || saving}
                              className="rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                            >
                              Reset Password
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(user._id)}
                              disabled={isBusy || saving}
                              className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
            <p className="text-xs text-gray-500">
              Staff account access is controlled by the assigned role and
              account status.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
