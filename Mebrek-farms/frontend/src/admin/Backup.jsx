import { useCallback, useEffect, useState } from "react";
import { exportDatabase } from "../services/backupService";
import { getCurrentUser } from "../services/authService";

const getUserFromResponse = (response) => {
  return (
    response?.admin ||
    response?.user ||
    response?.data?.admin ||
    response?.data?.user ||
    response?.data ||
    response
  );
};

export default function Backup() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [userError, setUserError] = useState("");

  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastExportedAt, setLastExportedAt] = useState(null);

  // ============================================================
  // LOAD CURRENT USER
  // ============================================================

  const loadUser = useCallback(async () => {
    try {
      setLoadingUser(true);
      setUserError("");

      const response = await getCurrentUser();
      const currentUser = getUserFromResponse(response);

      if (!currentUser || !currentUser.role) {
        throw new Error("Unable to verify your account permissions.");
      }

      setUser(currentUser);
    } catch (err) {
      console.error("LOAD BACKUP USER ERROR:", err);

      setUser(null);
      setUserError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to verify your account. Please try again.",
      );
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // ============================================================
  // EXPORT DATABASE
  // ============================================================

  const handleExport = async () => {
    if (user?.role !== "superadmin") {
      setError("You are not authorised to export the database.");
      return;
    }

    const confirmed = window.confirm(
      "You are about to export a full database backup containing sensitive farm and customer information. Make sure you store the downloaded file securely. Continue?",
    );

    if (!confirmed) return;

    try {
      setExporting(true);
      setError("");
      setSuccess("");

      await exportDatabase();

      const exportTime = new Date();

      setLastExportedAt(exportTime);
      setSuccess(
        "Database export completed. Check your downloads for the backup file.",
      );
    } catch (err) {
      console.error("DATABASE EXPORT ERROR:", err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to export database. Please try again.",
      );
    } finally {
      setExporting(false);
    }
  };

  // ============================================================
  // ACCESS CHECK
  // ============================================================

  const isSuperadmin = user?.role === "superadmin";

  // ============================================================
  // LOADING SCREEN
  // ============================================================

  if (loadingUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7f3] p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-green-100 border-t-green-700" />

          <p className="font-medium text-gray-700">
            Verifying account permissions...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // USER VERIFICATION ERROR
  // ============================================================

  if (userError) {
    return (
      <div className="min-h-screen bg-[#f5f7f3] p-6">
        <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <div className="mb-4 text-4xl">⚠️</div>

          <h1 className="mb-2 text-xl font-bold text-gray-800">
            Account Verification Failed
          </h1>

          <p className="mb-6 text-sm text-gray-500">{userError}</p>

          <button
            type="button"
            onClick={loadUser}
            className="rounded-lg bg-green-700 px-6 py-3 font-semibold text-white transition hover:bg-green-800"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // ACCESS DENIED
  // ============================================================

  if (!isSuperadmin) {
    return (
      <div className="min-h-screen bg-[#f5f7f3] p-6">
        <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <div className="mb-4 text-5xl">🔒</div>

          <h1 className="mb-2 text-2xl font-bold text-red-600">
            Access Denied
          </h1>

          <p className="text-sm leading-6 text-gray-600">
            Database backup is only available to superadmin accounts. Your
            current account does not have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN PAGE
  // ============================================================

  return (
    <div className="min-h-screen bg-[#f5f7f3] p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        {/* PAGE HEADER */}

        <div className="mb-8">
          <p className="mb-1 text-sm font-semibold tracking-wide text-green-700">
            MEBREK FARMS MANAGEMENT
          </p>

          <h1 className="text-2xl font-bold text-gray-800 md:text-3xl">
            Database Backup
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            Securely export your farm management records and keep an independent
            copy of your database.
          </p>
        </div>

        {/* BACKUP STATUS */}

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-green-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Account Access</p>

            <p className="mt-2 font-bold text-green-700">Super Admin</p>

            <p className="mt-1 text-xs text-gray-400">
              Authorised to export database backups
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Last Export</p>

            <p className="mt-2 font-bold text-gray-800">
              {lastExportedAt
                ? lastExportedAt.toLocaleString()
                : "No export during this session"}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Time of the last successful export
            </p>
          </div>
        </div>

        {/* ERROR MESSAGE */}

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* SUCCESS MESSAGE */}

        {success && (
          <div
            role="status"
            className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            {success}
          </div>
        )}

        {/* EXPORT CARD */}

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-6 md:p-8">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-green-50 text-3xl">
              🗄️
            </div>

            <h2 className="text-xl font-bold text-gray-800">Export Database</h2>

            <p className="mt-2 max-w-2xl text-sm leading-7 text-gray-500">
              Generate a downloadable JSON snapshot of your farm management
              records. This provides a separate copy that can be stored securely
              for recovery purposes.
            </p>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="rounded-lg bg-green-700 px-6 py-3 font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting
                  ? "Preparing Database Export..."
                  : "⬇ Export Database"}
              </button>
            </div>
          </div>

          {/* INCLUDED RECORDS */}

          <div className="bg-[#fafbf9] p-6 md:p-8">
            <h3 className="mb-4 font-semibold text-gray-800">
              Records Included in the Backup
            </h3>

            <div className="grid grid-cols-1 gap-3 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-3">
              {[
                "Orders",
                "Workers",
                "Production",
                "Feed Inventory",
                "Attendance",
                "Room Inventory",
                "Mortality",
                "Vaccinations",
                "Egg Sales",
                "Medications",
                "Bird Health",
                "Admin Accounts (passwords excluded)",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="font-bold text-green-700">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SECURITY NOTICE */}

          <div className="border-t border-amber-100 bg-amber-50 p-5 md:p-6">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>

              <div>
                <h3 className="font-semibold text-amber-900">
                  Important Security Notice
                </h3>

                <p className="mt-1 text-sm leading-6 text-amber-800">
                  Backup files may contain confidential farm operations,
                  financial records and customer information. Store exported
                  files in a secure location and do not share them with
                  unauthorised persons.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}

        <p className="mt-5 text-center text-xs text-gray-400">
          MEBREK FARMS · Database Management
        </p>
      </div>
    </div>
  );
}
