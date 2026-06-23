import { useState, useEffect } from "react";

import {
  fetchProductions,
  createProduction,
  deleteProduction,
} from "../services/productionService";

const pens = [
  "Battery Cage Row 1",
  "Battery Cage Row 2",
  "Battery Cage Row 3",
  "Deep Litter 1",
  "Deep Litter 2",
  "Deep Litter 3",
  "Sick Bay",
  "Pen 150",
];

const Production = () => {
  const [productions, setProductions] = useState([]);
  const [selectedPen, setSelectedPen] = useState("All");

  const [formData, setFormData] = useState({
    pen: "",
    date: "",
    days: "",
    openingStock: "",
    mortality: "",
    sickBirds: "",
    feedBagsConsumed: "",
    waterConsumed: "",
    drugsUsed: "",
    cratesProduced: "",
    extraEggPieces: "",
    miscarriageProduction: "",
    crackedEggs: "",
    remarks: "",
  });

  const loadProductions = async () => {
    try {
      const data = await fetchProductions();
      setProductions(data);
    } catch (error) {
      console.error("LOAD ERROR:", error);
    }
  };

  useEffect(() => {
    loadProductions();
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await createProduction({
        ...formData,

        days: Number(formData.days),
        openingStock: Number(formData.openingStock),
        mortality: Number(formData.mortality),
        sickBirds: Number(formData.sickBirds),
        feedBagsConsumed: Number(formData.feedBagsConsumed),
        waterConsumed: Number(formData.waterConsumed),
        cratesProduced: Number(formData.cratesProduced),
        extraEggPieces: Number(formData.extraEggPieces),
        miscarriageProduction: Number(formData.miscarriageProduction),
        crackedEggs: Number(formData.crackedEggs),
      });

      alert("Production record saved successfully");

      loadProductions();

      setFormData({
        pen: "",
        date: "",
        days: "",
        openingStock: "",
        mortality: "",
        sickBirds: "",
        feedBagsConsumed: "",
        waterConsumed: "",
        drugsUsed: "",
        cratesProduced: "",
        extraEggPieces: "",
        miscarriageProduction: "",
        crackedEggs: "",
        remarks: "",
      });
    } catch (error) {
      console.error(error);

      if (error.response) {
        alert(
          error.response.data.message || "Failed to save production record",
        );
      }
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this record?")) return;

    try {
      await deleteProduction(id);
      loadProductions();
    } catch (error) {
      console.error(error);
    }
  };

  const closingStock =
    Number(formData.openingStock || 0) - Number(formData.mortality || 0);

  const totalEggs =
    Number(formData.cratesProduced || 0) * 30 +
    Number(formData.extraEggPieces || 0);

  const productionPercentage =
    closingStock > 0 ? ((totalEggs / closingStock) * 100).toFixed(2) : 0;

  const filteredProductions =
    selectedPen === "All"
      ? productions
      : productions.filter((item) => item.pen === selectedPen);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Daily Egg Production</h1>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <select
          name="pen"
          value={formData.pen}
          onChange={handleChange}
          className="border p-2 rounded"
          required
        >
          <option value="">Select Production Unit</option>

          {pens.map((pen) => (
            <option key={pen} value={pen}>
              {pen}
            </option>
          ))}
        </select>

        <input
          type="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          className="border p-2 rounded"
          required
        />

        <input
          type="number"
          name="days"
          placeholder="Age (Days)"
          value={formData.days}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="number"
          name="openingStock"
          placeholder="Opening Stock"
          value={formData.openingStock}
          onChange={handleChange}
          className="border p-2 rounded"
          required
        />

        <input
          type="number"
          name="mortality"
          placeholder="Mortality"
          value={formData.mortality}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="number"
          name="sickBirds"
          placeholder="Sick Birds"
          value={formData.sickBirds}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="number"
          name="feedBagsConsumed"
          placeholder="Feed Bags Consumed"
          value={formData.feedBagsConsumed}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="number"
          name="waterConsumed"
          placeholder="Water Consumed"
          value={formData.waterConsumed}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="text"
          name="drugsUsed"
          placeholder="Drugs Used"
          value={formData.drugsUsed}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="number"
          name="cratesProduced"
          placeholder="Egg Crates"
          value={formData.cratesProduced}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="number"
          name="extraEggPieces"
          placeholder="Extra Egg Pieces"
          value={formData.extraEggPieces}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="number"
          name="miscarriageProduction"
          placeholder="Miscarriage Eggs"
          value={formData.miscarriageProduction}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="number"
          name="crackedEggs"
          placeholder="Cracked Eggs"
          value={formData.crackedEggs}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <textarea
          name="remarks"
          placeholder="Remarks"
          value={formData.remarks}
          onChange={handleChange}
          rows="3"
          className="border p-2 rounded md:col-span-3"
        />

        <div className="bg-gray-100 p-4 rounded md:col-span-3">
          <p>
            <strong>Closing Stock:</strong> {closingStock}
          </p>

          <p>
            <strong>Total Eggs:</strong> {totalEggs}
          </p>

          <p>
            <strong>Production %:</strong> {productionPercentage}%
          </p>
        </div>

        <button
          type="submit"
          className="bg-green-600 text-white p-3 rounded md:col-span-3"
        >
          Save Production Record
        </button>
      </form>

      <div className="mt-8">
        <select
          value={selectedPen}
          onChange={(e) => setSelectedPen(e.target.value)}
          className="border p-2 rounded mb-4"
        >
          <option value="All">All Pens</option>

          {pens.map((pen) => (
            <option key={pen} value={pen}>
              {pen}
            </option>
          ))}
        </select>

        <div className="overflow-x-auto">
          <table className="w-full border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Pen</th>
                <th className="border p-2">Date</th>
                <th className="border p-2">Opening</th>
                <th className="border p-2">Mortality</th>
                <th className="border p-2">Closing</th>
                <th className="border p-2">Crates</th>
                <th className="border p-2">Extra Eggs</th>
                <th className="border p-2">Total Eggs</th>
                <th className="border p-2">%</th>
                <th className="border p-2">Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredProductions.length > 0 ? (
                filteredProductions.map((item) => (
                  <tr key={item._id}>
                    <td className="border p-2">{item.pen}</td>

                    <td className="border p-2">
                      {new Date(item.date).toLocaleDateString()}
                    </td>

                    <td className="border p-2">{item.openingStock}</td>

                    <td className="border p-2">{item.mortality}</td>

                    <td className="border p-2">{item.closingStock}</td>

                    <td className="border p-2">{item.cratesProduced}</td>

                    <td className="border p-2">{item.extraEggPieces}</td>

                    <td className="border p-2">{item.totalEggs}</td>

                    <td className="border p-2">{item.productionPercentage}%</td>

                    <td className="border p-2">
                      <button
                        onClick={() => handleDelete(item._id)}
                        className="bg-red-600 text-white px-3 py-1 rounded"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="text-center p-4">
                    No production records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Production;
