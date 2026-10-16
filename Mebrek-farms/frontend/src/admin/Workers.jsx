import { useEffect, useState } from "react";

import {
  fetchWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
} from "../services/workerService";

import apiClient from "../services/apiClient";

const initialFormData = {
  // ============================================================

  // WORKER IDENTIFICATION

  // ============================================================

  employeeId: "",

  // ============================================================

  // PERSONAL INFORMATION

  // ============================================================

  firstName: "",

  lastName: "",

  dateOfBirth: "",

  gender: "",

  maritalStatus: "",

  // ============================================================

  // CONTACT INFORMATION

  // ============================================================

  phone: "",

  alternativePhone: "",

  email: "",

  address: "",

  city: "",

  state: "",

  country: "Nigeria",

  // ============================================================

  // IDENTIFICATION DETAILS

  // ============================================================

  idType: "",

  idNumber: "",

  idIssueDate: "",

  idExpiryDate: "",

  // ============================================================

  // EMPLOYMENT DETAILS

  // ============================================================

  role: "",

  department: "",

  employmentType: "Permanent",

  status: "Active",

  terminationDate: "",

  terminationReason: "",

  hireDate: "",

  assignedFarmArea: "",

  supervisor: "",

  workShift: "",

  startTime: "",

  endTime: "",

  // ============================================================

  // SALARY / PAYMENT

  // ============================================================

  salary: "",

  paymentFrequency: "Monthly",

  // ============================================================

  // NEXT OF KIN / EMERGENCY CONTACT

  // ============================================================

  nextOfKinName: "",

  nextOfKinRelationship: "",

  nextOfKinPhone: "",

  nextOfKinAlternativePhone: "",

  nextOfKinAddress: "",

  nextOfKinOccupation: "",

  // ============================================================

  // WORK EXPERIENCE / SKILLS

  // ============================================================

  previousEmployer: "",

  previousPosition: "",

  previousDuties: "",

  skillsExperience: "",

  // ============================================================

  // BANK / PAYMENT INFORMATION

  // ============================================================

  bankName: "",

  accountName: "",

  accountNumber: "",

  bvn: "",

  // ============================================================

  // HEALTH / SAFETY

  // ============================================================

  workRestrictions: "",

  allergies: "",

  medicalNotes: "",

  bloodGroup: "",

  // ============================================================

  // PPE / SAFETY EQUIPMENT

  // ============================================================

  ppeIssued: [],

  // ============================================================

  // DOCUMENTS

  // ============================================================

  passportPhoto: "",

  idDocument: "",

  employmentAgreement: "",

  otherDocuments: "",

  // ============================================================

  // ADMINISTRATIVE

  // ============================================================

  remarks: "",
};

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

  const [formData, setFormData] = useState(initialFormData);

  // Attendance summary for the selected worker.
  const [attendanceWorker, setAttendanceWorker] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [attendanceStartDate, setAttendanceStartDate] = useState("");
  const [attendanceEndDate, setAttendanceEndDate] = useState("");

  // ============================================================

  // LOAD DATA

  // ============================================================

  useEffect(() => {
    loadWorkers();

    loadStats();
  }, []);

  const loadWorkers = async () => {
    try {
      const data = await fetchWorkers();

      setWorkers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load workers:", err);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiClient.get("/workers/stats");

      /*

       * Supports both:

       *

       * apiClient returning response.data

       *

       * and Axios-style response.data.

       */

      const data =
        response?.data && typeof response.data === "object"
          ? response.data
          : response;

      setStats({
        totalWorkers: data?.totalWorkers || 0,

        totalSalary: data?.totalSalary || 0,

        avgSalary: data?.avgSalary || 0,

        recentWorkers: data?.recentWorkers || [],
      });
    } catch (err) {
      console.error("Failed to load worker statistics:", err);
    }
  };

  // ============================================================
  // LOAD ATTENDANCE SUMMARY FOR A WORKER
  // ============================================================

  const loadAttendanceSummary = async (
    worker,
    startDate = attendanceStartDate,
    endDate = attendanceEndDate,
  ) => {
    if (!worker?._id) return;

    setAttendanceWorker(worker);
    setAttendanceLoading(true);
    setAttendanceError("");

    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const query = params.toString();
      const response = await apiClient.get(
        `/workers/${worker._id}/attendance-summary${query ? `?${query}` : ""}`,
      );
      const data =
        response?.data && typeof response.data === "object"
          ? response.data
          : response;
      setAttendanceSummary(data || null);
    } catch (err) {
      console.error("Failed to load worker attendance summary:", err);
      setAttendanceSummary(null);
      setAttendanceError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Unable to load attendance summary. Check that the attendance-summary backend route is available.",
      );
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleAttendanceDateFilter = async (e) => {
    e.preventDefault();
    if (attendanceWorker)
      await loadAttendanceSummary(
        attendanceWorker,
        attendanceStartDate,
        attendanceEndDate,
      );
  };

  // ============================================================
  // HANDLE INPUT CHANGES

  // ============================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,

      [name]: value,
    }));
  };

  // ============================================================

  // HANDLE PPE CHECKBOXES

  // ============================================================

  const handlePPEChange = (item) => {
    setFormData((previous) => {
      const currentPPE = previous.ppeIssued || [];

      const alreadySelected = currentPPE.includes(item);

      return {
        ...previous,

        ppeIssued: alreadySelected
          ? currentPPE.filter((ppe) => ppe !== item)
          : [...currentPPE, item],
      };
    });
  };

  // ============================================================

  // RESET FORM

  // ============================================================

  const resetForm = () => {
    setEditingId(null);

    setFormData({
      ...initialFormData,
    });
  };

  // ============================================================

  // SUBMIT FORM

  // ============================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.status === "Terminated") {
      if (!formData.terminationDate) {
        alert("Please enter the termination date for a terminated worker.");
        return;
      }
      if (!String(formData.terminationReason || "").trim()) {
        alert("Please enter the reason for termination.");
        return;
      }
    }

    try {
      setLoading(true);

      const payload = {
        ...formData,

        /*

         * Convert salary to a number before

         * sending to backend.

         */

        salary: formData.salary === "" ? 0 : Number(formData.salary),
      };

      if (editingId) {
        await updateWorker(editingId, payload);
      } else {
        await createWorker(payload);
      }

      resetForm();

      await loadWorkers();

      await loadStats();
    } catch (err) {
      console.error("Failed to save worker:", err);

      alert(err?.response?.data?.message || "Failed to save worker.");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================

  // EDIT WORKER

  // ============================================================

  const handleEdit = (worker) => {
    setEditingId(worker._id);

    setFormData({
      ...initialFormData,

      employeeId: worker.employeeId || "",

      firstName: worker.firstName || "",

      lastName: worker.lastName || "",

      dateOfBirth: worker.dateOfBirth
        ? worker.dateOfBirth.substring(0, 10)
        : "",

      gender: worker.gender || "",

      maritalStatus: worker.maritalStatus || "",

      phone: worker.phone || "",

      alternativePhone: worker.alternativePhone || "",

      email: worker.email || "",

      address: worker.address || "",

      city: worker.city || "",

      state: worker.state || "",

      country: worker.country || "Nigeria",

      idType: worker.idType || "",

      idNumber: worker.idNumber || "",

      idIssueDate: worker.idIssueDate
        ? worker.idIssueDate.substring(0, 10)
        : "",

      idExpiryDate: worker.idExpiryDate
        ? worker.idExpiryDate.substring(0, 10)
        : "",

      role: worker.role || "",

      department: worker.department || "",

      employmentType: worker.employmentType || "Permanent",

      status: worker.status || "Active",

      terminationDate: worker.terminationDate
        ? String(worker.terminationDate).substring(0, 10)
        : "",

      terminationReason: worker.terminationReason || "",

      hireDate:
        worker.hireDate || worker.dateHired
          ? String(worker.hireDate || worker.dateHired).substring(0, 10)
          : "",

      assignedFarmArea: worker.assignedFarmArea || "",

      supervisor: worker.supervisor || "",

      workShift: worker.workShift || "",

      startTime: worker.startTime || "",

      endTime: worker.endTime || "",

      salary: worker.salary ?? "",

      paymentFrequency: worker.paymentFrequency || "Monthly",

      nextOfKinName: worker.nextOfKinName || "",

      nextOfKinRelationship: worker.nextOfKinRelationship || "",

      nextOfKinPhone: worker.nextOfKinPhone || "",

      nextOfKinAlternativePhone: worker.nextOfKinAlternativePhone || "",

      nextOfKinAddress: worker.nextOfKinAddress || "",

      nextOfKinOccupation: worker.nextOfKinOccupation || "",

      previousEmployer: worker.previousEmployer || "",

      previousPosition: worker.previousPosition || "",

      previousDuties: worker.previousDuties || "",

      skillsExperience: worker.skillsExperience || "",

      bankName: worker.bankName || "",

      accountName: worker.accountName || "",

      accountNumber: worker.accountNumber || "",

      bvn: worker.bvn || "",

      workRestrictions: worker.workRestrictions || "",

      allergies: worker.allergies || "",

      medicalNotes: worker.medicalNotes || "",

      bloodGroup: worker.bloodGroup || "",

      ppeIssued: Array.isArray(worker.ppeIssued) ? worker.ppeIssued : [],

      passportPhoto: worker.passportPhoto || "",

      idDocument: worker.idDocument || "",

      employmentAgreement: worker.employmentAgreement || "",

      otherDocuments: worker.otherDocuments || "",

      remarks: worker.remarks || "",
    });

    window.scrollTo({
      top: 0,

      behavior: "smooth",
    });
  };

  // ============================================================

  // DELETE WORKER

  // ============================================================

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this worker?")) {
      return;
    }

    try {
      await deleteWorker(id);

      await loadWorkers();

      await loadStats();
    } catch (err) {
      console.error("Failed to delete worker:", err);

      alert(err?.response?.data?.message || "Failed to delete worker.");
    }
  };

  // ============================================================

  // FORMAT DATE

  // ============================================================

  const formatDate = (date) => {
    if (!date) {
      return "—";
    }

    return new Date(date).toLocaleDateString();
  };

  // Calculate employment duration from the hire date to today.
  // This is derived for display only and is not stored in the database.
  const formatEmploymentDuration = (hireDate) => {
    if (!hireDate) {
      return "Hire date not set";
    }

    // Parse YYYY-MM-DD as a local calendar date to avoid timezone shifts.
    const dateText = String(hireDate).substring(0, 10);
    const parts = dateText.split("-").map(Number);

    if (
      parts.length !== 3 ||
      parts.some((part) => !Number.isFinite(part)) ||
      parts[0] < 1 ||
      parts[1] < 1 ||
      parts[1] > 12 ||
      parts[2] < 1 ||
      parts[2] > 31
    ) {
      return "Invalid hire date";
    }

    const start = new Date(parts[0], parts[1] - 1, parts[2]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Reject invalid calendar dates such as 31 February.
    if (
      start.getFullYear() !== parts[0] ||
      start.getMonth() !== parts[1] - 1 ||
      start.getDate() !== parts[2]
    ) {
      return "Invalid hire date";
    }

    start.setHours(0, 0, 0, 0);

    if (start > today) {
      return "Not started";
    }

    let years = today.getFullYear() - start.getFullYear();
    let months = today.getMonth() - start.getMonth();
    let days = today.getDate() - start.getDate();

    if (days < 0) {
      months -= 1;
      // The number of days in the previous month relative to today.
      const daysInPreviousMonth = new Date(
        today.getFullYear(),
        today.getMonth(),
        0,
      ).getDate();
      days += daysInPreviousMonth;
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const partsOut = [];
    if (years > 0) partsOut.push(`${years} ${years === 1 ? "year" : "years"}`);
    if (months > 0)
      partsOut.push(`${months} ${months === 1 ? "month" : "months"}`);
    if (days > 0 || partsOut.length === 0) {
      partsOut.push(`${days} ${days === 1 ? "day" : "days"}`);
    }

    return partsOut.join(", ");
  };

  // ============================================================

  // RENDER

  // ============================================================

  return (
    <div className="p-6">
      {/* ======================================================

          PAGE HEADER

      ====================================================== */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Workers Management</h1>

          <p className="text-gray-500 mt-1">
            Manage worker information, employment records, and payroll details.
          </p>
        </div>

        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="bg-gray-500 text-white px-5 py-2 rounded hover:bg-gray-600"
          >
            Cancel Edit
          </button>
        )}
      </div>

      {/* ======================================================

          ANALYTICS CARDS

      ====================================================== */}

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white shadow rounded p-5">
          <h3 className="text-gray-500">Total Workers</h3>

          <p className="text-3xl font-bold mt-2">{stats.totalWorkers}</p>
        </div>

        <div className="bg-white shadow rounded p-5">
          <h3 className="text-gray-500">Monthly Payroll</h3>

          <p className="text-3xl font-bold text-green-600 mt-2">
            ₦{Number(stats.totalSalary || 0).toLocaleString()}
          </p>
        </div>

        <div className="bg-white shadow rounded p-5">
          <h3 className="text-gray-500">Average Salary</h3>

          <p className="text-3xl font-bold text-blue-600 mt-2">
            ₦{Math.round(Number(stats.avgSalary || 0)).toLocaleString()}
          </p>
        </div>
      </div>

      {/* ======================================================
          WORKER ATTENDANCE SUMMARY
      ====================================================== */}

      {attendanceWorker && (
        <section className="bg-white shadow rounded-xl p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl font-bold">Attendance Summary</h2>
              <p className="text-gray-600 mt-1">
                {attendanceWorker.firstName} {attendanceWorker.lastName}
                {attendanceWorker.employeeId
                  ? ` · ${attendanceWorker.employeeId}`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAttendanceWorker(null);
                setAttendanceSummary(null);
                setAttendanceError("");
              }}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Close Summary
            </button>
          </div>

          <form
            onSubmit={handleAttendanceDateFilter}
            className="grid sm:grid-cols-3 gap-3 mb-5"
          >
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                From date
              </label>
              <input
                type="date"
                value={attendanceStartDate}
                onChange={(e) => setAttendanceStartDate(e.target.value)}
                className="border p-2 rounded w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                To date
              </label>
              <input
                type="date"
                value={attendanceEndDate}
                min={attendanceStartDate || undefined}
                onChange={(e) => setAttendanceEndDate(e.target.value)}
                className="border p-2 rounded w-full"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                disabled={attendanceLoading}
              >
                {attendanceLoading ? "Loading..." : "Apply Dates"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAttendanceStartDate("");
                  setAttendanceEndDate("");
                  loadAttendanceSummary(attendanceWorker, "", "");
                }}
                className="border px-4 py-2 rounded hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </form>

          {attendanceError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">
              {attendanceError}
            </div>
          )}
          {attendanceLoading && (
            <p className="text-gray-500 py-4">Loading attendance records…</p>
          )}
          {!attendanceLoading && attendanceSummary && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  [
                    "Recorded Workdays",
                    attendanceSummary.recordedWorkdays ??
                      attendanceSummary.counts?.total ??
                      0,
                  ],
                  [
                    "Attended Days",
                    attendanceSummary.attendedWorkdays ??
                      attendanceSummary.counts?.present ??
                      0,
                  ],
                  [
                    "Late Arrivals",
                    attendanceSummary.lateArrivalCount ??
                      attendanceSummary.counts?.late ??
                      0,
                  ],
                  [
                    "Attendance Rate",
                    `${Number(attendanceSummary.attendanceRate ?? 0).toFixed(1)}%`,
                  ],
                  [
                    "Punctuality Rate",
                    `${Number(attendanceSummary.punctualityRate ?? 0).toFixed(1)}%`,
                  ],
                  [
                    "Total Hours",
                    Number(attendanceSummary.totalWorkingHours ?? 0).toFixed(1),
                  ],
                  [
                    "Average Hours / Day",
                    Number(attendanceSummary.averageWorkingHours ?? 0).toFixed(
                      1,
                    ),
                  ],
                  ["Absent Days", attendanceSummary.counts?.absent ?? 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded border bg-gray-50 p-4">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-2xl font-bold mt-1">{value}</p>
                  </div>
                ))}
              </div>
              <h3 className="font-semibold mb-2">Attendance Records</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Check In</th>
                      <th className="text-left p-2">Check Out</th>
                      <th className="text-left p-2">Hours</th>
                      <th className="text-left p-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!Array.isArray(attendanceSummary.records) ||
                    attendanceSummary.records.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-4 text-center text-gray-500"
                        >
                          No attendance records for this period.
                        </td>
                      </tr>
                    ) : (
                      attendanceSummary.records.map((record, index) => (
                        <tr
                          key={
                            record._id ||
                            `${record.attendanceDate || record.date || "record"}-${index}`
                          }
                          className="border-b"
                        >
                          <td className="p-2">
                            {formatDate(record.attendanceDate || record.date)}
                          </td>
                          <td className="p-2">{record.status || "—"}</td>
                          <td className="p-2">
                            {record.checkInTime || record.checkIn || "—"}
                          </td>
                          <td className="p-2">
                            {record.checkOutTime || record.checkOut || "—"}
                          </td>
                          <td className="p-2">
                            {record.workingHours ?? record.hoursWorked ?? "—"}
                          </td>
                          <td className="p-2">{record.remarks || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {/* ======================================================
          WORKER FORM
      ====================================================== */}

      <div className="bg-white shadow rounded-xl p-6 mb-8">
        <div className="border-b pb-4 mb-6">
          <h2 className="text-xl font-bold">
            {editingId ? "Edit Worker" : "Add Worker"}
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Complete the worker information below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* ==================================================

              1. PERSONAL INFORMATION

          ================================================== */}

          <section>
            <h3 className="text-lg font-bold text-green-700 border-b pb-2 mb-4">
              1. Personal Information
            </h3>

            <div className="grid md:grid-cols-3 gap-4">
              <input
                name="employeeId"
                placeholder="Worker ID / Staff No."
                value={formData.employeeId}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="firstName"
                placeholder="First Name"
                value={formData.firstName}
                onChange={handleChange}
                className="border p-3 rounded"
                required
              />

              <input
                name="lastName"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={handleChange}
                className="border p-3 rounded"
                required
              />

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Date of Birth
                </label>

                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className="border p-3 rounded w-full"
                />
              </div>

              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="border p-3 rounded"
              >
                <option value="">Select Gender</option>

                <option value="Male">Male</option>

                <option value="Female">Female</option>

                <option value="Other">Other</option>
              </select>

              <select
                name="maritalStatus"
                value={formData.maritalStatus}
                onChange={handleChange}
                className="border p-3 rounded"
              >
                <option value="">Marital Status</option>

                <option value="Single">Single</option>

                <option value="Married">Married</option>

                <option value="Divorced">Divorced</option>

                <option value="Widowed">Widowed</option>
              </select>
            </div>
          </section>

          {/* ==================================================

              2. CONTACT INFORMATION

          ================================================== */}

          <section>
            <h3 className="text-lg font-bold text-green-700 border-b pb-2 mb-4">
              2. Contact Information
            </h3>

            <div className="grid md:grid-cols-3 gap-4">
              <input
                name="phone"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="alternativePhone"
                placeholder="Alternative Phone"
                value={formData.alternativePhone}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="address"
                placeholder="Residential Address"
                value={formData.address}
                onChange={handleChange}
                className="border p-3 rounded md:col-span-2"
              />

              <input
                name="city"
                placeholder="City / Town"
                value={formData.city}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="state"
                placeholder="State"
                value={formData.state}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="country"
                placeholder="Country"
                value={formData.country}
                onChange={handleChange}
                className="border p-3 rounded"
              />
            </div>
          </section>

          {/* ==================================================

              3. IDENTIFICATION

          ================================================== */}

          <section>
            <h3 className="text-lg font-bold text-green-700 border-b pb-2 mb-4">
              3. Identification Details
            </h3>

            <div className="grid md:grid-cols-4 gap-4">
              <select
                name="idType"
                value={formData.idType}
                onChange={handleChange}
                className="border p-3 rounded"
              >
                <option value="">ID Type</option>

                <option value="NIN">NIN</option>

                <option value="Voter's Card">Voter's Card</option>

                <option value="International Passport">
                  International Passport
                </option>

                <option value="Driver's License">Driver's License</option>

                <option value="Other">Other</option>
              </select>

              <input
                name="idNumber"
                placeholder="ID Number"
                value={formData.idNumber}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Date of Issue
                </label>

                <input
                  type="date"
                  name="idIssueDate"
                  value={formData.idIssueDate}
                  onChange={handleChange}
                  className="border p-3 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Expiry Date
                </label>

                <input
                  type="date"
                  name="idExpiryDate"
                  value={formData.idExpiryDate}
                  onChange={handleChange}
                  className="border p-3 rounded w-full"
                />
              </div>
            </div>
          </section>

          {/* ==================================================

              4. EMPLOYMENT DETAILS

          ================================================== */}

          <section>
            <h3 className="text-lg font-bold text-green-700 border-b pb-2 mb-4">
              4. Employment Details
            </h3>

            <div className="grid md:grid-cols-3 gap-4">
              <input
                name="role"
                placeholder="Position / Job Title"
                value={formData.role}
                onChange={handleChange}
                className="border p-3 rounded"
                required
              />

              <input
                name="department"
                placeholder="Department / Unit"
                value={formData.department}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <select
                name="employmentType"
                value={formData.employmentType}
                onChange={handleChange}
                className="border p-3 rounded"
              >
                <option value="Permanent">Permanent</option>

                <option value="Part-Time">Part-Time</option>

                <option value="Casual">Casual</option>

                <option value="Contract">Contract</option>

                <option value="Temporary">Temporary</option>
              </select>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Date Employed
                </label>

                <input
                  type="date"
                  name="hireDate"
                  value={formData.hireDate}
                  onChange={handleChange}
                  className="border p-3 rounded w-full"
                />
              </div>

              <input
                name="assignedFarmArea"
                placeholder="Assigned Farm Area / House / Pen"
                value={formData.assignedFarmArea}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="supervisor"
                placeholder="Supervisor / Manager"
                value={formData.supervisor}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <select
                name="workShift"
                value={formData.workShift}
                onChange={handleChange}
                className="border p-3 rounded"
              >
                <option value="">Work Shift</option>

                <option value="Morning">Morning</option>

                <option value="Afternoon">Afternoon</option>

                <option value="Night">Night</option>

                <option value="Other">Other</option>
              </select>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Expected Start Time
                </label>

                <input
                  type="time"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  className="border p-3 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Expected End Time
                </label>

                <input
                  type="time"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  className="border p-3 rounded w-full"
                />
              </div>

              <input
                type="number"
                name="salary"
                placeholder="Salary / Wage"
                value={formData.salary}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <select
                name="paymentFrequency"
                value={formData.paymentFrequency}
                onChange={handleChange}
                className="border p-3 rounded"
              >
                <option value="Monthly">Monthly</option>

                <option value="Weekly">Weekly</option>

                <option value="Daily">Daily</option>

                <option value="Other">Other</option>
              </select>

              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="border p-3 rounded"
              >
                <option value="Active">Active</option>

                <option value="Inactive">Inactive</option>

                <option value="Suspended">Suspended</option>

                <option value="Terminated">Terminated</option>

                <option value="On Leave">On Leave</option>
              </select>

              {formData.status === "Terminated" && (
                <>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Termination Date <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      name="terminationDate"
                      value={formData.terminationDate}
                      onChange={handleChange}
                      className="border p-3 rounded w-full"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">
                      Reason for Termination{" "}
                      <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      name="terminationReason"
                      value={formData.terminationReason}
                      onChange={handleChange}
                      placeholder="Record the reason for termination"
                      className="border p-3 rounded w-full"
                      rows={3}
                      required
                    />
                  </div>
                </>
              )}
            </div>
            {formData.status === "Terminated" && (
              <p className="text-sm text-red-700 mt-3">
                A termination date and reason are required before saving this
                worker.
              </p>
            )}
          </section>

          {/* ==================================================

              5. NEXT OF KIN

          ================================================== */}

          <section>
            <h3 className="text-lg font-bold text-green-700 border-b pb-2 mb-4">
              5. Next of Kin / Emergency Contact
            </h3>

            <div className="grid md:grid-cols-3 gap-4">
              <input
                name="nextOfKinName"
                placeholder="Full Name"
                value={formData.nextOfKinName}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="nextOfKinRelationship"
                placeholder="Relationship"
                value={formData.nextOfKinRelationship}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="nextOfKinPhone"
                placeholder="Phone Number"
                value={formData.nextOfKinPhone}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="nextOfKinAlternativePhone"
                placeholder="Alternative Phone"
                value={formData.nextOfKinAlternativePhone}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="nextOfKinAddress"
                placeholder="Address"
                value={formData.nextOfKinAddress}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="nextOfKinOccupation"
                placeholder="Occupation"
                value={formData.nextOfKinOccupation}
                onChange={handleChange}
                className="border p-3 rounded"
              />
            </div>
          </section>

          {/* ==================================================

              6. EXPERIENCE & SKILLS

          ================================================== */}

          <section>
            <h3 className="text-lg font-bold text-green-700 border-b pb-2 mb-4">
              6. Work Experience & Skills
            </h3>

            <div className="grid md:grid-cols-2 gap-4">
              <input
                name="previousEmployer"
                placeholder="Previous Employer / Farm"
                value={formData.previousEmployer}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="previousPosition"
                placeholder="Previous Position"
                value={formData.previousPosition}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <textarea
                name="previousDuties"
                placeholder="Previous Main Duties"
                value={formData.previousDuties}
                onChange={handleChange}
                rows={4}
                className="border p-3 rounded"
              />

              <textarea
                name="skillsExperience"
                placeholder="Relevant Skills / Experience"
                value={formData.skillsExperience}
                onChange={handleChange}
                rows={4}
                className="border p-3 rounded"
              />
            </div>
          </section>

          {/* ==================================================

              7. PAYMENT / BANK

          ================================================== */}

          <section>
            <h3 className="text-lg font-bold text-green-700 border-b pb-2 mb-4">
              7. Payment / Bank Information
            </h3>

            <div className="grid md:grid-cols-4 gap-4">
              <input
                name="bankName"
                placeholder="Bank Name"
                value={formData.bankName}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="accountName"
                placeholder="Account Name"
                value={formData.accountName}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="accountNumber"
                placeholder="Account Number"
                value={formData.accountNumber}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="bvn"
                placeholder="BVN / Payment Reference"
                value={formData.bvn}
                onChange={handleChange}
                className="border p-3 rounded"
              />
            </div>
          </section>

          {/* ==================================================

              8. HEALTH & SAFETY

          ================================================== */}

          <section>
            <h3 className="text-lg font-bold text-green-700 border-b pb-2 mb-4">
              8. Health, Safety & Farm Requirements
            </h3>

            <div className="grid md:grid-cols-2 gap-4">
              <textarea
                name="workRestrictions"
                placeholder="Work Restrictions"
                value={formData.workRestrictions}
                onChange={handleChange}
                rows={3}
                className="border p-3 rounded"
              />

              <textarea
                name="allergies"
                placeholder="Allergies"
                value={formData.allergies}
                onChange={handleChange}
                rows={3}
                className="border p-3 rounded"
              />

              <textarea
                name="medicalNotes"
                placeholder="Emergency Medical / Health Notes"
                value={formData.medicalNotes}
                onChange={handleChange}
                rows={3}
                className="border p-3 rounded"
              />

              <select
                name="bloodGroup"
                value={formData.bloodGroup}
                onChange={handleChange}
                className="border p-3 rounded"
              >
                <option value="">Blood Group</option>

                <option value="A+">A+</option>

                <option value="A-">A-</option>

                <option value="B+">B+</option>

                <option value="B-">B-</option>

                <option value="AB+">AB+</option>

                <option value="AB-">AB-</option>

                <option value="O+">O+</option>

                <option value="O-">O-</option>
              </select>
            </div>

            {/* PPE */}

            <div className="mt-5">
              <p className="font-semibold mb-3">Safety / PPE Issued</p>

              <div className="flex flex-wrap gap-4">
                {[
                  "Boots",

                  "Gloves",

                  "Coveralls",

                  "Nose Mask",

                  "Helmet",

                  "Other",
                ].map((item) => (
                  <label key={item} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.ppeIssued?.includes(item) || false}
                      onChange={() => handlePPEChange(item)}
                    />

                    {item}
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* ==================================================

              9. DOCUMENTS

          ================================================== */}

          <section>
            <h3 className="text-lg font-bold text-green-700 border-b pb-2 mb-4">
              9. Documents / Records
            </h3>

            <div className="grid md:grid-cols-2 gap-4">
              <input
                name="passportPhoto"
                placeholder="Passport Photograph Reference / URL"
                value={formData.passportPhoto}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="idDocument"
                placeholder="Identification Document Reference / URL"
                value={formData.idDocument}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="employmentAgreement"
                placeholder="Employment Agreement Reference / URL"
                value={formData.employmentAgreement}
                onChange={handleChange}
                className="border p-3 rounded"
              />

              <input
                name="otherDocuments"
                placeholder="Other Document Reference / URL"
                value={formData.otherDocuments}
                onChange={handleChange}
                className="border p-3 rounded"
              />
            </div>
          </section>

          {/* ==================================================

              10. REMARKS

          ================================================== */}

          <section>
            <h3 className="text-lg font-bold text-green-700 border-b pb-2 mb-4">
              10. Remarks / Notes
            </h3>

            <textarea
              name="remarks"
              placeholder="Additional remarks or notes"
              value={formData.remarks}
              onChange={handleChange}
              rows={4}
              className="border p-3 rounded w-full"
            />
          </section>

          {/* ==================================================

              FORM BUTTONS

          ================================================== */}

          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading
                ? "Saving..."
                : editingId
                  ? "Update Worker"
                  : "Add Worker"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 text-white px-8 py-3 rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ======================================================

          WORKERS TABLE

      ====================================================== */}

      <div className="bg-white shadow rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold">Workers List</h2>

            <p className="text-sm text-gray-500">
              {workers.length} worker
              {workers.length === 1 ? "" : "s"} registered.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-3">Staff ID</th>

                <th className="text-left p-3">Name</th>

                <th className="text-left p-3">Role</th>

                <th className="text-left p-3">Department</th>

                <th className="text-left p-3">Farm Area</th>

                <th className="text-left p-3">Phone</th>

                <th className="text-left p-3">Salary</th>

                <th className="text-left p-3">Status</th>

                <th className="text-left p-3">Hire Date</th>

                <th className="text-left p-3">Employment Duration</th>

                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {workers.length === 0 ? (
                <tr>
                  <td colSpan="11" className="text-center p-8 text-gray-500">
                    No workers found.
                  </td>
                </tr>
              ) : (
                workers.map((worker) => (
                  <tr key={worker._id} className="border-b hover:bg-gray-50">
                    <td className="p-3">{worker.employeeId || "—"}</td>

                    <td className="p-3 font-medium">
                      {worker.firstName} {worker.lastName}
                    </td>

                    <td className="p-3">{worker.role || "—"}</td>

                    <td className="p-3">{worker.department || "—"}</td>

                    <td className="p-3">{worker.assignedFarmArea || "—"}</td>

                    <td className="p-3">{worker.phone || "—"}</td>

                    <td className="p-3">
                      ₦{Number(worker.salary || 0).toLocaleString()}
                    </td>

                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          worker.status === "Active"
                            ? "bg-green-100 text-green-700"
                            : worker.status === "On Leave"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {worker.status}
                      </span>
                    </td>

                    <td className="p-3">
                      {formatDate(worker.hireDate || worker.dateHired)}
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      {formatEmploymentDuration(
                        worker.hireDate || worker.dateHired,
                      )}
                    </td>

                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            loadAttendanceSummary(
                              worker,
                              attendanceStartDate,
                              attendanceEndDate,
                            )
                          }
                          className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 whitespace-nowrap"
                        >
                          Attendance
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEdit(worker)}
                          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(worker._id)}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
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
    </div>
  );
}
