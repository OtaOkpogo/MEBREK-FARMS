import { useEffect, useState } from "react";
import {
  fetchExpenses,
  createExpense,
  deleteExpense,
  fetchExpenseStats,
} from "../services/expenseService";

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState({});

  const [formData, setFormData] = useState({
    date: "",
    category: "Feed",
    description: "",
    quantity: "",
    unitCost: "",
    supplier: "",
    paymentMethod: "Cash",
    remarks: "",
  });

  const loadData = async () => {
    try {
      const exp = await fetchExpenses();
      const st = await fetchExpenseStats();

      setExpenses(exp);
      setStats(st);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    await createExpense({
      ...formData,
      quantity: Number(formData.quantity),
      unitCost: Number(formData.unitCost),
    });

    setFormData({
      date: "",
      category: "Feed",
      description: "",
      quantity: "",
      unitCost: "",
      supplier: "",
      paymentMethod: "Cash",
      remarks: "",
    });

    loadData();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Expense Management</h1>

      {/* STATS */}
      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2>Total Expenses: ₦{stats.totalExpenses || 0}</h2>
      </div>

      {/* FORM */}
      <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-3">
        <input type="date" name="date" value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          className="border p-2"
        />

        <select
          value={formData.category}
          onChange={(e) =>
            setFormData({ ...formData, category: e.target.value })
          }
          className="border p-2"
        >
          <option>Feed</option>
          <option>Drugs</option>
          <option>Labour</option>
          <option>Fuel</option>
          <option>Repairs</option>
          <option>Utilities</option>
          <option>Transport</option>
          <option>Other</option>
        </select>

        <input
          placeholder="Description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          className="border p-2"
        />

        <input
          placeholder="Quantity"
          value={formData.quantity}
          onChange={(e) =>
            setFormData({ ...formData, quantity: e.target.value })
          }
          className="border p-2"
        />

        <input
          placeholder="Unit Cost"
          value={formData.unitCost}
          onChange={(e) =>
            setFormData({ ...formData, unitCost: e.target.value })
          }
          className="border p-2"
        />

        <input
          placeholder="Supplier"
          value={formData.supplier}
          onChange={(e) =>
            setFormData({ ...formData, supplier: e.target.value })
          }
          className="border p-2"
        />

        <button className="bg-green-600 text-white p-2 rounded">
          Save Expense
        </button>
      </form>

      {/* TABLE */}
      <table className="w-full mt-6 border">
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Description</th>
            <th>Amount</th>
          </tr>
        </thead>

        <tbody>
          {expenses.map((e) => (
            <tr key={e._id}>
              <td>{new Date(e.date).toLocaleDateString()}</td>
              <td>{e.category}</td>
              <td>{e.description}</td>
              <td>₦{e.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
