import { useState } from "react";

export default function Medications() {

  const [medications, setMedications] =
    useState([]);

  const [formData, setFormData] =
    useState({
      medicationName: "",
      dosage: "",
      purpose: "",
      administeredTo: "",
    });

  const handleSubmit = (e) => {
    e.preventDefault();

    setMedications([
      ...medications,
      {
        ...formData,
        id: Date.now(),
      },
    ]);

    setFormData({
      medicationName: "",
      dosage: "",
      purpose: "",
      administeredTo: "",
    });
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">

      <h1 className="text-4xl font-bold text-blue-700 mb-8">
        Bird Medications 💊
      </h1>

      {/* FORM */}

      <div className="bg-white p-6 rounded-2xl shadow mb-10">

        <h2 className="text-2xl font-bold mb-6">
          Add Medication
        </h2>

        <form
          onSubmit={handleSubmit}
          className="grid md:grid-cols-2 gap-4"
        >

          <input
            type="text"
            placeholder="Medication Name"
            value={formData.medicationName}
            onChange={(e) =>
              setFormData({
                ...formData,
                medicationName:
                  e.target.value,
              })
            }
            className="border p-3 rounded-lg"
            required
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
            type="text"
            placeholder="Purpose"
            value={formData.purpose}
            onChange={(e) =>
              setFormData({
                ...formData,
                purpose: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
          />

          <input
            type="text"
            placeholder="Administered To"
            value={formData.administeredTo}
            onChange={(e) =>
              setFormData({
                ...formData,
                administeredTo:
                  e.target.value,
              })
            }
            className="border p-3 rounded-lg"
          />

          <button className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 transition">
            Save Medication
          </button>

        </form>

      </div>



      {/* TABLE */}

      <div className="bg-white p-6 rounded-2xl shadow">

        <h2 className="text-2xl font-bold mb-6">
          Medication Records
        </h2>

        {medications.length === 0 ? (

          <p>No medication records yet</p>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead>

                <tr className="border-b text-left">

                  <th className="py-3">
                    Medication
                  </th>

                  <th>Dosage</th>

                  <th>Purpose</th>

                  <th>Administered To</th>

                </tr>

              </thead>

              <tbody>

                {medications.map((med) => (

                  <tr
                    key={med.id}
                    className="border-b hover:bg-gray-50"
                  >

                    <td className="py-3">
                      {med.medicationName}
                    </td>

                    <td>{med.dosage}</td>

                    <td>{med.purpose}</td>

                    <td>
                      {med.administeredTo}
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </div>

    </div>
  );
}
