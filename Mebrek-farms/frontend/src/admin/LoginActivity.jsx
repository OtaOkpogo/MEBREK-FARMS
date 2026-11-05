import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "../services/apiClient";

const INITIAL_FILTERS = {
  search: "",
  role: "",
  status: "",
  action: "",
  module: "",
  from: "",
  to: "",
};

const PAGE_SIZE = 20;

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

const formatAction = (action) => {
  if (!action) return "Unknown";

  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

const ACTION_STYLES = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  RESTORE: "bg-purple-100 text-purple-800",
  STATUS_CHANGE: "bg-amber-100 text-amber-800",
  ROLE_CHANGE: "bg-indigo-100 text-indigo-800",
  APPROVE: "bg-green-100 text-green-800",
  REJECT: "bg-red-100 text-red-800",
  BACKUP: "bg-cyan-100 text-cyan-800",
  EXPORT: "bg-gray-100 text-gray-700",
};

const getPagination = (result, page) => {
  const pagination = result?.pagination || {};

  return {
    currentPage: pagination.currentPage ?? pagination.page ?? page,
    pageSize: pagination.pageSize ?? pagination.limit ?? PAGE_SIZE,
    totalRecords:
      pagination.totalRecords ?? pagination.total ?? pagination.totalCount ?? 0,
    totalPages: pagination.totalPages ?? 0,
  };
};

export default function LoginActivity() {
  const [activeTab, setActiveTab] = useState("login");

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: PAGE_SIZE,
    totalRecords: 0,
    totalPages: 0,
  });

  const isAuditTab = activeTab === "audit";

  // ============================================================
  // LOAD ACTIVITY
  // ============================================================

  const loadActivities = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) setLoading(true);

        setLoadError("");

        const endpoint = isAuditTab ? "/audit-logs" : "/login-activities";

        const params = {
          page,
          limit: PAGE_SIZE,
          search: filters.search.trim(),
          role: filters.role,
          from: filters.from,
          to: filters.to,
        };

        if (isAuditTab) {
          params.action = filters.action;
          params.module = filters.module;
        } else {
          params.status = filters.status;
        }

        const response = await apiClient.get(endpoint, { params });

        const result = response.data;

        setActivities(
          Array.isArray(result.activities) ? result.activities : [],
        );

        setPagination(getPagination(result, page));
      } catch (err) {
        console.error(
          isAuditTab
            ? "LOAD AUDIT LOGS ERROR:"
            : "LOAD LOGIN ACTIVITIES ERROR:",
          err,
        );

        setLoadError(
          getErrorMessage(
            err,
            isAuditTab
              ? "Unable to load administrative audit records."
              : "Unable to load login activity.",
          ),
        );

        setActivities([]);

        setPagination({
          currentPage: 1,
          pageSize: PAGE_SIZE,
          totalRecords: 0,
          totalPages: 0,
        });
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [page, filters, isAuditTab],
  );

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // ============================================================
  // TAB CHANGE
  // ============================================================

  const changeTab = (tab) => {
    if (tab === activeTab) return;

    setActiveTab(tab);
    setPage(1);
    setFilters(INITIAL_FILTERS);
    setActivities([]);
    setLoadError("");
    setPagination({
      currentPage: 1,
      pageSize: PAGE_SIZE,
      totalRecords: 0,
      totalPages: 0,
    });
  };

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
    setFilters(INITIAL_FILTERS);
  };

  const hasActiveFilters = Object.values(filters).some(
    (value) => String(value).trim() !== "",
  );

  // ============================================================
  // LOGIN SUMMARY
  // ============================================================

  const loginSummary = useMemo(() => {
    return activities.reduce(
      (counts, activity) => {
        counts.total += 1;

        if (activity.status === "success") counts.success += 1;
        if (activity.status === "failed") counts.failed += 1;
        if (activity.status === "blocked") counts.blocked += 1;

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
  // AUDIT SUMMARY
  // ============================================================

  const auditSummary = useMemo(() => {
    return {
      total: activities.length,
      creates: activities.filter((item) => item.action === "CREATE").length,
      updates: activities.filter((item) => item.action === "UPDATE").length,
      deletions: activities.filter((item) => item.action === "DELETE").length,
    };
  }, [activities]);

  // ============================================================
  // PAGINATION
  // ============================================================

  const goToPage = (nextPage) => {
    if (nextPage < 1 || nextPage > pagination.totalPages || nextPage === page) {
      return;
    }

    setPage(nextPage);
  };

  // ============================================================
  // CSV EXPORT
  // ============================================================

  const exportCSV = async () => {
    try {
      const endpoint = isAuditTab ? "/audit-logs" : "/login-activities";

      const params = {
        page: 1,
        limit: 100,
        search: filters.search.trim(),
        role: filters.role,
        from: filters.from,
        to: filters.to,
      };

      if (isAuditTab) {
        params.action = filters.action;
        params.module = filters.module;
      } else {
        params.status = filters.status;
      }

      const response = await apiClient.get(endpoint, { params });

      const records = Array.isArray(response.data.activities)
        ? response.data.activities
        : [];

      if (records.length === 0) {
        alert("There are no records to export.");
        return;
      }

      let columns;
      let rows;

      if (isAuditTab) {
        columns = [
          "Actor Name",
          "Actor Email",
          "Role",
          "Action",
          "Module",
          "Description",
          "Entity",
          "Date",
          "Time",
          "IP Address",
        ];

        rows = records.map((item) => [
          item.actorName,
          item.actorEmail,
          formatRole(item.actorRole),
          item.action,
          item.module,
          item.description,
          item.entityName,
          formatDate(item.createdAt),
          formatTime(item.createdAt),
          item.ipAddress,
        ]);
      } else {
        columns = [
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

        rows = records.map((item) => [
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
      }

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

      const filename = isAuditTab
        ? "mebrek-administrative-audit"
        : "mebrek-login-activity";

      link.download = `${filename}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("EXPORT ACTIVITY ERROR:", err);

      alert(getErrorMessage(err, "Unable to export activity records."));
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
              Security & Activity Centre
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Review account access and important administrative changes.
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

        {/* ACTIVITY TABS */}

        <div className="mb-7 flex flex-wrap gap-2 border-b border-gray-200">
          <button
            type="button"
            onClick={() => changeTab("login")}
            className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
              !isAuditTab
                ? "border-green-700 text-green-800"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <span className="mr-2">🔐</span>
            Login Activity
          </button>

          <button
            type="button"
            onClick={() => changeTab("audit")}
            className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
              isAuditTab
                ? "border-green-700 text-green-800"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <span className="mr-2">📋</span>
            Administrative Audit Trail
          </button>
        </div>

        {/* SUMMARY CARDS */}

        {!isAuditTab ? (
          <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Records on This Page"
              value={loginSummary.total}
              description="Displayed login attempts"
            />

            <SummaryCard
              title="Successful Logins"
              value={loginSummary.success}
              description="Authenticated attempts"
              color="green"
            />

            <SummaryCard
              title="Failed Logins"
              value={loginSummary.failed}
              description="Unsuccessful attempts"
              color="red"
            />

            <SummaryCard
              title="Blocked Logins"
              value={loginSummary.blocked}
              description="Disabled account attempts"
              color="amber"
            />
          </div>
        ) : (
          <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Records on This Page"
              value={auditSummary.total}
              description="Administrative activities"
            />

            <SummaryCard
              title="Records Created"
              value={auditSummary.creates}
              description="New records"
              color="green"
            />

            <SummaryCard
              title="Records Updated"
              value={auditSummary.updates}
              description="Modified records"
              color="blue"
            />

            <SummaryCard
              title="Records Deleted"
              value={auditSummary.deletions}
              description="Deletion activities"
              color="red"
            />
          </div>
        )}

        {/* FILTERS */}

        <div className="mb-7 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800">
              Search & Filter Activity
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {isAuditTab
                ? "Find administrative changes by user, action, module or date."
                : "Find login records by account, role, outcome or date."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {/* SEARCH */}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {isAuditTab ? "Search Activity" : "Search Account"}
              </label>

              <input
                type="search"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder={
                  isAuditTab
                    ? "User, description or module..."
                    : "Name or email..."
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
              />
            </div>

            {/* ROLE */}

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

            {/* TAB-SPECIFIC FILTER */}

            {isAuditTab ? (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Action
                  </label>

                  <select
                    name="action"
                    value={filters.action}
                    onChange={handleFilterChange}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-green-600"
                  >
                    <option value="">All Actions</option>
                    {[
                      "CREATE",
                      "UPDATE",
                      "DELETE",
                      "RESTORE",
                      "STATUS_CHANGE",
                      "ROLE_CHANGE",
                      "APPROVE",
                      "REJECT",
                      "EXPORT",
                      "BACKUP",
                      "PASSWORD_RESET",
                      "OTHER",
                    ].map((action) => (
                      <option key={action} value={action}>
                        {formatAction(action)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Module
                  </label>

                  <select
                    name="module"
                    value={filters.module}
                    onChange={handleFilterChange}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-green-600"
                  >
                    <option value="">All Modules</option>
                    <option value="Production">Production</option>
                    <option value="Flocks">Flocks</option>
                    <option value="Manure Sales">Manure Sales</option>
                    <option value="Egg Sales">Egg Sales</option>
                    <option value="Staff Accounts">Staff Accounts</option>
                    <option value="Feed Inventory">Feed Inventory</option>
                    <option value="Feed Invoices">Feed Invoices</option>
                    <option value="Expenses">Expenses</option>
                    <option value="Warehouse">Warehouse</option>
                    <option value="Room Inventory">Room Inventory</option>
                    <option value="Mortality">Mortality</option>
                    <option value="Vaccinations">Vaccinations</option>
                    <option value="Medications">Medications</option>
                    <option value="Backup">Backup</option>
                  </select>
                </div>
              </>
            ) : (
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
            )}

            {/* FROM DATE */}

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

            {/* TO DATE */}

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
                {isAuditTab ? "Administrative Audit History" : "Login History"}
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
              <p className="font-semibold">Unable to load activity</p>

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
            {!isAuditTab ? (
              /* LOGIN ACTIVITY TABLE */

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
                      <td
                        colSpan="6"
                        className="px-5 py-12 text-center text-sm text-gray-500"
                      >
                        Loading login activity...
                      </td>
                    </tr>
                  ) : activities.length === 0 ? (
                    <EmptyRow
                      colSpan={6}
                      message="No login activity found."
                      description="Login records will appear here as accounts attempt to sign in."
                    />
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
                          <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
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
            ) : (
              /* ADMINISTRATIVE AUDIT TABLE */

              <table className="w-full min-w-[1150px] text-left">
                <thead className="bg-[#f7f9f6]">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-4">Performed By</th>
                    <th className="px-5 py-4">Action</th>
                    <th className="px-5 py-4">Module</th>
                    <th className="px-5 py-4">Description</th>
                    <th className="px-5 py-4">Date & Time</th>
                    <th className="px-5 py-4">IP Address</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {loading && activities.length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-5 py-12 text-center text-sm text-gray-500"
                      >
                        Loading administrative audit records...
                      </td>
                    </tr>
                  ) : activities.length === 0 ? (
                    <EmptyRow
                      colSpan={6}
                      message="No administrative audit records found."
                      description="Important changes made to farm records will appear here."
                    />
                  ) : (
                    activities.map((activity) => (
                      <tr
                        key={activity._id}
                        className="transition hover:bg-gray-50"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-gray-800">
                            {activity.actorName || "Unknown User"}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {activity.actorEmail || "No email"}
                          </p>

                          <span className="mt-2 inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                            {formatRole(activity.actorRole)}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              ACTION_STYLES[activity.action] ||
                              "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {formatAction(activity.action)}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-gray-700">
                            {activity.module || "General"}
                          </p>

                          {activity.entityName && (
                            <p className="mt-1 text-xs text-gray-500">
                              {activity.entityName}
                            </p>
                          )}
                        </td>

                        <td className="max-w-sm px-5 py-4">
                          <p className="text-sm text-gray-700">
                            {activity.description || "No description provided"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-gray-700">
                            {formatDate(activity.createdAt)}
                          </p>

                          <p className="mt-1 text-xs text-gray-400">
                            {formatTime(activity.createdAt)}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {activity.ipAddress || "Unknown"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* PAGINATION */}

          <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Showing{" "}
              {pagination.totalRecords === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
              {" - "}
              {Math.min(page * PAGE_SIZE, pagination.totalRecords)} of{" "}
              {pagination.totalRecords} records
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
                disabled={page >= pagination.totalPages || loading}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 px-5 py-3">
            <p className="text-xs text-gray-500">
              {isAuditTab
                ? "Administrative audit records track important changes made within the farm management system."
                : "Login activity tracks account access attempts. Passwords and authentication tokens are not displayed."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// REUSABLE SUMMARY CARD
// ============================================================

function SummaryCard({ title, value, description, color = "default" }) {
  const colors = {
    default: "border-gray-100 text-gray-800",
    green: "border-green-100 text-green-700",
    red: "border-red-100 text-red-600",
    amber: "border-amber-100 text-amber-600",
    blue: "border-blue-100 text-blue-700",
  };

  return (
    <div
      className={`rounded-xl border bg-white p-5 shadow-sm ${colors[color]}`}
    >
      <p className="text-sm text-gray-500">{title}</p>

      <p className="mt-2 text-3xl font-bold">{value}</p>

      <p className="mt-1 text-xs text-gray-400">{description}</p>
    </div>
  );
}

// ============================================================
// REUSABLE EMPTY TABLE ROW
// ============================================================

function EmptyRow({ colSpan, message, description }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-12 text-center">
        <p className="font-medium text-gray-600">{message}</p>

        <p className="mt-1 text-sm text-gray-400">{description}</p>
      </td>
    </tr>
  );
}
