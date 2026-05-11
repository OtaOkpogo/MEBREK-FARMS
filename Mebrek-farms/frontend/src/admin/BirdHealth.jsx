import { useEffect, useState } from "react";

import axios from "axios";

export default function BirdHealth() {

  const [health, setHealth] = useState({
    healthyBirds: 0,
    sickBirds: 0,
    vaccinatedBirds: 0,
    mortalityRate: 0,
  });

  useEffect(() => {
    loadHealthData();
  }, []);

  const loadHealthData = async () => {
    try {

      const token =
        localStorage.getItem("token");

      const res = await axios.get(
        "http://localhost:5000/api/dashboard",
        {
          headers: {
            Authorization: token,
          },
        }
      );

      const data = res.data;

      const totalMortality =
        data.mortality?.reduce(
          (sum, item) =>
            sum + item.numberDead,
          0
        ) || 0;

      const vaccinated =
        data.vaccinations?.length || 0;

      const workers =
        data.workers?.length || 0;

      setHealth({
        healthyBirds:
          5000 - totalMortality,

        sickBirds:
          totalMortality,

        vaccinatedBirds:
          vaccinated,

        mortalityRate:
          (
            (totalMortality / 5000) *
            100
          ).toFixed(2),
      });

    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">

      <h1 className="text-4xl font-bold text-green-700 mb-8">
        Bird Health Dashboard 🐓
      </h1>

      <div className="grid md:grid-cols-4 gap-6">

        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-gray-500">
            Healthy Birds
          </h2>

          <p className="text-4xl font-bold text-green-600 mt-2">
            {health.healthyBirds}
          </p>
        </div>


        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-gray-500">
            Sick/Dead Birds
          </h2>

          <p className="text-4xl font-bold text-red-600 mt-2">
            {health.sickBirds}
          </p>
        </div>


        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-gray-500">
            Vaccinated Birds
          </h2>

          <p className="text-4xl font-bold text-blue-600 mt-2">
            {health.vaccinatedBirds}
          </p>
        </div>


        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-gray-500">
            Mortality Rate
          </h2>

          <p className="text-4xl font-bold text-orange-500 mt-2">
            {health.mortalityRate}%
          </p>
        </div>

      </div>

    </div>
  );
}
