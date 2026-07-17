import { useEffect, useState } from "react";

import {
  fetchVaccinations,
  createVaccination,
  deleteVaccination,
  restoreVaccination,
} from "../services/vaccinationService";
import { getCurrentUser } from "../services/authService";

export default function Vaccinations() {
  const [records, setRecords] = useState([]);
  const [user, setUser] = useState(null);

  const [formData, setFormData] = useState({
    vaccineName: "",
    birdBatch: "",
    quantity: "",
    administeredBy: "",
    dosage: "",
    nextDueDate: "",
    notes: "",
  });

  useEffect(() => {
    loadUser();
    loadVaccinations();
  }, []);

  const loadUser = async () => {
    try {
      const data = await getCurrentUser();
      setUser(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadVaccinations = async () => {
    try {
      // Backend returns deleted records inline for superadmin,
      // and only active records for everyone else.
      const data = await fetchVaccinations();

      setRecords(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await createVaccination(formData);

      setFormData({
        vaccineName: "",
        birdBatch: "",
        quantity: "",
        administeredBy: "",
        dosage: "",
        nextDueDate: "",
        notes: "",
      });

      loadVaccinations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteVaccination(id);

      // Superadmin keeps seeing the record (now marked deleted), so
      // refetch instead of removing it from state.
      loadVaccinations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestore = async (id) => {
    try {
      await restoreVaccination(id);
      loadVaccinations();
    } catch (err) {
      console.error(err);
    }
  };

  const isSuperadmin = user?.role === "superadmin";

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-green-700">
          Vaccination Records 💉
        </h1>

        <p className="text-gray-600 mt-2">
          Manage poultry vaccinations and schedules
        </p>
      </div>

      {/* FORM */}

      <div className="bg-white p-6 rounded-2xl shadow mb-10">
        <h2 className="text-2xl font-bold mb-6">Add Vaccination Record</h2>

        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Vaccine Name"
            value={formData.vaccineName}
            onChange={(e) =>
              setFormData({
                ...formData,
                vaccineName: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
            required
          />

          <input
            type="text"
            placeholder="Bird Batch"
            value={formData.birdBatch}
            onChange={(e) =>
              setFormData({
                ...formData,
                birdBatch: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
            required
          />

          <input
            type="number"
            placeholder="Quantity"
            value={formData.quantity}
            onChange={(e) =>
              setFormData({
                ...formData,
                quantity: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
          />

          <input
            type="text"
            placeholder="Administered By"
            value={formData.administeredBy}
            onChange={(e) =>
              setFormData({
                ...formData,
                administeredBy: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
          />

          <input
            type="text"
            placeholder="Dosage"
            value={formData.dosage}
            onChange={(e) =>
              setFormData({
                ...formData,
                dosage: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
          />

          <input
            type="date"
            value={formData.nextDueDate}
            onChange={(e) =>
              setFormData({
                ...formData,
                nextDueDate: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
          />

          <textarea
            placeholder="Notes"
            value={formData.notes}
            onChange={(e) =>
              setFormData({
                ...formData,
                notes: e.target.value,
              })
            }
            className="border p-3 rounded-lg md:col-span-2"
            rows={4}
          />

          <button className="bg-green-600 hover:bg-green-700 text-white rounded-lg py-3 transition">
            Save Vaccination
          </button>
        </form>
      </div>

      {/* TABLE */}

      <div className="bg-white p-6 rounded-2xl shadow">
        <h2 className="text-2xl font-bold mb-6">Vaccination History</h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left">
                <th className="py-3">Vaccine</th>
                <th>Batch</th>
                <th>Qty</th>
                <th>Dosage</th>
                <th>Next Due</th>
                {isSuperadmin && <th>Status</th>}
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {records.map((record) => (
                <tr
                  key={record._id}
                  className={`border-b hover:bg-gray-50 ${
                    record.isDeleted ? "bg-red-50" : ""
                  }`}
                >
                  <td className="py-3">{record.vaccineName}</td>

                  <td>{record.birdBatch}</td>

                  <td>{record.quantity}</td>

                  <td>{record.dosage}</td>

                  <td>
                    {record.nextDueDate
                      ? new Date(record.nextDueDate).toLocaleDateString()
                      : "N/A"}
                  </td>

                  {/* Only superadmin's payload ever includes deleted
                      records, so this column only makes sense for them */}
                  {isSuperadmin && (
                    <td>
                      {record.isDeleted ? (
                        <div className="text-xs">
                          <span className="inline-block bg-red-100 text-red-700 font-semibold px-2 py-1 rounded-full mb-1">
                            Deleted
                          </span>
                          <div className="text-gray-500 capitalize">
                            by {record.deletedBy?.role || "Unknown"}
                            {record.deletedAt &&
                              ` on ${new Date(
                                record.deletedAt,
                              ).toLocaleDateString()}`}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-block bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full text-xs">
                          Active
                        </span>
                      )}
                    </td>
                  )}

                  <td>
                    {record.isDeleted ? (
                      isSuperadmin && (
                        <button
                          onClick={() => handleRestore(record._id)}
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg"
                        >
                          Restore
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleDelete(record._id)}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
