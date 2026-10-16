import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
  fetchAdvancedWorkerAnalytics,
  fetchWorkerAttendanceSummary,
  fetchPerformanceReviews,
  createPerformanceReview,
  deletePerformanceReview,
  fetchEmploymentHistory,
} from "../services/workerService";

const initialFormData = {
  employeeId: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  maritalStatus: "",
  phone: "",
  alternativePhone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  country: "Nigeria",
  idType: "",
  idNumber: "",
  idIssueDate: "",
  idExpiryDate: "",
  role: "",
  department: "",
  employmentType: "Permanent",
  status: "Active",
  hireDate: "",
  assignedFarmArea: "",
  supervisor: "",
  workShift: "",
  startTime: "",
  endTime: "",
  salary: "",
  paymentFrequency: "Monthly",
  nextOfKinName: "",
  nextOfKinRelationship: "",
  nextOfKinPhone: "",
  nextOfKinAlternativePhone: "",
  nextOfKinAddress: "",
  nextOfKinOccupation: "",
  previousEmployer: "",
  previousPosition: "",
  previousDuties: "",
  skillsExperience: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  bvn: "",
  workRestrictions: "",
  allergies: "",
  medicalNotes: "",
  bloodGroup: "",
  ppeIssued: [],
  passportPhoto: "",
  idDocument: "",
  employmentAgreement: "",
  otherDocuments: "",
  remarks: "",
};

const fieldSections = [
  {
    title: "Personal Information",
    fields: [
      ["employeeId", "Staff ID"],
      ["firstName", "First Name", "required"],
      ["lastName", "Last Name", "required"],
      ["dateOfBirth", "Date of Birth", "date"],
      ["gender", "Gender", "select", ["", "Male", "Female", "Other"]],
      [
        "maritalStatus",
        "Marital Status",
        "select",
        ["", "Single", "Married", "Divorced", "Widowed"],
      ],
    ],
  },
  {
    title: "Contact Information",
    fields: [
      ["phone", "Phone Number"],
      ["alternativePhone", "Alternative Phone"],
      ["email", "Email", "email"],
      ["address", "Residential Address"],
      ["city", "City"],
      ["state", "State"],
      ["country", "Country"],
    ],
  },
  {
    title: "Identification Details",
    fields: [
      [
        "idType",
        "ID Type",
        "select",
        [
          "",
          "National ID",
          "NIN",
          "Passport",
          "Driver's License",
          "Voter's Card",
          "Other",
        ],
      ],
      ["idNumber", "ID Number"],
      ["idIssueDate", "ID Issue Date", "date"],
      ["idExpiryDate", "ID Expiry Date", "date"],
    ],
  },
  {
    title: "Employment Details",
    fields: [
      ["role", "Job Role", "required"],
      ["department", "Department"],
      [
        "employmentType",
        "Employment Type",
        "select",
        ["Permanent", "Contract", "Casual", "Part-Time", "Temporary"],
      ],
      [
        "status",
        "Employment Status",
        "select",
        ["Active", "Inactive", "Suspended", "Terminated", "On Leave"],
      ],
      ["hireDate", "Hire Date", "date"],
      ["assignedFarmArea", "Assigned Farm Area"],
      ["supervisor", "Supervisor"],
      [
        "workShift",
        "Work Shift",
        "select",
        ["", "Morning", "Afternoon", "Night", "Day", "Rotating"],
      ],
      ["startTime", "Scheduled Start Time", "time"],
      ["endTime", "Scheduled End Time", "time"],
    ],
  },
  {
    title: "Salary and Payment",
    fields: [
      ["salary", "Salary Amount", "number"],
      [
        "paymentFrequency",
        "Payment Frequency",
        "select",
        ["Monthly", "Weekly", "Daily", "Other"],
      ],
    ],
  },
  {
    title: "Next of Kin / Emergency Contact",
    fields: [
      ["nextOfKinName", "Full Name"],
      ["nextOfKinRelationship", "Relationship"],
      ["nextOfKinPhone", "Phone Number"],
      ["nextOfKinAlternativePhone", "Alternative Phone"],
      ["nextOfKinAddress", "Address"],
      ["nextOfKinOccupation", "Occupation"],
    ],
  },
  {
    title: "Work Experience and Skills",
    fields: [
      ["previousEmployer", "Previous Employer"],
      ["previousPosition", "Previous Position"],
      ["previousDuties", "Previous Duties", "textarea"],
      ["skillsExperience", "Skills and Experience", "textarea"],
    ],
  },
  {
    title: "Bank and Payment Information",
    fields: [
      ["bankName", "Bank Name"],
      ["accountName", "Account Name"],
      ["accountNumber", "Account Number"],
      ["bvn", "BVN"],
    ],
  },
  {
    title: "Health and Safety",
    fields: [
      ["workRestrictions", "Work Restrictions", "textarea"],
      ["allergies", "Allergies", "textarea"],
      ["medicalNotes", "Medical Notes", "textarea"],
      [
        "bloodGroup",
        "Blood Group",
        "select",
        ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      ],
    ],
  },
  {
    title: "Documents",
    fields: [
      ["passportPhoto", "Passport Photo URL / Reference"],
      ["idDocument", "ID Document URL / Reference"],
      ["employmentAgreement", "Employment Agreement URL / Reference"],
      ["otherDocuments", "Other Documents URL / Reference", "textarea"],
    ],
  },
  {
    title: "Administrative Notes",
    fields: [["remarks", "Remarks", "textarea"]],
  },
];

const PPE_OPTIONS = [
  "Safety Boots",
  "Gloves",
  "Overalls",
  "Face Mask",
  "Safety Goggles",
  "Ear Protection",
  "Helmet",
  "Other",
];

const today = () => new Date().toISOString().slice(0, 10);

const unwrap = (response) => {
  let result = response;

  for (let i = 0; i < 3; i += 1) {
    if (result && typeof result === "object" && "data" in result) {
      result = result.data;
    } else {
      break;
    }
  }

  return result;
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallback;

const money = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString();
};

const workerName = (worker) =>
  `${worker?.firstName || ""} ${worker?.lastName || ""}`.trim() ||
  worker?.employeeId ||
  "Unnamed worker";

const statusClass = (status) => {
  if (status === "Active" || status === "Completed") {
    return "bg-green-100 text-green-800";
  }

  if (status === "On Leave" || status === "Late" || status === "Draft") {
    return "bg-yellow-100 text-yellow-800";
  }

  if (
    status === "Terminated" ||
    status === "Absent" ||
    status === "Suspended"
  ) {
    return "bg-red-100 text-red-800";
  }

  return "bg-gray-100 text-gray-700";
};

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [stats, setStats] = useState({});
  const [analytics, setAnalytics] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...initialFormData });
  const [saving, setSaving] = useState(false);
  const [loadingWorkers, setLoadingWorkers] = useState(true);

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [selectedWorker, setSelectedWorker] = useState(null);
  const [activePanel, setActivePanel] = useState("attendance");

  const [attendance, setAttendance] = useState(null);
  const [attendanceStart, setAttendanceStart] = useState("");
  const [attendanceEnd, setAttendanceEnd] = useState("");
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  const [reviews, setReviews] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingPanel, setLoadingPanel] = useState(false);
  const [savingReview, setSavingReview] = useState(false);

  const [reviewForm, setReviewForm] = useState({
    reviewDate: today(),
    reviewPeriod: "",
    overallRating: "3",
    strengths: "",
    areasForImprovement: "",
    goals: "",
    comments: "",
    nextReviewDate: "",
    status: "Completed",
  });

  // ----------------------------------------------------------
  // LOAD WORKERS AND ANALYTICS
  // ----------------------------------------------------------

  const loadWorkers = useCallback(async () => {
    setLoadingWorkers(true);

    try {
      const data = unwrap(await fetchWorkers());
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.workers)
          ? data.workers
          : [];

      setWorkers(list);
    } catch (error) {
      console.error("Failed to load workers:", error);
      window.alert(getErrorMessage(error, "Failed to load workers."));
    } finally {
      setLoadingWorkers(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const { default: apiClient } = await import("../services/apiClient");

      const data = unwrap(await apiClient.get("/workers/stats"));
      setStats(data || {});
    } catch (error) {
      console.error("Failed to load worker statistics:", error);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      const data = unwrap(await fetchAdvancedWorkerAnalytics());
      setAnalytics(data || null);
    } catch (error) {
      console.error("Failed to load workforce analytics:", error);
    }
  }, []);

  useEffect(() => {
    loadWorkers();
    loadStats();
    loadAnalytics();
  }, [loadWorkers, loadStats, loadAnalytics]);

  // ----------------------------------------------------------
  // SEARCH AND FILTERS
  // ----------------------------------------------------------

  const departments = useMemo(
    () => [...new Set(workers.map((w) => w.department).filter(Boolean))].sort(),
    [workers],
  );

  const filteredWorkers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return workers.filter((worker) => {
      const searchable = [
        worker.employeeId,
        worker.firstName,
        worker.lastName,
        worker.role,
        worker.department,
        worker.phone,
        worker.email,
        worker.assignedFarmArea,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!term || searchable.includes(term)) &&
        (!departmentFilter || worker.department === departmentFilter) &&
        (!statusFilter || worker.status === statusFilter) &&
        (!typeFilter || worker.employmentType === typeFilter)
      );
    });
  }, [workers, search, departmentFilter, statusFilter, typeFilter]);

  // ----------------------------------------------------------
  // WORKER FORM
  // ----------------------------------------------------------

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handlePPEChange = (item) => {
    setFormData((previous) => ({
      ...previous,
      ppeIssued: previous.ppeIssued.includes(item)
        ? previous.ppeIssued.filter((value) => value !== item)
        : [...previous.ppeIssued, item],
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ ...initialFormData });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);

      const payload = {
        ...formData,
        salary: formData.salary === "" ? 0 : Number(formData.salary),
      };

      if (!Number.isFinite(payload.salary) || payload.salary < 0) {
        window.alert("Enter a valid non-negative salary.");
        return;
      }

      if (editingId) {
        await updateWorker(editingId, payload);
      } else {
        await createWorker(payload);
      }

      resetForm();
      await Promise.all([loadWorkers(), loadStats(), loadAnalytics()]);

      window.alert(
        editingId
          ? "Worker updated successfully."
          : "Worker created successfully.",
      );
    } catch (error) {
      console.error("Failed to save worker:", error);
      window.alert(getErrorMessage(error, "Failed to save worker."));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (worker) => {
    const values = { ...initialFormData };

    for (const key of Object.keys(values)) {
      if (key === "ppeIssued") {
        values[key] = Array.isArray(worker[key]) ? worker[key] : [];
      } else {
        values[key] = worker[key] ?? values[key];
      }
    }

    values.hireDate =
      worker.hireDate || worker.dateHired
        ? String(worker.hireDate || worker.dateHired).slice(0, 10)
        : "";

    for (const key of ["dateOfBirth", "idIssueDate", "idExpiryDate"]) {
      if (values[key]) values[key] = String(values[key]).slice(0, 10);
    }

    values.salary = worker.salary ?? "";

    setEditingId(worker._id);
    setFormData(values);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (worker) => {
    if (
      !window.confirm(
        `Delete ${workerName(worker)}? This may permanently remove the worker record.`,
      )
    ) {
      return;
    }

    try {
      await deleteWorker(worker._id);

      if (selectedWorker?._id === worker._id) {
        closeWorkerPanel();
      }

      await Promise.all([loadWorkers(), loadStats(), loadAnalytics()]);
    } catch (error) {
      console.error("Failed to delete worker:", error);
      window.alert(getErrorMessage(error, "Failed to delete worker."));
    }
  };

  // ----------------------------------------------------------
  // WORKER DETAIL PANEL
  // ----------------------------------------------------------

  function closeWorkerPanel() {
    setSelectedWorker(null);
    setAttendance(null);
    setReviews([]);
    setHistory([]);
  }

  const loadAttendance = async (worker, startDate = "", endDate = "") => {
    setLoadingAttendance(true);

    try {
      const data = unwrap(
        await fetchWorkerAttendanceSummary(worker._id, {
          startDate,
          endDate,
        }),
      );

      setAttendance(data);
    } catch (error) {
      console.error("Failed to load attendance summary:", error);
      setAttendance(null);
      window.alert(
        getErrorMessage(error, "Failed to load attendance summary."),
      );
    } finally {
      setLoadingAttendance(false);
    }
  };

  const openWorkerPanel = async (worker, panel = "attendance") => {
    setSelectedWorker(worker);
    setActivePanel(panel);
    setAttendance(null);
    setReviews([]);
    setHistory([]);
    setLoadingPanel(true);

    try {
      if (panel === "attendance") {
        await loadAttendance(worker, attendanceStart, attendanceEnd);
      } else if (panel === "reviews") {
        const data = unwrap(await fetchPerformanceReviews(worker._id));
        setReviews(Array.isArray(data) ? data : []);
      } else if (panel === "history") {
        const data = unwrap(await fetchEmploymentHistory(worker._id));
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to load worker details:", error);
      window.alert(getErrorMessage(error, "Failed to load worker details."));
    } finally {
      setLoadingPanel(false);
    }
  };

  const switchPanel = async (panel) => {
    if (!selectedWorker) return;

    setActivePanel(panel);
    setLoadingPanel(true);

    try {
      if (panel === "attendance") {
        await loadAttendance(selectedWorker, attendanceStart, attendanceEnd);
      } else if (panel === "reviews") {
        const data = unwrap(await fetchPerformanceReviews(selectedWorker._id));
        setReviews(Array.isArray(data) ? data : []);
      } else if (panel === "history") {
        const data = unwrap(await fetchEmploymentHistory(selectedWorker._id));
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to load worker details:", error);
      window.alert(getErrorMessage(error, "Failed to load worker details."));
    } finally {
      setLoadingPanel(false);
    }
  };

  // ----------------------------------------------------------
  // PERFORMANCE REVIEWS
  // ----------------------------------------------------------

  const handleReviewChange = (event) => {
    const { name, value } = event.target;

    setReviewForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleCreateReview = async (event) => {
    event.preventDefault();

    if (!selectedWorker) return;

    try {
      setSavingReview(true);

      const payload = {
        ...reviewForm,
        overallRating: Number(reviewForm.overallRating),
        nextReviewDate: reviewForm.nextReviewDate || null,
        categories: [],
      };

      const response = unwrap(
        await createPerformanceReview(selectedWorker._id, payload),
      );

      const newReview = response?.review;

      if (newReview) {
        setReviews((previous) => [newReview, ...previous]);
      } else {
        const data = unwrap(await fetchPerformanceReviews(selectedWorker._id));
        setReviews(Array.isArray(data) ? data : []);
      }

      setReviewForm({
        reviewDate: today(),
        reviewPeriod: "",
        overallRating: "3",
        strengths: "",
        areasForImprovement: "",
        goals: "",
        comments: "",
        nextReviewDate: "",
        status: "Completed",
      });

      window.alert("Performance review saved successfully.");
    } catch (error) {
      console.error("Failed to create performance review:", error);
      window.alert(
        getErrorMessage(error, "Failed to save performance review."),
      );
    } finally {
      setSavingReview(false);
    }
  };

  const handleDeleteReview = async (review) => {
    if (!selectedWorker) return;

    if (!window.confirm("Delete this performance review?")) return;

    try {
      await deletePerformanceReview(selectedWorker._id, review._id);

      setReviews((previous) =>
        previous.filter((item) => item._id !== review._id),
      );
    } catch (error) {
      console.error("Failed to delete review:", error);
      window.alert(getErrorMessage(error, "Failed to delete review."));
    }
  };

  // ----------------------------------------------------------
  // FORMAT EMPLOYMENT DURATION
  // ----------------------------------------------------------

  const formatEmploymentDuration = (hireDate) => {
    if (!hireDate) return "Hire date not set";

    const start = new Date(hireDate);
    const end = new Date();

    if (Number.isNaN(start.getTime()) || start > end) return "—";

    let months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      end.getMonth() -
      start.getMonth();

    if (end.getDate() < start.getDate()) months -= 1;

    const years = Math.floor(Math.max(0, months) / 12);
    const remainingMonths = Math.max(0, months) % 12;

    if (years === 0 && remainingMonths === 0) return "Less than a month";

    return [
      years ? `${years} ${years === 1 ? "year" : "years"}` : "",
      remainingMonths
        ? `${remainingMonths} ${remainingMonths === 1 ? "month" : "months"}`
        : "",
    ]
      .filter(Boolean)
      .join(", ");
  };

  const renderField = ([name, label, type, options]) => {
    const common = {
      id: name,
      name,
      value: formData[name] ?? "",
      onChange: handleChange,
      required: type === "required",
      className:
        "w-full rounded-lg border border-gray-300 bg-white p-3 text-sm focus:border-green-600 focus:outline-none",
    };

    if (type === "textarea") {
      return <textarea {...common} rows={3} key={name} placeholder={label} />;
    }

    if (type === "select") {
      return (
        <select {...common} key={name}>
          {options.map((option) => (
            <option value={option} key={option}>
              {option || `Select ${label.toLowerCase()}`}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        {...common}
        key={name}
        type={
          ["date", "number", "email", "time"].includes(type) ? type : "text"
        }
        min={type === "number" ? 0 : undefined}
        placeholder={label}
      />
    );
  };

  // ----------------------------------------------------------
  // PAGE
  // ----------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Workers Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Worker records, attendance, performance and employment history.
          </p>
        </div>

        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="rounded-lg bg-gray-600 px-5 py-2 text-white hover:bg-gray-700"
          >
            Cancel Edit
          </button>
        )}
      </header>

      {/* WORKFORCE SUMMARY */}
      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Workers</p>
          <p className="mt-2 text-3xl font-bold">
            {stats.totalWorkers ?? workers.length}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {stats.activeWorkers ?? 0} active
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Salary Total</p>
          <p className="mt-2 text-2xl font-bold text-green-700">
            {money(stats.totalSalary)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Includes salaries with different payment frequencies
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Average Salary</p>
          <p className="mt-2 text-2xl font-bold text-blue-700">
            {money(stats.avgSalary ?? stats.averageSalary)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Based on the backend salary statistics
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Workers On Leave</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">
            {stats.workersOnLeave ?? 0}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {stats.suspendedWorkers ?? 0} suspended
          </p>
        </div>
      </section>

      {/* ADVANCED ANALYTICS */}
      {analytics && (
        <section className="mb-8 rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">Workforce Analytics</h2>
            <button
              type="button"
              onClick={loadAnalytics}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Refresh Analytics
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[
              ["Department Breakdown", analytics.departmentBreakdown],
              ["Employment Status", analytics.statusBreakdown],
              ["Employment Type", analytics.employmentTypeBreakdown],
              ["Salary by Payment Frequency", analytics.salaryByFrequency],
              ["Tenure Distribution", analytics.tenureBreakdown],
            ].map(([title, items]) => (
              <div key={title}>
                <h3 className="mb-3 font-semibold text-gray-700">{title}</h3>
                {Array.isArray(items) && items.length > 0 ? (
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div
                        key={`${title}-${item._id ?? item.label ?? index}`}
                        className="flex items-center justify-between gap-3 border-b pb-2 text-sm"
                      >
                        <span className="break-words">
                          {item._id ?? item.label ?? "Other"}
                        </span>
                        <span className="font-semibold">
                          {item.workerCount ??
                            item.count ??
                            item.totalWorkers ??
                            item.totalSalary ??
                            item.value ??
                            "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    No breakdown data available.
                  </p>
                )}
              </div>
            ))}
          </div>

          {Array.isArray(analytics.recentHires) &&
            analytics.recentHires.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 font-semibold">Recent Hires</h3>
                <div className="flex flex-wrap gap-2">
                  {analytics.recentHires.map((worker) => (
                    <span
                      key={worker._id}
                      className="rounded-full bg-green-50 px-3 py-2 text-sm text-green-800"
                    >
                      {workerName(worker)}
                    </span>
                  ))}
                </div>
              </div>
            )}
        </section>
      )}

      {/* WORKER FORM */}
      <section className="mb-8 rounded-xl bg-white p-5 shadow-sm md:p-6">
        <div className="mb-6 border-b pb-4">
          <h2 className="text-xl font-bold">
            {editingId ? "Edit Worker" : "Add Worker"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Complete the relevant details. Existing worker fields are retained.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {fieldSections.map((section, sectionIndex) => (
            <section key={section.title}>
              <h3 className="mb-4 border-b pb-2 text-lg font-semibold text-green-800">
                {sectionIndex + 1}. {section.title}
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {section.fields.map((field) => (
                  <div
                    key={field[0]}
                    className={field[2] === "textarea" ? "md:col-span-2" : ""}
                  >
                    <label
                      htmlFor={field[0]}
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      {field[1]}
                      {field[2] === "required" && (
                        <span className="text-red-600"> *</span>
                      )}
                    </label>
                    {renderField(field)}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section>
            <h3 className="mb-4 border-b pb-2 text-lg font-semibold text-green-800">
              Personal Protective Equipment Issued
            </h3>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {PPE_OPTIONS.map((item) => (
                <label
                  key={item}
                  className="flex items-center gap-2 rounded-lg border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={formData.ppeIssued.includes(item)}
                    onChange={() => handlePPEChange(item)}
                  />
                  {item}
                </label>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-3 border-t pt-5">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-green-700 px-8 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Worker"
                  : "Add Worker"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border px-6 py-3 hover:bg-gray-50"
            >
              {editingId ? "Cancel Edit" : "Reset Form"}
            </button>
          </div>
        </form>
      </section>

      {/* WORKER SEARCH AND TABLE */}
      <section className="rounded-xl bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold">Workers List</h2>
            <p className="mt-1 text-sm text-gray-500">
              Showing {filteredWorkers.length} of {workers.length} workers.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              Promise.all([loadWorkers(), loadStats(), loadAnalytics()])
            }
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, staff ID, role, phone..."
            className="rounded-lg border p-3 text-sm"
          />

          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className="rounded-lg border bg-white p-3 text-sm"
          >
            <option value="">All Departments</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border bg-white p-3 text-sm"
          >
            <option value="">All Statuses</option>
            {["Active", "Inactive", "Suspended", "Terminated", "On Leave"].map(
              (status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ),
            )}
          </select>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-lg border bg-white p-3 text-sm"
          >
            <option value="">All Employment Types</option>
            {["Permanent", "Contract", "Casual", "Part-Time", "Temporary"].map(
              (type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b">
                {[
                  "Staff ID",
                  "Name",
                  "Role",
                  "Department",
                  "Farm Area",
                  "Phone",
                  "Salary",
                  "Status",
                  "Hire Date",
                  "Duration",
                  "Actions",
                ].map((heading) => (
                  <th key={heading} className="whitespace-nowrap p-3">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loadingWorkers ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-500">
                    Loading workers...
                  </td>
                </tr>
              ) : filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-500">
                    No workers match your search and filters.
                  </td>
                </tr>
              ) : (
                filteredWorkers.map((worker) => (
                  <tr key={worker._id} className="border-b hover:bg-gray-50">
                    <td className="p-3">{worker.employeeId || "—"}</td>
                    <td className="p-3 font-semibold">{workerName(worker)}</td>
                    <td className="p-3">{worker.role || "—"}</td>
                    <td className="p-3">{worker.department || "—"}</td>
                    <td className="p-3">{worker.assignedFarmArea || "—"}</td>
                    <td className="p-3">{worker.phone || "—"}</td>
                    <td className="whitespace-nowrap p-3">
                      {money(worker.salary)}
                      <span className="block text-xs text-gray-500">
                        {worker.paymentFrequency || "Monthly"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${statusClass(
                          worker.status,
                        )}`}
                      >
                        {worker.status || "Unspecified"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap p-3">
                      {formatDate(worker.hireDate || worker.dateHired)}
                    </td>
                    <td className="whitespace-nowrap p-3">
                      {formatEmploymentDuration(
                        worker.hireDate || worker.dateHired,
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(worker)}
                          className="rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openWorkerPanel(worker, "attendance")}
                          className="rounded bg-purple-700 px-3 py-1.5 text-white hover:bg-purple-800"
                        >
                          Records
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(worker)}
                          className="rounded bg-red-600 px-3 py-1.5 text-white hover:bg-red-700"
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
      </section>

      {/* WORKER RECORDS PANEL */}
      {selectedWorker && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-3 md:p-8">
          <section className="mx-auto my-4 max-w-6xl rounded-2xl bg-white p-5 shadow-xl md:p-7">
            <div className="flex flex-col justify-between gap-3 border-b pb-5 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-2xl font-bold">
                  {workerName(selectedWorker)}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedWorker.employeeId || "No staff ID"} ·{" "}
                  {selectedWorker.role || "No role"} ·{" "}
                  {selectedWorker.department || "No department"}
                </p>
              </div>

              <button
                type="button"
                onClick={closeWorkerPanel}
                className="rounded-lg border px-4 py-2 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="my-5 flex flex-wrap gap-2">
              {[
                ["attendance", "Attendance & Punctuality"],
                ["reviews", "Performance Reviews"],
                ["history", "Employment History"],
              ].map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => switchPanel(key)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${
                    activePanel === key
                      ? "bg-green-700 text-white"
                      : "border hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {loadingPanel || loadingAttendance ? (
              <p className="p-8 text-center text-gray-500">
                Loading worker records...
              </p>
            ) : (
              <>
                {/* ATTENDANCE */}
                {activePanel === "attendance" && (
                  <div className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                      <label className="text-sm">
                        Start date
                        <input
                          type="date"
                          value={attendanceStart}
                          onChange={(event) =>
                            setAttendanceStart(event.target.value)
                          }
                          className="mt-1 w-full rounded-lg border p-3"
                        />
                      </label>

                      <label className="text-sm">
                        End date
                        <input
                          type="date"
                          value={attendanceEnd}
                          onChange={(event) =>
                            setAttendanceEnd(event.target.value)
                          }
                          className="mt-1 w-full rounded-lg border p-3"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          loadAttendance(
                            selectedWorker,
                            attendanceStart,
                            attendanceEnd,
                          )
                        }
                        className="self-end rounded-lg bg-green-700 px-5 py-3 text-white hover:bg-green-800"
                      >
                        Apply Dates
                      </button>
                    </div>

                    {attendance ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {[
                            ["Attendance Rate", attendance.attendanceRate, "%"],
                            [
                              "Punctuality Rate",
                              attendance.punctualityRate,
                              "%",
                            ],
                            ["Late Arrivals", attendance.lateArrivalCount, ""],
                            ["Working Hours", attendance.totalWorkingHours, ""],
                          ].map(([label, value, suffix]) => (
                            <div key={label} className="rounded-xl border p-4">
                              <p className="text-sm text-gray-500">{label}</p>
                              <p className="mt-2 text-2xl font-bold">
                                {value === null || value === undefined
                                  ? "—"
                                  : `${value}${suffix}`}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {Object.entries(attendance.counts || {}).map(
                            ([key, value]) => (
                              <div
                                key={key}
                                className="rounded-lg bg-gray-50 p-3"
                              >
                                <p className="text-xs capitalize text-gray-500">
                                  {key.replace(/([A-Z])/g, " $1")}
                                </p>
                                <p className="text-xl font-semibold">{value}</p>
                              </div>
                            ),
                          )}
                        </div>

                        <h3 className="font-semibold">Attendance Records</h3>

                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[650px] text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                {[
                                  "Date",
                                  "Status",
                                  "Check In",
                                  "Check Out",
                                  "Hours",
                                  "Remarks",
                                ].map((heading) => (
                                  <th key={heading} className="p-3 text-left">
                                    {heading}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(attendance.records || []).map((record) => (
                                <tr key={record._id} className="border-b">
                                  <td className="p-3">
                                    {formatDate(record.attendanceDate)}
                                  </td>
                                  <td className="p-3">
                                    <span
                                      className={`rounded-full px-2 py-1 text-xs ${statusClass(
                                        record.status,
                                      )}`}
                                    >
                                      {record.status}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    {record.checkInTime || "—"}
                                  </td>
                                  <td className="p-3">
                                    {record.checkOutTime || "—"}
                                  </td>
                                  <td className="p-3">
                                    {record.workingHours ?? "—"}
                                  </td>
                                  <td className="p-3">
                                    {record.remarks || "—"}
                                  </td>
                                </tr>
                              ))}
                              {(attendance.records || []).length === 0 && (
                                <tr>
                                  <td
                                    colSpan={6}
                                    className="p-6 text-center text-gray-500"
                                  >
                                    No linked attendance records were found for
                                    this period.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <p className="rounded-lg bg-gray-50 p-5 text-gray-500">
                        No attendance summary is available.
                      </p>
                    )}
                  </div>
                )}

                {/* PERFORMANCE REVIEWS */}
                {activePanel === "reviews" && (
                  <div className="space-y-6">
                    <form
                      onSubmit={handleCreateReview}
                      className="space-y-4 rounded-xl border p-4"
                    >
                      <h3 className="text-lg font-semibold">
                        Record Performance Review
                      </h3>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <label className="text-sm">
                          Review Date
                          <input
                            required
                            type="date"
                            name="reviewDate"
                            value={reviewForm.reviewDate}
                            onChange={handleReviewChange}
                            className="mt-1 w-full rounded-lg border p-3"
                          />
                        </label>

                        <label className="text-sm">
                          Review Period
                          <input
                            name="reviewPeriod"
                            value={reviewForm.reviewPeriod}
                            onChange={handleReviewChange}
                            placeholder="e.g. Q3 2026"
                            className="mt-1 w-full rounded-lg border p-3"
                          />
                        </label>

                        <label className="text-sm">
                          Overall Rating (1–5)
                          <select
                            name="overallRating"
                            value={reviewForm.overallRating}
                            onChange={handleReviewChange}
                            className="mt-1 w-full rounded-lg border p-3"
                          >
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <option key={rating} value={rating}>
                                {rating} / 5
                              </option>
                            ))}
                          </select>
                        </label>

                        {[
                          ["strengths", "Strengths"],
                          ["areasForImprovement", "Areas for Improvement"],
                          ["goals", "Goals"],
                          ["comments", "Additional Comments"],
                        ].map(([name, label]) => (
                          <label key={name} className="text-sm">
                            {label}
                            <textarea
                              name={name}
                              value={reviewForm[name]}
                              onChange={handleReviewChange}
                              rows={3}
                              className="mt-1 w-full rounded-lg border p-3"
                            />
                          </label>
                        ))}

                        <label className="text-sm">
                          Next Review Date
                          <input
                            type="date"
                            name="nextReviewDate"
                            value={reviewForm.nextReviewDate}
                            onChange={handleReviewChange}
                            className="mt-1 w-full rounded-lg border p-3"
                          />
                        </label>

                        <label className="text-sm">
                          Review Status
                          <select
                            name="status"
                            value={reviewForm.status}
                            onChange={handleReviewChange}
                            className="mt-1 w-full rounded-lg border p-3"
                          >
                            <option value="Completed">Completed</option>
                            <option value="Draft">Draft</option>
                          </select>
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={savingReview}
                        className="rounded-lg bg-green-700 px-5 py-3 text-white hover:bg-green-800 disabled:opacity-50"
                      >
                        {savingReview ? "Saving..." : "Save Review"}
                      </button>
                    </form>

                    <div>
                      <h3 className="mb-3 text-lg font-semibold">
                        Previous Reviews ({reviews.length})
                      </h3>

                      {reviews.length === 0 ? (
                        <p className="rounded-lg bg-gray-50 p-5 text-gray-500">
                          No performance reviews have been recorded.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {reviews.map((review) => (
                            <article
                              key={review._id}
                              className="rounded-xl border p-4"
                            >
                              <div className="flex flex-wrap justify-between gap-3">
                                <div>
                                  <h4 className="font-semibold">
                                    {review.reviewPeriod ||
                                      "Performance Review"}
                                  </h4>
                                  <p className="text-sm text-gray-500">
                                    {formatDate(review.reviewDate)} · Reviewer:{" "}
                                    {review.reviewerName || "Admin"}
                                  </p>
                                </div>

                                <div className="flex items-start gap-3">
                                  <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-800">
                                    {review.overallRating} / 5
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteReview(review)}
                                    className="text-sm text-red-600 hover:underline"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>

                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                {[
                                  ["Strengths", review.strengths],
                                  [
                                    "Areas for Improvement",
                                    review.areasForImprovement,
                                  ],
                                  ["Goals", review.goals],
                                  ["Comments", review.comments],
                                ].map(([label, value]) =>
                                  value ? (
                                    <div key={label}>
                                      <p className="text-xs font-semibold uppercase text-gray-500">
                                        {label}
                                      </p>
                                      <p className="mt-1 whitespace-pre-wrap text-sm">
                                        {value}
                                      </p>
                                    </div>
                                  ) : null,
                                )}
                              </div>

                              {review.nextReviewDate && (
                                <p className="mt-3 text-sm text-gray-500">
                                  Next review:{" "}
                                  {formatDate(review.nextReviewDate)}
                                </p>
                              )}
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* EMPLOYMENT HISTORY */}
                {activePanel === "history" && (
                  <div>
                    <h3 className="mb-4 text-lg font-semibold">
                      Employment History ({history.length})
                    </h3>

                    {history.length === 0 ? (
                      <p className="rounded-lg bg-gray-50 p-5 text-gray-500">
                        No employment-history records were found. New hires and
                        tracked employment changes will appear here.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {history.map((item) => (
                          <article
                            key={item._id}
                            className="border-l-4 border-green-600 bg-gray-50 p-4"
                          >
                            <div className="flex flex-wrap justify-between gap-2">
                              <h4 className="font-semibold">
                                {item.changeType || "Employment Update"}
                              </h4>
                              <span className="text-sm text-gray-500">
                                {formatDate(
                                  item.effectiveDate || item.createdAt,
                                )}
                              </span>
                            </div>

                            {item.notes && (
                              <p className="mt-2 text-sm">{item.notes}</p>
                            )}

                            <p className="mt-2 text-xs text-gray-500">
                              Recorded by: {item.changedByName || "System"}
                            </p>

                            <div className="mt-3 grid gap-4 md:grid-cols-2">
                              <div>
                                <h5 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                                  Previous Values
                                </h5>
                                <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs">
                                  {JSON.stringify(
                                    item.previousValues || {},
                                    null,
                                    2,
                                  )}
                                </pre>
                              </div>

                              <div>
                                <h5 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                                  New Values
                                </h5>
                                <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs">
                                  {JSON.stringify(
                                    item.newValues || {},
                                    null,
                                    2,
                                  )}
                                </pre>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
