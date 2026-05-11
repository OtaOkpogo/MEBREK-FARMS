import { useEffect, useState } from "react";

import {
  fetchMortality,
  createMortality,
  deleteMortality,
} from "../services/mortalityService";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

export default function Mortality() {

  // ================= STATE =================

  const [records, setRecords] = useState([]);

  const [formData, setFormData] = useState({
    birdBatch: "",
    numberDead: "",
    cause: "",
    estimatedLoss: "",
    notes: "",
  });


  // ================= LOAD DATA =================

  useEffect(() => {
    loadMortality();
  }, []);


  const loadMortality = async () => {
    try {

      const data = await fetchMortality();

      setRecords(data);

    } catch (err) {
      console.error(err);
    }
  };


  // ================= CREATE =================

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {

      await createMortality(formData);

      setFormData({
        birdBatch: "",
        numberDead: "",
        cause: "",
        estimatedLoss: "",
        notes: "",
      });

      loadMortality();

    } catch (err) {
      console.error(err);
    }
  };


  // ================= DELETE =================

  const handleDelete = async (id) => {
    try {

      await deleteMortality(id);

      loadMortality();

    } catch (err) {
      console.error(err);
    }
  };


  // ================= ANALYTICS =================

  const totalDeaths = records.reduce(
    (sum, item) =>
      sum + (item.numberDead || 0),
    0
  );

  const totalLoss = records.reduce(
    (sum, item) =>
      sum + (item.estimatedLoss || 0),
    0
  );


  // ================= CHART DATA =================

  const causeDataMap = {};

  records.forEach((item) => {

    if (!causeDataMap[item.cause]) {
      causeDataMap[item.cause] = 0;
    }

    causeDataMap[item.cause] += item.numberDead;
  });


  const causeChartData =
    Object.keys(causeDataMap).map(
      (key) => ({
        name: key,
        value: causeDataMap[key],
      })
    );


  const COLORS = [
    "#dc2626",
    "#f97316",
    "#eab308",
    "#16a34a",
    "#2563eb",
    "#7c3aed",
  ];


  return (
    <div className="p-6 bg-gray-100 min-h-screen">

      {/* ================= HEADER ================= */}

      <div className="mb-8">

        <h1 className="text-4xl font-bold text-red-700">
          Mortality Tracking ☠️
        </h1>

        <p className="text-gray-600 mt-2">
          Monitor bird deaths and disease outbreaks
        </p>

      </div>



      {/* ================= STATS ================= */}

      <div className="grid md:grid-cols-2 gap-6 mb-10">

        <div className="bg-white rounded-2xl shadow p-6">

          <h2 className="text-gray-500">
            Total Bird Deaths
          </h2>

          <p className="text-4xl font-bold text-red-600 mt-2">
            {totalDeaths}
          </p>

        </div>


        <div className="bg-white rounded-2xl shadow p-6">

          <h2 className="text-gray-500">
            Estimated Financial Loss
          </h2>

          <p className="text-4xl font-bold text-orange-500 mt-2">
            ₦{totalLoss.toLocaleString()}
          </p>

        </div>

      </div>



      {/* ================= FORM ================= */}

      <div className="bg-white rounded-2xl shadow p-6 mb-10">

        <h2 className="text-2xl font-bold mb-6">
          Add Mortality Record
        </h2>

        <form
          onSubmit={handleSubmit}
          className="grid md:grid-cols-2 gap-4"
        >

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
            placeholder="Number Dead"
            value={formData.numberDead}
            onChange={(e) =>
              setFormData({
                ...formData,
                numberDead: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
            required
          />


          <input
            type="text"
            placeholder="Cause of Death"
            value={formData.cause}
            onChange={(e) =>
              setFormData({
                ...formData,
                cause: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
            required
          />


          <input
            type="number"
            placeholder="Estimated Financial Loss"
            value={formData.estimatedLoss}
            onChange={(e) =>
              setFormData({
                ...formData,
                estimatedLoss: e.target.value,
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


          <button className="bg-red-600 hover:bg-red-700 text-white rounded-lg py-3 transition">
            Save Record
          </button>

        </form>

      </div>



      {/* ================= CHARTS ================= */}

      <div className="grid md:grid-cols-2 gap-6 mb-10">

        {/* PIE CHART */}

        <div className="bg-white rounded-2xl shadow p-6">

          <h2 className="text-2xl font-bold mb-4">
            Mortality Causes 📊
          </h2>

          <ResponsiveContainer
            width="100%"
            height={300}
          >

            <PieChart>

              <Pie
                data={causeChartData}
                dataKey="value"
                outerRadius={100}
                label
              >

                {causeChartData.map(
                  (entry, index) => (

                    <Cell
                      key={index}
                      fill={
                        COLORS[
                          index % COLORS.length
                        ]
                      }
                    />

                  )
                )}

              </Pie>

              <Tooltip />

              <Legend />

            </PieChart>

          </ResponsiveContainer>

        </div>



        {/* BAR CHART */}

        <div className="bg-white rounded-2xl shadow p-6">

          <h2 className="text-2xl font-bold mb-4">
            Deaths by Cause 📉
          </h2>

          <ResponsiveContainer
            width="100%"
            height={300}
          >

            <BarChart data={causeChartData}>

              <XAxis dataKey="name" />

              <YAxis />

              <Tooltip />

              <Bar
                dataKey="value"
                fill="#dc2626"
                radius={[8, 8, 0, 0]}
              />

            </BarChart>

          </ResponsiveContainer>

        </div>

      </div>



      {/* ================= TABLE ================= */}

      <div className="bg-white rounded-2xl shadow p-6">

        <h2 className="text-2xl font-bold mb-6">
          Mortality Records
        </h2>

        {records.length === 0 ? (

          <p>No mortality records found</p>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead>

                <tr className="border-b text-left">

                  <th className="py-3">
                    Batch
                  </th>

                  <th>Deaths</th>

                  <th>Cause</th>

                  <th>Loss</th>

                  <th>Date</th>

                  <th>Action</th>

                </tr>

              </thead>


              <tbody>

                {records.map((record) => (

                  <tr
                    key={record._id}
                    className="border-b hover:bg-gray-50"
                  >

                    <td className="py-3">
                      {record.birdBatch}
                    </td>

                    <td>
                      {record.numberDead}
                    </td>

                    <td>
                      {record.cause}
                    </td>

                    <td className="text-red-600 font-bold">
                      ₦
                      {record.estimatedLoss?.toLocaleString()}
                    </td>

                    <td>
                      {new Date(
                        record.createdAt
                      ).toLocaleDateString()}
                    </td>

                    <td>

                      <button
                        onClick={() =>
                          handleDelete(
                            record._id
                          )
                        }
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg transition"
                      >
                        Delete
                      </button>

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
