import { useEffect, useState } from "react";
import { fetchWorkers } from "../../services/workerService";

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkers()
      .then(data => {
        setWorkers(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch workers", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading workers...</p>;

  return (
    <div>
      <h2>Farm Workers</h2>
      <ul>
        {workers.map(worker => (
          <li key={worker._id}>
            {worker.fullName} — {worker.role} — Shift: {worker.shift}
          </li>
        ))}
      </ul>
    </div>
  );
}

