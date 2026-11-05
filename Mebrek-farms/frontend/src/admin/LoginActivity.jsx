
import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "../services/apiClient";

const INITIAL_FILTERS = {
  search: "",
  role: "",
  status: "",
  from: "",
  to: "",
};

const getErrorMessage = (err, fallback) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  fallback;

const formatDate = (date) => {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (date) => {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatRole = (role) => {
  if (!role) return "Unknown";

  if (role === "superadmin") return "Super Admin";

  return role.charAt(0).toUpperCase() + role.slice(1);
};

const STATUS_STYLES = {
  success: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  blocked: "bg-amber-100 text-amber-800",
};

const STATUS_LABELS = {
  success: "Successful",
  failed: "Failed",
  blocked: "Blocked",
};

export default function LoginActivity() {
  const [activities, setActivities] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 20,
    totalRecords: 0,
    totalPages: 0,
  });

  // ============================================================
  // LOAD LOGIN ACTIVITIES
  // ============================================================

  const loadActivities = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) setLoading(true);

        setLoadError("");

        const response = await apiClient.get("/login-activities", {
          params: {
            page,
            limit: pageSize,
            search: filters.search.trim(),
            role: filters.role,
            status: filters.status,
            from: filters.from,
            to: filters.to,
          },
        });

        const result = response.data;

        setActivities(
          Array.isArray(result.activities) ? result.activities : [],
        );

        setPagination(
          result.pagination || {
            currentPage: page,
            pageSize,
            totalRecords: 0,
            totalPages: 0,
          },
        );
      } catch (err) {
        console.error("LOAD LOGIN ACTIVITIES ERROR:", err);

        setLoadError(
          getErrorMessage(err, "Unable to load login activity."),
        );

        setActivities([]);
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [page, filters, pageSize],
  );

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // ============================================================
  // FILTER CHANGE
  // ============================================================

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    setPage(1);

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ============================================================
  // CLEAR FILTERS
  // ============================================================

  const clearFilters = () => {
    setPage(1);
    setFilters({ ...INITIAL_FILTERS });
  };

  // ============================================================
  // SUMMARY COUNTS
  // ============================================================

  const summary = useMemo(() => {
    return activities.reduce(
      (counts, activity) => {
        counts.total += 1;

        if (activity.status === "success") {
          counts.success += 1;
        }

        if (activity.status === "failed") {
          counts.failed += 1;
        }

        if (activity.status === "blocked") {
          counts.blocked += 1;
        }

        return counts;
      },
      {
        total: 0,
        success: 0,
        failed: 0,
        blocked: 0,
      },
    );
  }, [activities]);

  // ============================================================
  // ACTIVE FILTER CHECK
  // ============================================================

  const hasActiveFilters = Object.values(filters).some(
    (value) => String(value).trim() !== "",
  );

  // ============================================================
  // PAGINATION
  // ============================================================

  const goToPage = (nextPage) => {
    if (
      nextPage < 1 ||
      nextPage > pagination.totalPages ||
      nextPage === page
    ) {
      return;
    }

    setPage(nextPage);
  };

  // ============================================================
  // EXPORT CSV
  // ============================================================

  const exportCSV = async () => {
    try {
      const response = await apiClient.get("/login-activities", {
        params: {
          page: 1,
          limit: 100,
          search: filters.search.trim(),
          role: filters.role,
          status: filters.status,
          from: filters.from,
          to: filters.to,
        },
      });

      const records = response.data.activities || [];

      if (records.length === 0) {
        alert("There are no login records to export.");
        return;
      }

      const columns = [
        "Name",
        "Email",
        "Role",
        "Status",
        "Failure Reason",
        "Date",
        "Time",
        "IP Address",
        "Browser / Device",
      ];

      const rows = records.map((item) => [
        item.name,
        item.email,
        formatRole(item.role),
        STATUS_LABELS[item.status] || item.status,
        item.failureReason || "",
        formatDate(item.createdAt),
        formatTime(item.createdAt),
        item.ipAddress,
        item.userAgent,
      ]);

      const escapeCSV = (value) => {
        const text = String(value ?? "");
        return `"${text.replace(/"/g, '""')}"`;
      };

      const csv = [
        columns.map(escapeCSV).join(","),
        ...rows.map((row) => row.map(escapeCSV).join(",")),
      ].join("\r\n");

      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `mebrek-login-activity-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("EXPORT LOGIN ACTIVITY ERROR:", err);

      alert(getErrorMessage(err, "Unable to export login activity."));
    }
  };

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
              Login Activity
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Monitor account login attempts, access history and security activity.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadActivities()}
              disabled={loading}
              className="rounded-lg border border-green-200 bg-white px-4 py-2.5 text-sm font-semibold text-green-800 transition hover:bg-green-50 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>

            <button
              type="button"
              onClick={exportCSV}
              disabled={loading}
              className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-50"
            >
              ↓ Export CSV
            </button>
          </div>
        </div>

        {/* SUMMARY CARDS */}

        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Records on This Page</p>
            <p className="mt-2 text-3xl font-bold text-gray-800">
              {summary.total}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Displayed login attempts
            </p>
          </div>

          <div className="rounded-xl border border-green-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Successful Logins</p>
            <p className="mt-2 text-3xl font-bold text-green-700">
              {summary.success}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Authenticated attempts
            </p>
          </div>

          <div className="rounded-xl border border-red-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Failed Logins</p>
            <p className="mt-2 text-3xl font-bold text-red-600">
              {summary.failed}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Unsuccessful attempts
            </p>
          </div>

          <div className="rounded-xl border border-amber-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Blocked Logins</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">
              {summary.blocked}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Disabled account attempts
            </p>
          </div>
        </div>

        {/* FILTERS */}

        <div className="mb-7 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800">
              Search & Filter Activity
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Find login records by account, role, outcome or date.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Search Account
              </label>

              <input
                type="search"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Name or email..."
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Account Role
              </label>

              <select
                name="role"
                value={filters.role}
                onChange={handleFilterChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-green-600"
              >
                <option value="">All Roles</option>
                <option value="superadmin">Super Admin</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Login Status
              </label>

              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-green-600"
              >
                <option value="">All Statuses</option>
                <option value="success">Successful</option>
                <option value="failed">Failed</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                From Date
              </label>

              <input
                type="date"
                name="from"
                value={filters.from}
                max={filters.to || undefined}
                onChange={handleFilterChange}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-green-600"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                To Date
              </label>

              <input
                type="date"
                name="to"
                value={filters.to}
                min={filters.from || undefined}
                onChange={handleFilterChange}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-green-600"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4">
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-semibold text-red-600 hover:text-red-800"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* ACTIVITY TABLE */}

        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                Login History
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {pagination.totalRecords} matching record(s)
              </p>
            </div>

            <span className="text-xs text-gray-400">
              Newest activity appears first
            </span>
          </div>

          {loadError && (
            <div className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold">
                Unable to load login activity
              </p>

              <p className="mt-1">{loadError}</p>

              <button
                type="button"
                onClick={() => loadActivities()}
                className="mt-2 font-semibold underline"
              >
                Try again
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left">
              <thead className="bg-[#f7f9f6]">
                <tr className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-4">Account</th>
                  <th className="px-5 py-4">Role</th>
                  <th className="px-5 py-4">Login Date & Time</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">IP Address</th>
                  <th className="px-5 py-4">Browser / Device</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading && activities.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-12 text-center text-sm text-gray-500">
                      Loading login activity...
                    </td>
                  </tr>
                ) : activities.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-12 text-center">
                      <p className="font-medium text-gray-600">
                        No login activity found.
                      </p>

                      <p className="mt-1 text-sm text-gray-400">
                        Login records will appear here as accounts attempt to sign in.
                      </p>
                    </td>
                  </tr>
                ) : (
                  activities.map((activity) => (
                    <tr
                      key={activity._id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-800">
                          {activity.name || "Unknown User"}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {activity.email || "No email"}
                        </p>

                        {activity.failureReason && (
                          <p className="mt-1 text-xs text-red-500">
                            {activity.failureReason}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-700">
                          {formatRole(activity.role)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-gray-700">
                          {formatDate(activity.createdAt)}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          {formatTime(activity.createdAt)}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            STATUS_STYLES[activity.status] ||
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {STATUS_LABELS[activity.status] ||
                            activity.status ||
                            "Unknown"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {activity.ipAddress || "Unknown"}
                      </td>

                      <td className="max-w-xs px-5 py-4 text-xs text-gray-500">
                        <p className="break-words">
                          {activity.userAgent || "Unknown"}
                        </p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}

          <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Showing{" "}
              {pagination.totalRecords === 0
                ? 0
                : (page - 1) * pageSize + 1}
              {" - "}
              {Math.min(
                page * pageSize,
                pagination.totalRecords,
              )}{" "}
              of {pagination.totalRecords} records
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || loading}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <span className="px-2 text-sm font-medium text-gray-600">
                Page {page} of {Math.max(1, pagination.totalPages)}
              </span>

              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={
                  page >= pagination.totalPages || loading
                }
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 px-5 py-3">
            <p className="text-xs text-gray-500">
              Login activity is an audit record. It does not expose passwords or authentication tokens.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

