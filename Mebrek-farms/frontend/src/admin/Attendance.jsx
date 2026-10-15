import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  fetchAttendance,
  fetchAttendanceWorkers,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  restoreAttendance,
} from "../services/attendanceService";

const STATUSES = [
  "Present",
  "Absent",
  "Late",
  "Leave",
  "Sick Leave",
  "Holiday",
  "Off Day",
];

const STATUS_COLORS = {
  Present: "bg-green-100 text-green-800",
  Absent: "bg-red-100 text-red-800",
  Late: "bg-amber-100 text-amber-800",
  Leave: "bg-blue-100 text-blue-800",
  "Sick Leave": "bg-purple-100 text-purple-800",
  Holiday: "bg-cyan-100 text-cyan-800",
  "Off Day": "bg-gray-100 text-gray-700",
};

const localDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const currentTime = () => {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
};

const currentMonth = () => localDate().slice(0, 7);

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const formatHours = (value) => `${Number(value || 0).toFixed(2)} hrs`;

const getRecordDate = (item) =>
  item.attendanceDate ||
  (item.createdAt ? localDate(new Date(item.createdAt)) : "");

const getWorkerId = (item) =>
  typeof item.workerId === "object" ? item.workerId?._id : item.workerId;

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600";

const buttonClass =
  "rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export default function Attendance() {
  const role = localStorage.getItem("role");
  const canDelete = role === "manager" || role === "superadmin";
  const isSuperadmin = role === "superadmin";

  const [attendance, setAttendance] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [dateFilter, setDateFilter] = useState(localDate());
  const [monthFilter, setMonthFilter] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [workerHistoryId, setWorkerHistoryId] = useState("All");

  const [formData, setFormData] = useState({
    workerId: "",
    attendanceDate: localDate(),
    status: "Present",
    checkInTime: "",
    checkOutTime: "",
    remarks: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [attendanceResult, workerResult] = await Promise.all([
        fetchAttendance(),
        fetchAttendanceWorkers(),
      ]);

      setAttendance(Array.isArray(attendanceResult) ? attendanceResult : []);
      setWorkers(Array.isArray(workerResult) ? workerResult : []);
    } catch (err) {
      console.error("LOAD ATTENDANCE ERROR:", err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Unable to load attendance. Check the backend connection.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeAttendance = useMemo(
    () => attendance.filter((item) => !item.isDeleted),
    [attendance],
  );

  const dailyRecords = useMemo(
    () => activeAttendance.filter((item) => getRecordDate(item) === dateFilter),
    [activeAttendance, dateFilter],
  );

  const dailyStats = useMemo(
    () => ({
      total: dailyRecords.length,
      present: dailyRecords.filter((item) => item.status === "Present").length,
      late: dailyRecords.filter((item) => item.status === "Late" || item.isLate)
        .length,
      absent: dailyRecords.filter((item) => item.status === "Absent").length,
      leave: dailyRecords.filter((item) =>
        ["Leave", "Sick Leave"].includes(item.status),
      ).length,
    }),
    [dailyRecords],
  );

  const monthlyRecords = useMemo(
    () =>
      activeAttendance.filter((item) =>
        getRecordDate(item).startsWith(monthFilter),
      ),
    [activeAttendance, monthFilter],
  );

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();

    return attendance
      .filter((item) => {
        const itemDate = getRecordDate(item);
        const matchesDate =
          isSuperadmin && item.isDeleted
            ? itemDate.startsWith(monthFilter)
            : itemDate.startsWith(monthFilter);

        const matchesSearch =
          !term ||
          [item.workerName, item.role, item.remarks, item.status].some(
            (value) =>
              String(value || "")
                .toLowerCase()
                .includes(term),
          );

        const matchesStatus =
          statusFilter === "All" || item.status === statusFilter;

        const matchesWorker =
          workerHistoryId === "All" ||
          String(getWorkerId(item) || "") === workerHistoryId;

        return matchesDate && matchesSearch && matchesStatus && matchesWorker;
      })
      .sort((a, b) => {
        const dateDifference = getRecordDate(b).localeCompare(getRecordDate(a));
        if (dateDifference !== 0) return dateDifference;
        return String(b.createdAt || "").localeCompare(
          String(a.createdAt || ""),
        );
      });
  }, [
    attendance,
    isSuperadmin,
    monthFilter,
    search,
    statusFilter,
    workerHistoryId,
  ]);

  const calendarDays = useMemo(() => {
    const [year, month] = monthFilter.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1).getDay();
    const numberOfDays = new Date(year, month, 0).getDate();

    const days = Array(firstDay).fill(null);
    for (let day = 1; day <= numberOfDays; day += 1) {
      days.push(day);
    }
    return days;
  }, [monthFilter]);

  const calendarCounts = useMemo(() => {
    const counts = {};

    monthlyRecords.forEach((item) => {
      const day = getRecordDate(item).slice(-2);
      if (!day) return;
      counts[Number(day)] = (counts[Number(day)] || 0) + 1;
    });

    return counts;
  }, [monthlyRecords]);

  const selectedWorker = workers.find(
    (worker) => worker._id === formData.workerId,
  );

  const updateForm = (field, value) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
  };

  const handleWorkerChange = (workerId) => {
    const worker = workers.find((item) => item._id === workerId);

    setFormData((previous) => ({
      ...previous,
      workerId,
    }));

    if (worker) {
      const workerRecord = activeAttendance.find(
        (item) =>
          String(getWorkerId(item) || "") === String(workerId) &&
          getRecordDate(item) === formData.attendanceDate,
      );

      if (workerRecord) {
        setNotice(
          `${workerRecord.workerName} already has a record for ${formData.attendanceDate}.`,
        );
      } else {
        setNotice("");
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!selectedWorker) {
      setError("Select an active worker before saving attendance.");
      return;
    }

    const duplicate = attendance.find(
      (item) =>
        String(getWorkerId(item) || "") === String(selectedWorker._id) &&
        getRecordDate(item) === formData.attendanceDate,
    );

    if (duplicate) {
      setError(
        `${selectedWorker.workerName} already has a record for ${formData.attendanceDate}. Edit the existing record instead.`,
      );
      return;
    }

    setSaving(true);

    try {
      await createAttendance({
        workerId: selectedWorker._id,
        workerName: selectedWorker.workerName,
        role: selectedWorker.role,
        attendanceDate: formData.attendanceDate,
        status: formData.status,
        checkInTime: formData.checkInTime,
        checkOutTime: formData.checkOutTime,
        remarks: formData.remarks,
      });

      setNotice("Attendance saved successfully.");
      setFormData({
        workerId: "",
        attendanceDate: dateFilter || localDate(),
        status: "Present",
        checkInTime: "",
        checkOutTime: "",
        remarks: "",
      });

      await loadData();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Unable to save attendance.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTimeAction = async (item, field) => {
    setError("");
    setNotice("");

    try {
      const time = currentTime();

      await updateAttendance(item._id, {
        [field]: time,
      });

      setNotice(
        `${field === "checkInTime" ? "Check-in" : "Check-out"} recorded for ${item.workerName}.`,
      );
      await loadData();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Unable to update attendance.",
      );
    }
  };

  const handleStatusChange = async (item, status) => {
    setError("");
    setNotice("");

    try {
      await updateAttendance(item._id, { status });
      setNotice(`Status updated for ${item.workerName}.`);
      await loadData();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Unable to update status.",
      );
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Soft-delete this attendance record?")) return;

    try {
      await deleteAttendance(id);
      setNotice("Attendance record deleted.");
      await loadData();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Unable to delete attendance.",
      );
    }
  };

  const handleRestore = async (id) => {
    try {
      await restoreAttendance(id);
      setNotice("Attendance record restored.");
      await loadData();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Unable to restore attendance.",
      );
    }
  };

  const exportRows = monthlyRecords.map((item) => ({
    Date: getRecordDate(item),
    Worker: item.workerName || "",
    Role: item.role || "",
    Status: item.status || "",
    "Check In": item.checkInTime || "",
    "Check Out": item.checkOutTime || "",
    "Scheduled Start": item.scheduledStartTime || "08:00",
    Late: item.isLate ? "Yes" : "No",
    "Working Hours": Number(item.workingHours || 0),
    Remarks: item.remarks || "",
  }));

  const exportExcel = () => {
    if (!exportRows.length) {
      setError("There are no attendance records for the selected month.");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet["!cols"] = [
      { wch: 13 },
      { wch: 25 },
      { wch: 20 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 8 },
      { wch: 16 },
      { wch: 35 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    XLSX.writeFile(workbook, `attendance-${monthFilter}.xlsx`);
  };

  const exportPDF = () => {
    if (!exportRows.length) {
      setError("There are no attendance records for the selected month.");
      return;
    }

    const pdf = new jsPDF({ orientation: "landscape" });

    pdf.setFontSize(16);
    pdf.text(`Mebrek Farms Attendance Report — ${monthFilter}`, 14, 15);

    autoTable(pdf, {
      startY: 22,
      head: [
        [
          "Date",
          "Worker",
          "Role",
          "Status",
          "Check In",
          "Check Out",
          "Late",
          "Hours",
          "Remarks",
        ],
      ],
      body: exportRows.map((row) => [
        row.Date,
        row.Worker,
        row.Role,
        row.Status,
        row["Check In"],
        row["Check Out"],
        row.Late,
        row["Working Hours"],
        row.Remarks,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [21, 128, 61] },
    });

    pdf.save(`attendance-${monthFilter}.pdf`);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            Farm Attendance
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Record attendance, monitor working hours, and review monthly
            reports.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportExcel}
            className={`${buttonClass} bg-green-700 text-white hover:bg-green-800`}
          >
            Export Excel
          </button>
          <button
            type="button"
            onClick={exportPDF}
            className={`${buttonClass} bg-gray-800 text-white hover:bg-gray-900`}
          >
            Export PDF
          </button>
          <button
            type="button"
            onClick={loadData}
            className={`${buttonClass} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </div>
      )}

      {/* Daily dashboard */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Records", dailyStats.total, "bg-white"],
          ["Present", dailyStats.present, "bg-green-50"],
          ["Late", dailyStats.late, "bg-amber-50"],
          ["Absent", dailyStats.absent, "bg-red-50"],
          ["On Leave", dailyStats.leave, "bg-blue-50"],
        ].map(([label, value, color]) => (
          <div
            key={label}
            className={`rounded-xl border border-gray-200 p-4 ${color}`}
          >
            <p className="text-sm text-gray-600">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </section>

      {/* Manual attendance form */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
        <h2 className="mb-4 text-lg font-bold text-gray-900">
          Record Attendance
        </h2>

        <form
          onSubmit={handleSubmit}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          <label className="text-sm font-medium text-gray-700">
            Worker
            <select
              className={`${inputClass} mt-1`}
              value={formData.workerId}
              onChange={(event) => handleWorkerChange(event.target.value)}
              required
            >
              <option value="">Select worker</option>
              {workers.map((worker) => (
                <option key={worker._id} value={worker._id}>
                  {worker.workerName}
                  {worker.employeeId ? ` (${worker.employeeId})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Attendance Date
            <input
              className={`${inputClass} mt-1`}
              type="date"
              value={formData.attendanceDate}
              onChange={(event) =>
                updateForm("attendanceDate", event.target.value)
              }
              required
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Status
            <select
              className={`${inputClass} mt-1`}
              value={formData.status}
              onChange={(event) => updateForm("status", event.target.value)}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Check-in Time
            <input
              className={`${inputClass} mt-1`}
              type="time"
              value={formData.checkInTime}
              onChange={(event) =>
                updateForm("checkInTime", event.target.value)
              }
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Check-out Time
            <input
              className={`${inputClass} mt-1`}
              type="time"
              value={formData.checkOutTime}
              onChange={(event) =>
                updateForm("checkOutTime", event.target.value)
              }
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Remarks
            <input
              className={`${inputClass} mt-1`}
              type="text"
              placeholder="Optional note"
              value={formData.remarks}
              onChange={(event) => updateForm("remarks", event.target.value)}
            />
          </label>

          {selectedWorker && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-900 md:col-span-2 xl:col-span-3">
              <strong>{selectedWorker.workerName}</strong>
              {" · "}
              {selectedWorker.role}
              {" · "}Scheduled start:{" "}
              {selectedWorker.startTime || "08:00 (default)"}
              {selectedWorker.endTime
                ? ` · Scheduled finish: ${selectedWorker.endTime}`
                : ""}
            </div>
          )}

          <div className="md:col-span-2 xl:col-span-3">
            <button
              type="submit"
              disabled={saving || loading}
              className={`${buttonClass} bg-green-700 text-white hover:bg-green-800`}
            >
              {saving ? "Saving..." : "Save Attendance"}
            </button>
          </div>
        </form>
      </section>

      {/* Monthly calendar */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Monthly Calendar
            </h2>
            <p className="text-sm text-gray-500">
              Number of attendance records recorded for each day.
            </p>
          </div>
          <label className="text-sm font-medium text-gray-700">
            Report Month
            <input
              className={`${inputClass} mt-1`}
              type="month"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
            />
          </label>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 sm:gap-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarDays.map((day, index) => (
            <button
              key={`${monthFilter}-${index}`}
              type="button"
              disabled={!day}
              onClick={() => {
                const [year, month] = monthFilter.split("-");
                const chosenDate = `${year}-${month}-${String(day).padStart(2, "0")}`;
                setDateFilter(chosenDate);
                setFormData((previous) => ({
                  ...previous,
                  attendanceDate: chosenDate,
                }));
              }}
              className={`min-h-14 rounded-lg border p-1 text-sm sm:min-h-16 ${
                !day
                  ? "border-transparent"
                  : dateFilter ===
                      `${monthFilter}-${String(day).padStart(2, "0")}`
                    ? "border-green-700 bg-green-50 font-bold text-green-800"
                    : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              {day && (
                <>
                  <span>{day}</span>
                  {calendarCounts[day] ? (
                    <span className="mt-1 block text-xs text-green-700">
                      {calendarCounts[day]} record
                      {calendarCounts[day] === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Filters and history */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium text-gray-700">
            Daily Dashboard Date
            <input
              className={`${inputClass} mt-1`}
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Search
            <input
              className={`${inputClass} mt-1`}
              type="search"
              placeholder="Worker, role, remarks..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="text-sm font-medium text-gray-700">
            Status Filter
            <select
              className={`${inputClass} mt-1`}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="All">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Worker History
            <select
              className={`${inputClass} mt-1`}
              value={workerHistoryId}
              onChange={(event) => setWorkerHistoryId(event.target.value)}
            >
              <option value="All">All workers</option>
              {workers.map((worker) => (
                <option key={worker._id} value={worker._id}>
                  {worker.workerName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900">
            Attendance Records
          </h2>
          <p className="text-sm text-gray-500">
            {filteredRecords.length} record
            {filteredRecords.length === 1 ? "" : "s"}
            {" · "}Month: {monthFilter}
          </p>
        </div>

        {loading ? (
          <p className="py-10 text-center text-gray-500">
            Loading attendance...
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-green-800 text-white">
                <tr>
                  <th className="p-3">Worker</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Check In</th>
                  <th className="p-3">Check Out</th>
                  <th className="p-3">Late</th>
                  <th className="p-3">Hours</th>
                  {isSuperadmin && <th className="p-3">Deleted By</th>}
                  {(canDelete || isSuperadmin) && (
                    <th className="p-3">Actions</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map((item) => (
                  <tr
                    key={item._id}
                    className={`border-b border-gray-100 ${
                      item.isDeleted
                        ? "bg-red-50 opacity-80"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="p-3 font-medium text-gray-900">
                      {item.workerName}
                      {item.isDeleted && (
                        <span className="ml-2 rounded bg-red-600 px-2 py-1 text-xs text-white">
                          Deleted
                        </span>
                      )}
                      {item.remarks && (
                        <p className="mt-1 max-w-48 truncate text-xs text-gray-500">
                          {item.remarks}
                        </p>
                      )}
                    </td>

                    <td className="p-3">{item.role}</td>
                    <td className="p-3">{formatDate(getRecordDate(item))}</td>

                    <td className="p-3">
                      {item.isDeleted ? (
                        <span className="text-gray-500">{item.status}</span>
                      ) : (
                        <select
                          className="rounded border border-gray-200 bg-white p-1.5"
                          value={item.status}
                          onChange={(event) =>
                            handleStatusChange(item, event.target.value)
                          }
                        >
                          {STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      )}
                      {!item.isDeleted && (
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-1 text-xs ${
                            STATUS_COLORS[item.status] ||
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      )}
                    </td>

                    <td className="p-3">
                      <div>{item.checkInTime || "—"}</div>
                      {!item.isDeleted && !item.checkInTime && (
                        <button
                          type="button"
                          onClick={() => handleTimeAction(item, "checkInTime")}
                          className="mt-1 text-xs font-semibold text-green-700 hover:underline"
                        >
                          Check in now
                        </button>
                      )}
                    </td>

                    <td className="p-3">
                      <div>{item.checkOutTime || "—"}</div>
                      {!item.isDeleted &&
                        item.checkInTime &&
                        !item.checkOutTime && (
                          <button
                            type="button"
                            onClick={() =>
                              handleTimeAction(item, "checkOutTime")
                            }
                            className="mt-1 text-xs font-semibold text-blue-700 hover:underline"
                          >
                            Check out now
                          </button>
                        )}
                    </td>

                    <td className="p-3">
                      {item.isLate ? (
                        <span className="font-semibold text-amber-700">
                          Yes
                        </span>
                      ) : (
                        "No"
                      )}
                    </td>

                    <td className="p-3">{formatHours(item.workingHours)}</td>

                    {isSuperadmin && (
                      <td className="p-3 text-xs text-gray-600">
                        {item.isDeleted
                          ? `${item.deletedByName || item.deletedBy?.name || "Unknown"}${item.deletedByRole ? ` (${item.deletedByRole})` : ""}`
                          : "—"}
                      </td>
                    )}

                    {(canDelete || isSuperadmin) && (
                      <td className="p-3">
                        {item.isDeleted
                          ? isSuperadmin && (
                              <button
                                type="button"
                                onClick={() => handleRestore(item._id)}
                                className={`${buttonClass} bg-green-700 text-white hover:bg-green-800`}
                              >
                                Restore
                              </button>
                            )
                          : canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDelete(item._id)}
                                className={`${buttonClass} bg-red-600 text-white hover:bg-red-700`}
                              >
                                Delete
                              </button>
                            )}
                      </td>
                    )}
                  </tr>
                ))}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td
                      colSpan={isSuperadmin ? 10 : canDelete ? 9 : 8}
                      className="p-10 text-center text-gray-500"
                    >
                      No attendance records found for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
