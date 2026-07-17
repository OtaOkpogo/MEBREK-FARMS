import { useEffect, useState } from "react";
import { exportDatabase } from "../services/backupService";
import { getCurrentUser } from "../services/authService";

export default function Backup() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [lastExportedAt, setLastExportedAt] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const data = await getCurrentUser();
      setUser(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUser(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setError("");
      await exportDatabase();
      setLastExportedAt(new Date());
    } catch (err) {
      console.error(err);
      setError("Failed to export database. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const isSuperadmin = user?.role === "superadmin";

  if (loadingUser) {
    return <div className="p-8">Loading...</div>;
  }

  // Even if this page is hidden from the sidebar for non-superadmin,
  // enforce the check here too — anyone can type the URL directly.
  if (!isSuperadmin) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="bg-white p-8 rounded-2xl shadow max-w-lg mx-auto mt-20 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600">
            Database backup is only available to superadmin accounts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-4xl font-bold text-green-700 mb-2">Backup 🗄️</h1>
      <p className="text-gray-600 mb-8">
        Export a full snapshot of all farm records as a downloadable JSON
        file.
      </p>

      {error && (
        <div className="bg-red-100 text-red-700 px-4 py-3 rounded-lg mb-6 max-w-xl">
          {error}
        </div>
      )}

      <div className="bg-white p-8 rounded-2xl shadow max-w-xl">
        <h2 className="text-xl font-bold mb-2">Export Database</h2>
        <p className="text-gray-500 mb-6">
          This downloads every record from Orders, Workers, Production,
          Feed, Attendance, Room Inventory, Mortality, Vaccinations, Egg
          Sales, Medications, Bird Health, and Admin accounts (passwords
          excluded) as a single JSON file. Keep this file somewhere safe —
          it contains sensitive farm and customer data.
        </p>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg py-3 px-6 font-semibold transition"
        >
          {exporting ? "Preparing export..." : "Export Database"}
        </button>

        {lastExportedAt && (
          <p className="text-sm text-gray-500 mt-4">
            Last export triggered at {lastExportedAt.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
