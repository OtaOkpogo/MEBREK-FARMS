import { useState, useEffect } from "react";

import {
  fetchProductions,
  createProduction,
  deleteProduction,
} from "../services/productionService";

const Production = () => {
  const [productions, setProductions] = useState([]);

  const [formData, setFormData] = useState({
    date: "",
    days: "",
    openingStock: "",
    mortality: "",
    sickBirds: "",
    feedBagsConsumed: "",
    waterVolume: "",
    drugsUsed: "",
    cratesProduced: "",
    miscarriageProduction: "",
    crackedEggs: "",
    remarks: "",
  });

  const loadProductions = async () => {
    try {
      const response = await fetchProductions();

      setProductions(response.data);
    } catch (error) {
      console.error(error);
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
        waterVolume: Number(formData.waterVolume),
        cratesProduced: Number(formData.cratesProduced),
        miscarriageProduction: Number(formData.miscarriageProduction),
        crackedEggs: Number(formData.crackedEggs),
      });

      loadProductions();

      setFormData({
        date: "",
        days: "",
        openingStock: "",
        mortality: "",
        sickBirds: "",
        feedBagsConsumed: "",
        waterVolume: "",
        drugsUsed: "",
        cratesProduced: "",
        miscarriageProduction: "",
        crackedEggs: "",
        remarks: "",
      });
    } catch (error) {
      console.error(error);
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

  const totalEggs = Number(formData.cratesProduced || 0) * 30;

  const productionPercentage =
    closingStock > 0 ? ((totalEggs / closingStock) * 100).toFixed(2) : 0;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Daily Egg Production</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
        {[
          ["date", "date"],
          ["days", "Age (Days)"],
          ["openingStock", "Opening Stock"],
          ["mortality", "Mortality"],
          ["sickBirds", "Sick Birds"],
          ["feedBagsConsumed", "Feed Bags Consumed"],
          ["waterVolume", "Water Volume"],
          ["drugsUsed", "Drugs Used"],
          ["cratesProduced", "Egg Crates"],
          ["miscarriageProduction", "Miscarriage Eggs"],
          ["crackedEggs", "Cracked Eggs"],
        ].map(([name, label]) => (
          <input
            key={name}
            type={name === "date" ? "date" : "text"}
            name={name}
            placeholder={label}
            value={formData[name]}
            onChange={handleChange}
            className="border p-2 rounded"
          />
        ))}

        <textarea
          name="remarks"
          placeholder="Remarks"
          value={formData.remarks}
          onChange={handleChange}
          className="border p-2 rounded col-span-3"
        />

        <div className="col-span-3 bg-gray-100 p-4 rounded">
          <p>Closing Stock: {closingStock}</p>

          <p>Total Eggs: {totalEggs}</p>

          <p>Production %: {productionPercentage}%</p>
        </div>

        <button
          type="submit"
          className="bg-green-600 text-white p-3 rounded col-span-3"
        >
          Save Production Record
        </button>
      </form>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full border">
          <thead>
            <tr>
              <th>Date</th>
              <th>Days</th>
              <th>Opening</th>
              <th>Mortality</th>
              <th>Closing</th>
              <th>Crates</th>
              <th>%</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {productions.map((item) => (
              <tr key={item._id}>
                <td>{new Date(item.date).toLocaleDateString()}</td>

                <td>{item.days}</td>

                <td>{item.openingStock}</td>

                <td>{item.mortality}</td>

                <td>{item.closingStock}</td>

                <td>{item.cratesProduced}</td>

                <td>{item.productionPercentage}%</td>

                <td>
                  <button onClick={() => handleDelete(item._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Production;
