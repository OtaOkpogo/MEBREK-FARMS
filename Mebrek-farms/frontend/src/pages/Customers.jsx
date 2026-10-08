import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../services/customerService";

// ============================================================
// CONSTANTS
// ============================================================

const CUSTOMER_TYPES = [
  "Individual",
  "Supermarket",
  "Restaurant",
  "Hotel",
  "Wholesaler",
  "Retailer",
  "Distributor",
  "Other",
];

const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  address: "",
  customerType: "Individual",
  notes: "",
  isActive: true,
};

// ============================================================
// CUSTOMERS PAGE
// ============================================================

export default function Customers() {
  const [customers, setCustomers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const [formData, setFormData] = useState({
    ...EMPTY_FORM,
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);

  // ==========================================================
  // LOAD CUSTOMERS
  // ==========================================================

  const loadCustomers = async () => {
    try {
      setLoading(true);

      const response = await fetchCustomers();

      console.log("CUSTOMERS API RESPONSE:", response);

      /*
       * Support the common response formats:
       *
       * 1. [customers]
       *
       * 2. { customers: [...] }
       *
       * 3. { data: [...] }
       *
       * 4. { data: { customers: [...] } }
       */

      let customerList = [];

      if (Array.isArray(response)) {
        customerList = response;
      } else if (Array.isArray(response?.customers)) {
        customerList = response.customers;
      } else if (Array.isArray(response?.data)) {
        customerList = response.data;
      } else if (Array.isArray(response?.data?.customers)) {
        customerList = response.data.customers;
      }

      setCustomers(customerList);
    } catch (error) {
      console.error("LOAD CUSTOMERS ERROR:", error);

      console.error("LOAD CUSTOMERS RESPONSE:", error?.response?.data);

      toast.error(error?.response?.data?.message || "Failed to load customers");

      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // ==========================================================
  // FILTER CUSTOMERS
  // ==========================================================

  const filteredCustomers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) {
      return customers;
    }

    return customers.filter((customer) => {
      return (
        customer.name?.toLowerCase().includes(search) ||
        customer.phone?.toLowerCase().includes(search) ||
        customer.email?.toLowerCase().includes(search) ||
        customer.address?.toLowerCase().includes(search) ||
        customer.customerType?.toLowerCase().includes(search)
      );
    });
  }, [customers, searchTerm]);

  // ==========================================================
  // STATISTICS
  // ==========================================================

  const stats = useMemo(() => {
    const activeCustomers = customers.filter((customer) => customer.isActive);

    const inactiveCustomers = customers.filter(
      (customer) => !customer.isActive,
    );

    return {
      total: customers.length,
      active: activeCustomers.length,
      inactive: inactiveCustomers.length,
    };
  }, [customers]);

  // ==========================================================
  // OPEN ADD MODAL
  // ==========================================================

  const handleAddCustomer = () => {
    setEditingCustomer(null);

    setFormData({
      ...EMPTY_FORM,
    });

    setShowModal(true);
  };

  // ==========================================================
  // OPEN EDIT MODAL
  // ==========================================================

  const handleEditCustomer = (customer) => {
    setEditingCustomer(customer);

    setFormData({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      customerType: customer.customerType || "Individual",
      notes: customer.notes || "",
      isActive: customer.isActive !== false,
    });

    setShowModal(true);
  };

  // ==========================================================
  // CLOSE MODAL
  // ==========================================================

  const handleCloseModal = () => {
    if (saving) {
      return;
    }

    setShowModal(false);
    setEditingCustomer(null);

    setFormData({
      ...EMPTY_FORM,
    });
  };

  // ==========================================================
  // FORM CHANGE
  // ==========================================================

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // ==========================================================
  // SAVE CUSTOMER
  // ==========================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Customer name is required");
      return;
    }

    try {
      setSaving(true);

      // ======================================================
      // UPDATE EXISTING CUSTOMER
      // ======================================================

      if (editingCustomer) {
        console.log("UPDATING CUSTOMER:", editingCustomer._id, formData);

        await updateCustomer(editingCustomer._id, formData);

        toast.success("Customer updated successfully");
      }

      // ======================================================
      // CREATE NEW CUSTOMER
      // ======================================================
      else {
        console.log("CREATING CUSTOMER:", formData);

        const response = await createCustomer(formData);

        console.log("CREATE CUSTOMER RESPONSE:", response);

        toast.success("Customer added successfully");
      }

      /*
       * IMPORTANT:
       *
       * Always reload the customers from MongoDB after
       * saving instead of depending on the structure of
       * the create/update response.
       *
       * This makes sure the customer actually appears
       * in the table after it has been saved.
       */
      await loadCustomers();

      handleCloseModal();
    } catch (error) {
      console.error("SAVE CUSTOMER ERROR:", error);

      console.error("SAVE CUSTOMER RESPONSE:", error?.response?.data);

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to save customer",
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================
  // DELETE CONFIRMATION
  // ==========================================================

  const openDeleteModal = (customer) => {
    setCustomerToDelete(customer);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (saving) {
      return;
    }

    setShowDeleteModal(false);
    setCustomerToDelete(null);
  };

  // ==========================================================
  // DELETE CUSTOMER
  // ==========================================================

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) {
      return;
    }

    try {
      setSaving(true);

      await deleteCustomer(customerToDelete._id);

      toast.success("Customer deleted successfully");

      /*
       * Reload from backend so the table always reflects
       * the actual database state.
       */
      await loadCustomers();

      setShowDeleteModal(false);
      setCustomerToDelete(null);
    } catch (error) {
      console.error("DELETE CUSTOMER ERROR:", error);

      toast.error(
        error?.response?.data?.message || "Failed to delete customer",
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================
  // TOGGLE CUSTOMER STATUS
  // ==========================================================

  const handleToggleStatus = async (customer) => {
    try {
      const response = await updateCustomer(customer._id, {
        isActive: !customer.isActive,
      });

      console.log("TOGGLE CUSTOMER RESPONSE:", response);

      toast.success(
        customer.isActive ? "Customer deactivated" : "Customer activated",
      );

      /*
       * Reload from backend so the displayed status is
       * guaranteed to match MongoDB.
       */
      await loadCustomers();
    } catch (error) {
      console.error("TOGGLE CUSTOMER STATUS ERROR:", error);

      toast.error(
        error?.response?.data?.message || "Failed to update customer status",
      );
    }
  };

  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  const formatDate = (date) => {
    if (!date) {
      return "—";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "—";
    }

    return parsedDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage your egg customers and their contact details.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddCustomer}
          className="inline-flex items-center justify-center rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
        >
          + Add Customer
        </button>
      </div>

      {/* ======================================================
          STATISTICS
      ====================================================== */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Customers</p>

          <p className="mt-1 text-3xl font-bold text-gray-900">
            {stats.total.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Active Customers</p>

          <p className="mt-1 text-3xl font-bold text-green-600">
            {stats.active.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">
            Inactive Customers
          </p>

          <p className="mt-1 text-3xl font-bold text-gray-500">
            {stats.inactive.toLocaleString()}
          </p>
        </div>
      </div>

      {/* ======================================================
          SEARCH / CONTROLS
      ====================================================== */}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-xl">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, phone, email, address..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </div>

          <button
            type="button"
            onClick={loadCustomers}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* ======================================================
          CUSTOMER TABLE
      ====================================================== */}

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer</th>

                <th className="px-4 py-3 font-semibold">Phone</th>

                <th className="px-4 py-3 font-semibold">Email</th>

                <th className="px-4 py-3 font-semibold">Type</th>

                <th className="px-4 py-3 font-semibold">Address</th>

                <th className="px-4 py-3 font-semibold">Status</th>

                <th className="px-4 py-3 font-semibold">Added</th>

                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    Loading customers...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center">
                    <div className="text-gray-500">
                      <p className="font-medium">No customers found</p>

                      <p className="mt-1 text-sm">
                        {searchTerm
                          ? "Try a different search."
                          : "Add your first customer to get started."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr
                    key={customer._id}
                    className="transition hover:bg-gray-50"
                  >
                    <td className="px-4 py-4">
                      <div className="font-semibold text-gray-900">
                        {customer.name || "—"}
                      </div>

                      {customer.notes && (
                        <div className="mt-1 max-w-xs truncate text-xs text-gray-400">
                          {customer.notes}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4 text-gray-700">
                      {customer.phone || "—"}
                    </td>

                    <td className="px-4 py-4 text-gray-700">
                      {customer.email || "—"}
                    </td>

                    <td className="px-4 py-4">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                        {customer.customerType || "Individual"}
                      </span>
                    </td>

                    <td className="max-w-xs px-4 py-4 text-gray-700">
                      <span className="line-clamp-2">
                        {customer.address || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(customer)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          customer.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                        title="Click to change status"
                      >
                        {customer.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-gray-500">
                      {formatDate(customer.createdAt)}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditCustomer(customer)}
                          className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => openDeleteModal(customer)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================
          ADD / EDIT CUSTOMER MODAL
      ====================================================== */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* Header */}

            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingCustomer ? "Edit Customer" : "Add Customer"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {editingCustomer
                    ? "Update the customer's details."
                    : "Enter the customer's contact details."}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                disabled={saving}
                className="rounded-lg px-3 py-2 text-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            {/* Form */}

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {/* Customer name */}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Customer Name *
                </label>

                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. ABC Supermarket"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </div>

              {/* Phone + Email */}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                    Phone Number
                  </label>

                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="e.g. 08012345678"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                    Email
                  </label>

                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="customer@example.com"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>
              </div>

              {/* Customer type */}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Customer Type
                </label>

                <select
                  name="customerType"
                  value={formData.customerType}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                >
                  {CUSTOMER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Address */}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Address
                </label>

                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Customer address"
                  className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </div>

              {/* Notes */}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Notes
                </label>

                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Optional notes about this customer"
                  className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </div>

              {/* Active */}

              {editingCustomer && (
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-gray-50 p-4">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />

                  <span>
                    <span className="block text-sm font-semibold text-gray-800">
                      Active Customer
                    </span>

                    <span className="block text-xs text-gray-500">
                      Active customers can be selected when creating egg sales.
                    </span>
                  </span>
                </label>
              )}

              {/* Buttons */}

              <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingCustomer
                      ? "Update Customer"
                      : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================
          DELETE CONFIRMATION MODAL
      ====================================================== */}

      {showDeleteModal && customerToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900">Delete Customer</h2>

            <p className="mt-3 text-sm leading-6 text-gray-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-gray-900">
                {customerToDelete.name}
              </span>
              ?
            </p>

            <p className="mt-2 text-xs text-gray-500">
              This is a soft delete. Existing egg sales records will not be
              deleted.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={saving}
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteCustomer}
                disabled={saving}
                className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? "Deleting..." : "Delete Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
