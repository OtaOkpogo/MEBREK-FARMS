import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import { searchCustomers } from "../services/customerService";

import {
  requestOlderSaleAccess as requestEggAccess,
  fetchSaleAccessRequests as fetchEggRequests,
  reviewSaleAccessRequest as reviewEggRequest,
  deleteSaleAccessRequest as deleteEggAccessRequest,
} from "../services/eggSalesService";

import {
  requestOlderSaleAccess as requestManureAccess,
  fetchSaleAccessRequests as fetchManureRequests,
  reviewSaleAccessRequest as reviewManureRequest,
  deleteSaleAccessRequest as deleteManureAccessRequest,
} from "../services/manureSalesService";

export default function SaleAccessPanel({
  saleType = "egg",
  isSuperadmin = false,
  canRequest = false,
  onAccessChanged,
}) {
  const isManure = saleType === "manure";

  const requestAccess = isManure ? requestManureAccess : requestEggAccess;
  const getRequests = isManure ? fetchManureRequests : fetchEggRequests;
  const reviewRequest = isManure ? reviewManureRequest : reviewEggRequest;
  const deleteRequest = isManure
    ? deleteManureAccessRequest
    : deleteEggAccessRequest;

  const [identifierType, setIdentifierType] = useState("invoiceNumber");
  const [identifier, setIdentifier] = useState("");
  const [reason, setReason] = useState("");

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState("");

  // Keeps access expiry countdowns current.
  const [clockNow, setClockNow] = useState(() => Date.now());

  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  const [matchingSales, setMatchingSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);

  const searchTimer = useRef(null);
  const searchSequence = useRef(0);
  const customerInputRef = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const notifySidebar = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("saleAccessRequestListChanged", {
        detail: { saleType },
      }),
    );
  }, [saleType]);

  const loadRequests = useCallback(async () => {
    setLoading(true);

    try {
      const response = await getRequests();

      const items = Array.isArray(response)
        ? response
        : Array.isArray(response?.requests)
          ? response.requests
          : Array.isArray(response?.data)
            ? response.data
            : [];

      setRequests(items);
      return items;
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Unable to load older-sale access requests.",
      );

      return [];
    } finally {
      setLoading(false);
    }
  }, [getRequests]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }

      searchSequence.current += 1;
    };
  }, []);

  const resetCustomerSearch = () => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }

    searchSequence.current += 1;

    setCustomerSuggestions([]);
    setSearchingCustomers(false);
    setCustomerSearchError("");
    setShowCustomerSuggestions(false);
    setSelectedCustomer(null);
    setMatchingSales([]);
    setSelectedSale(null);
  };

  const handleIdentifierTypeChange = (event) => {
    setIdentifierType(event.target.value);
    setIdentifier("");
    resetCustomerSearch();
  };

  const getCustomerName = (customer) =>
    String(
      customer?.name ||
        customer?.customerName ||
        [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") ||
        "",
    ).trim();

  const handleIdentifierChange = (event) => {
    const value = event.target.value;

    setIdentifier(value);
    setMatchingSales([]);
    setSelectedSale(null);
    setCustomerSearchError("");

    if (identifierType !== "customerName") return;

    setSelectedCustomer(null);

    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }

    const sequence = ++searchSequence.current;
    const searchTerm = value.trim();

    if (searchTerm.length < 2) {
      setCustomerSuggestions([]);
      setSearchingCustomers(false);
      setShowCustomerSuggestions(false);
      return;
    }

    setShowCustomerSuggestions(true);
    setSearchingCustomers(true);
    setCustomerSuggestions([]);

    searchTimer.current = setTimeout(async () => {
      try {
        const response = await searchCustomers(searchTerm);

        if (sequence !== searchSequence.current) return;

        let customers = [];

        if (Array.isArray(response)) {
          customers = response;
        } else if (Array.isArray(response?.customers)) {
          customers = response.customers;
        } else if (Array.isArray(response?.data)) {
          customers = response.data;
        } else if (Array.isArray(response?.results)) {
          customers = response.results;
        }

        setCustomerSuggestions(
          customers.filter((customer) => getCustomerName(customer)),
        );
      } catch (err) {
        if (sequence !== searchSequence.current) return;

        console.error(
          "Customer autocomplete error:",
          err?.response?.data || err,
        );

        setCustomerSuggestions([]);
        setCustomerSearchError(
          err?.response?.data?.message ||
            "Unable to load customers. Check your connection and try again.",
        );
      } finally {
        if (sequence === searchSequence.current) {
          setSearchingCustomers(false);
        }
      }
    }, 250);
  };

  const chooseCustomer = (customer) => {
    const name = getCustomerName(customer);

    if (!name) {
      toast.error("This customer record has no name.");
      return;
    }

    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }

    searchSequence.current += 1;

    setSelectedCustomer({ ...customer, name });
    setIdentifier(name);
    setCustomerSuggestions([]);
    setShowCustomerSuggestions(false);
    setSearchingCustomers(false);
    setCustomerSearchError("");
    setMatchingSales([]);
    setSelectedSale(null);
  };

  const submit = async (event) => {
    event.preventDefault();

    const searchValue = identifier.trim();

    if (!searchValue || !reason.trim()) {
      toast.error("Enter a sale identifier and a reason for access.");
      return;
    }

    if (
      identifierType === "customerName" &&
      (!selectedCustomer ||
        getCustomerName(selectedCustomer).toLowerCase() !==
          searchValue.toLowerCase())
    ) {
      toast.error("Select a customer from the suggestions first.");
      customerInputRef.current?.focus();
      setShowCustomerSuggestions(true);
      return;
    }

    if (matchingSales.length > 0 && !selectedSale) {
      toast.error("Select the correct invoice before submitting.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        identifierType,
        identifier: searchValue,
        reason: reason.trim(),
      };

      if (identifierType === "customerName" && selectedCustomer) {
        payload.customerId = selectedCustomer._id || selectedCustomer.id;
        payload.customerPhone = selectedCustomer.phone || "";
      }

      if (selectedSale) {
        payload.saleId = selectedSale._id;
      }

      const result = await requestAccess(payload);

      toast.success(result?.message || "Access request submitted.");

      setIdentifier("");
      setReason("");
      resetCustomerSearch();

      await loadRequests();
      notifySidebar();
    } catch (err) {
      const data = err?.response?.data;

      if (
        data?.code === "MULTIPLE_SALES_MATCHED" &&
        Array.isArray(data.matches)
      ) {
        setMatchingSales(data.matches);
        setSelectedSale(null);

        toast.info(
          "Select the correct older invoice below before submitting again.",
        );
      } else {
        toast.error(data?.message || "Unable to submit access request.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const review = async (item, decision) => {
    const isRejecting = decision === "rejected";

    const reviewNote = window.prompt(
      isRejecting
        ? "Enter the reason for rejecting this access request (required):"
        : "Approval note (optional):",
      "",
    );

    if (reviewNote === null) return;

    if (isRejecting && !reviewNote.trim()) {
      toast.error("Please provide a reason for rejecting the request.");
      return;
    }

    setBusyId(item._id);

    try {
      const result = await reviewRequest(item._id, {
        decision,
        reviewNote: reviewNote.trim(),
      });

      toast.success(result?.message || "Request reviewed.");

      await loadRequests();
      notifySidebar();

      if (decision === "approved" && onAccessChanged) {
        await onAccessChanged();
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Unable to review access request.",
      );
    } finally {
      setBusyId("");
    }
  };

  // Confirm deletion before calling the backend.
  // The backend remains responsible for enforcing the user's permissions.
  const handleDeleteRequest = async (item) => {
    const isPending = item.status === "pending";

    const message = isSuperadmin
      ? `Delete the access request for invoice "${item.invoiceNumber || "Unknown invoice"}"? This cannot be undone.`
      : `Cancel your pending access request for invoice "${item.invoiceNumber || "Unknown invoice"}"?`;

    if (!window.confirm(message)) return;

    setBusyId(item._id);

    try {
      const result = await deleteRequest(item._id);

      toast.success(result?.message || "Access request deleted.");

      await loadRequests();
      notifySidebar();

      // Refresh the sales view if the deleted request was an approval.
      if (!isPending && onAccessChanged) {
        await onAccessChanged();
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Unable to delete this access request.",
      );
    } finally {
      setBusyId("");
    }
  };

  const title = isManure ? "Manure sales" : "Egg sales";

  const identifierOptions = [
    { value: "invoiceNumber", label: "Invoice Number" },
    { value: "phone", label: "Customer Phone" },
    { value: "customerName", label: "Customer Name" },
  ];

  const identifierPlaceholder = {
    invoiceNumber: "Enter invoice number",
    phone: "Enter customer's phone number",
    customerName: "Type at least 2 letters",
  }[identifierType];

  const formatDate = (value) => {
    if (!value) return "Date unavailable";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "Date unavailable"
      : date.toLocaleDateString();
  };

  const formatDateTime = (value) => {
    if (!value) return "Expiry date unavailable";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "Expiry date unavailable"
      : date.toLocaleString();
  };

  const getExpiryDetails = (item) => {
    if (item.status !== "approved") {
      return {
        expired: false,
        expiryText: "—",
        countdownText: "",
      };
    }

    if (!item.accessExpiresAt) {
      return {
        expired: false,
        expiryText: "Expiry date unavailable",
        countdownText: "",
      };
    }

    const expiryTimestamp = new Date(item.accessExpiresAt).getTime();

    if (Number.isNaN(expiryTimestamp)) {
      return {
        expired: false,
        expiryText: "Expiry date unavailable",
        countdownText: "",
      };
    }

    const remainingMs = expiryTimestamp - clockNow;

    if (remainingMs <= 0) {
      return {
        expired: true,
        expiryText: formatDateTime(item.accessExpiresAt),
        countdownText: "Expired",
      };
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      expired: false,
      expiryText: formatDateTime(item.accessExpiresAt),
      countdownText: `${hours}h ${minutes}m ${seconds}s remaining`,
    };
  };

  const showActionsColumn = isSuperadmin || canRequest;

  return (
    <section className="mb-6 rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gray-800">Older {title} access</h2>

          <p className="mt-1 text-sm text-gray-500">
            Request access to older sales by invoice number, customer phone, or
            customer name. Approved access lasts two hours and does not allow
            deletion of the underlying sale.
          </p>
        </div>

        <button
          type="button"
          onClick={loadRequests}
          disabled={loading}
          className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh requests"}
        </button>
      </div>

      {!isSuperadmin && canRequest && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select
              value={identifierType}
              onChange={handleIdentifierTypeChange}
              className="rounded border px-3 py-2"
              aria-label="Search by"
            >
              {identifierOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="relative">
              <input
                ref={customerInputRef}
                type={identifierType === "phone" ? "tel" : "text"}
                value={identifier}
                onChange={handleIdentifierChange}
                onFocus={() => {
                  if (
                    identifierType === "customerName" &&
                    identifier.trim().length >= 2 &&
                    !selectedCustomer
                  ) {
                    setShowCustomerSuggestions(true);
                  }
                }}
                onBlur={() => {
                  window.setTimeout(() => {
                    setShowCustomerSuggestions(false);
                  }, 180);
                }}
                placeholder={identifierPlaceholder}
                className="w-full rounded border px-3 py-2"
                autoComplete="off"
                required
              />

              {identifierType === "customerName" &&
                showCustomerSuggestions &&
                !selectedCustomer && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
                    {searchingCustomers ? (
                      <p className="px-3 py-3 text-sm text-gray-500">
                        Searching customers...
                      </p>
                    ) : customerSearchError ? (
                      <div className="px-3 py-3 text-sm text-red-600">
                        <p>{customerSearchError}</p>

                        <button
                          type="button"
                          className="mt-2 font-medium underline"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() =>
                            handleIdentifierChange({
                              target: { value: identifier },
                            })
                          }
                        >
                          Try again
                        </button>
                      </div>
                    ) : customerSuggestions.length > 0 ? (
                      customerSuggestions.map((customer, index) => (
                        <button
                          key={
                            customer._id ||
                            customer.id ||
                            `${getCustomerName(customer)}-${index}`
                          }
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => chooseCustomer(customer)}
                          className="block w-full border-b border-gray-100 px-3 py-2 text-left last:border-b-0 hover:bg-amber-50"
                        >
                          <span className="block font-medium text-gray-800">
                            {getCustomerName(customer)}
                          </span>

                          <span className="block text-xs text-gray-500">
                            {customer.phone || "No phone number"}
                            {customer.email ? ` · ${customer.email}` : ""}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-3 text-sm text-gray-500">
                        No matching customers found. Check the spelling or try
                        another name.
                      </p>
                    )}
                  </div>
                )}

              {identifierType === "customerName" && selectedCustomer && (
                <p className="mt-1 text-xs text-green-700">
                  Customer selected: {getCustomerName(selectedCustomer)}
                  <button
                    type="button"
                    className="ml-2 underline"
                    onClick={() => {
                      setIdentifier("");
                      setSelectedCustomer(null);
                      setCustomerSuggestions([]);
                      setCustomerSearchError("");
                      setShowCustomerSuggestions(false);
                      customerInputRef.current?.focus();
                    }}
                  >
                    Change
                  </button>
                </p>
              )}
            </div>

            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for access"
              className="rounded border px-3 py-2"
              maxLength={1000}
              required
            />
          </div>

          {matchingSales.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <h3 className="font-semibold text-gray-800">
                Select the correct older invoice
              </h3>

              <p className="mt-1 text-sm text-gray-600">
                Multiple older sales match your search. Choose one invoice
                before submitting.
              </p>

              <div className="mt-3 space-y-2">
                {matchingSales.map((sale) => {
                  const isSelected = selectedSale?._id === sale._id;

                  return (
                    <button
                      key={sale._id}
                      type="button"
                      onClick={() => setSelectedSale(sale)}
                      className={`flex w-full flex-wrap items-center justify-between gap-2 rounded border p-3 text-left ${
                        isSelected
                          ? "border-amber-700 bg-amber-100"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <span>
                        <span className="block font-medium text-gray-800">
                          Invoice: {sale.invoiceNumber || "No invoice number"}
                        </span>

                        <span className="block text-xs text-gray-500">
                          {sale.customer || "Customer unavailable"} ·{" "}
                          {formatDate(sale.date || sale.createdAt)}
                        </span>
                      </span>

                      <span className="text-sm font-medium">
                        {isSelected ? "Selected" : "Choose invoice"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedSale && (
                <p className="mt-2 text-sm text-green-800">
                  Selected invoice:{" "}
                  {selectedSale.invoiceNumber || "No invoice number"}
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={
              submitting ||
              searchingCustomers ||
              (matchingSales.length > 0 && !selectedSale)
            }
            className="rounded bg-amber-700 px-4 py-2 font-medium text-white hover:bg-amber-800 disabled:opacity-50"
          >
            {submitting
              ? "Submitting..."
              : selectedSale
                ? "Request access for selected invoice"
                : "Request access"}
          </button>
        </form>
      )}

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <p className="py-3 text-sm text-gray-500">Loading requests...</p>
        ) : requests.length === 0 ? (
          <p className="py-3 text-sm text-gray-500">
            No access requests for this section yet.
          </p>
        ) : (
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-2 pr-3">Invoice</th>
                <th className="py-2 pr-3">Requested by</th>
                <th className="py-2 pr-3">Request and review reasons</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Access expiry and countdown</th>
                {isSuperadmin && <th className="py-2 pr-3">Review</th>}
                {showActionsColumn && <th className="py-2">Actions</th>}
              </tr>
            </thead>

            <tbody>
              {requests.map((item) => {
                const expiry = getExpiryDetails(item);

                const displayedStatus = expiry.expired
                  ? "Expired"
                  : item.status;

                const isBusy = busyId === item._id;

                // Managers can only cancel pending requests.
                // Superadmins can delete requests in any status.
                const canDeleteRequest =
                  isSuperadmin || (canRequest && item.status === "pending");

                return (
                  <tr key={item._id} className="border-b last:border-0">
                    <td className="py-3 pr-3 font-medium">
                      {item.invoiceNumber || "—"}
                    </td>

                    <td className="py-3 pr-3">
                      {item.requesterName ||
                        item.requesterId?.name ||
                        "Manager"}
                    </td>

                    <td className="max-w-sm whitespace-normal py-3 pr-3">
                      <p className="font-medium text-gray-800">
                        Request reason:
                      </p>

                      <p className="text-gray-700">
                        {item.reason || "No reason provided"}
                      </p>

                      {item.status === "rejected" && (
                        <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3">
                          <p className="text-sm font-semibold text-red-700">
                            Superadmin's rejection reason
                          </p>

                          <p className="mt-1 text-sm text-red-800">
                            {item.reviewNote?.trim() ||
                              "No rejection reason was recorded."}
                          </p>
                        </div>
                      )}

                      {item.status === "approved" &&
                        item.reviewNote?.trim() && (
                          <div className="mt-2 rounded-md border border-green-200 bg-green-50 p-3">
                            <p className="text-sm font-semibold text-green-700">
                              Superadmin's note
                            </p>

                            <p className="mt-1 text-sm text-green-800">
                              {item.reviewNote}
                            </p>
                          </div>
                        )}
                    </td>

                    <td className="py-3 pr-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          expiry.expired
                            ? "bg-red-100 text-red-800"
                            : item.status === "approved"
                              ? "bg-green-100 text-green-800"
                              : item.status === "rejected"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {displayedStatus}
                      </span>
                    </td>

                    <td className="py-3 pr-3">
                      {item.status === "approved" ? (
                        <div className="min-w-48">
                          <p className="text-gray-700">{expiry.expiryText}</p>

                          <p
                            aria-live="off"
                            className={`mt-1 font-semibold ${
                              expiry.expired ? "text-red-700" : "text-green-700"
                            }`}
                          >
                            {expiry.countdownText}
                          </p>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    {isSuperadmin && (
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-2">
                          {item.status === "pending" ? (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => review(item, "approved")}
                                className="rounded bg-green-700 px-2 py-1 text-white disabled:opacity-50"
                              >
                                {isBusy ? "Processing..." : "Approve"}
                              </button>

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => review(item, "rejected")}
                                className="rounded bg-red-700 px-2 py-1 text-white disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-gray-400">Reviewed</span>
                          )}
                        </div>
                      </td>
                    )}

                    {showActionsColumn && (
                      <td className="py-3">
                        {canDeleteRequest ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDeleteRequest(item)}
                            title={
                              isSuperadmin
                                ? "Delete this access request"
                                : "Cancel your pending access request"
                            }
                            className="whitespace-nowrap rounded bg-red-700 px-3 py-1.5 font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isBusy
                              ? "Processing..."
                              : isSuperadmin
                                ? "Delete"
                                : "Cancel request"}
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
