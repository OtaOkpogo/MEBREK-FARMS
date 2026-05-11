import { useState } from "react";

export default function Warehouse() {

  const [items, setItems] = useState([]);

  const [formData, setFormData] = useState({
    itemName: "",
    quantity: "",
    category: "",
    location: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    setItems([
      ...items,
      {
        ...formData,
        id: Date.now(),
      },
    ]);

    setFormData({
      itemName: "",
      quantity: "",
      category: "",
      location: "",
    });
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">

      <h1 className="text-4xl font-bold text-green-700 mb-8">
        Warehouse Management 🏬
      </h1>


      {/* FORM */}

      <div className="bg-white p-6 rounded-2xl shadow mb-10">

        <h2 className="text-2xl font-bold mb-6">
          Add Warehouse Item
        </h2>

        <form
          onSubmit={handleSubmit}
          className="grid md:grid-cols-2 gap-4"
        >

          <input
            type="text"
            placeholder="Item Name"
            value={formData.itemName}
            onChange={(e) =>
              setFormData({
                ...formData,
                itemName: e.target.value,
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
            required
          />

          <input
            type="text"
            placeholder="Category"
            value={formData.category}
            onChange={(e) =>
              setFormData({
                ...formData,
                category: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
          />

          <input
            type="text"
            placeholder="Storage Location"
            value={formData.location}
            onChange={(e) =>
              setFormData({
                ...formData,
                location: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
          />

          <button className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg transition">
            Add Item
          </button>

        </form>

      </div>



      {/* TABLE */}

      <div className="bg-white p-6 rounded-2xl shadow">

        <h2 className="text-2xl font-bold mb-6">
          Warehouse Inventory
        </h2>

        {items.length === 0 ? (

          <p>No warehouse items yet</p>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead>

                <tr className="border-b text-left">

                  <th className="py-3">Item</th>
                  <th>Quantity</th>
                  <th>Category</th>
                  <th>Location</th>

                </tr>

              </thead>

              <tbody>

                {items.map((item) => (

                  <tr
                    key={item.id}
                    className="border-b hover:bg-gray-50"
                  >

                    <td className="py-3">
                      {item.itemName}
                    </td>

                    <td>{item.quantity}</td>

                    <td>{item.category}</td>

                    <td>{item.location}</td>

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
