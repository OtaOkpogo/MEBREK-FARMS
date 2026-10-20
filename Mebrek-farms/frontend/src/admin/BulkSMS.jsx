import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import apiClient from "../services/apiClient";

const unwrap = (response) => response?.data ?? response;

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
};

const statusClass = (status) => {
  if (status === "completed") {
    return "bg-green-100 text-green-800";
  }

  if (status === "partial") {
    return "bg-amber-100 text-amber-800";
  }

  if (status === "failed") {
    return "bg-red-100 text-red-800";
  }

  return "bg-gray-100 text-gray-700";
};

export default function BulkSMS() {
  const [customers, setCustomers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [smsStatus, setSmsStatus] = useState(null);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updatingConsent, setUpdatingConsent] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [statusResponse, customersResponse, campaignsResponse] =
        await Promise.all([
          apiClient.get("/sms/status"),
          apiClient.get("/sms/customers"),
          apiClient.get("/sms/campaigns"),
        ]);

      const statusData = unwrap(statusResponse);
      const customerData = unwrap(customersResponse);
      const campaignData = unwrap(campaignsResponse);

      setSmsStatus(statusData);
      setCustomers(
        Array.isArray(customerData?.customers)
          ? customerData.customers
          : [],
      );
      setCampaigns(
        Array.isArray(campaignData) ? campaignData : [],
      );
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to load SMS information.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const eligibleCustomers = useMemo(
    () =>
      customers.filter(
        (customer) =>
          customer.smsMarketingConsent &&
          customer.normalizedPhone,
      ),
    [customers],
  );

  const selectedCustomers = useMemo(
    () =>
      eligibleCustomers.filter((customer) =>
        selectedIds.includes(customer._id),
      ),
    [eligibleCustomers, selectedIds],
  );

  const segments = useMemo(() => {
    // Approximate SMS segmentation for a plain-text message.
    // GSM-7 can carry 160 characters in one segment, then 153 per segment.
    // Characters outside GSM-7 generally use UCS-2: 70, then 67 per segment.
    const gsmPattern =
      /^[\x00-\x7F£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#$%&'()*+,\-./:;<=>?@¡ÄÖÑÜ§¿äöñüà%€\r\n]*$/;

    const gsm = gsmPattern.test(message);
    const length = message.length;

    if (!length) return { gsm, count: 0, characters: 0 };

    const singleLimit = gsm ? 160 : 70;
    const multiLimit = gsm ? 153 : 67;

    return {
      gsm,
      characters: length,
      count:
        length <= singleLimit
          ? 1
          : Math.ceil(length / multiLimit),
    };
  }, [message]);

  const toggleCustomer = (id) => {
    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
  };

  const selectAllEligible = () => {
    setSelectedIds((previous) => {
      const ids = new Set(previous);

      eligibleCustomers.forEach((customer) => {
        ids.add(customer._id);
      });

      return [...ids];
    });
  };

  const clearSelection = () => setSelectedIds([]);

  const updateConsent = async (customer, consent) => {
    setUpdatingConsent(customer._id);

    try {
      await apiClient.patch(
        `/sms/customers/${customer._id}/consent`,
        { consent },
      );

      setCustomers((previous) =>
        previous.map((item) =>
          item._id === customer._id
            ? { ...item, smsMarketingConsent: consent }
            : item,
        ),
      );

      if (!consent) {
        setSelectedIds((previous) =>
          previous.filter((id) => id !== customer._id),
        );
      }

      toast.success(
        consent
          ? "Promotional SMS consent enabled."
          : "Promotional SMS consent withdrawn.",
      );
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "Unable to update customer consent.",
      );
    } finally {
      setUpdatingConsent("");
    }
  };

  const sendCampaign = async () => {
    if (!smsStatus?.configured) {
      toast.error("Configure Termii credentials before sending.");
      return;
    }

    if (!title.trim() || !message.trim()) {
      toast.error("Enter a campaign title and message.");
      return;
    }

    if (!selectedCustomers.length) {
      toast.error("Select at least one eligible customer.");
      return;
    }

    if (selectedCustomers.length > 100) {
      toast.error("Select no more than 100 customers per campaign.");
      return;
    }

    const confirmed = window.confirm(
      `Send this SMS campaign to ${selectedCustomers.length} opted-in customers?\n\n` +
        `Title: ${title.trim()}\n\n` +
        `Message:\n${message.trim()}\n\n` +
        "SMS charges may apply. This action cannot be undone.",
    );

    if (!confirmed) return;

    setSending(true);

    try {
      const response = await apiClient.post("/sms/campaigns", {
        title: title.trim(),
        message: message.trim(),
        customerIds: selectedCustomers.map((customer) => customer._id),
      });

      const result = unwrap(response);
      const campaign = result?.campaign;

      toast.success(
        `Campaign processed. Accepted: ${campaign?.sentCount ?? 0}; failed: ${campaign?.failedCount ?? 0}.`,
      );

      setTitle("");
      setMessage("");
      setSelectedIds([]);

      await loadData();
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "Campaign could not be sent.",
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-gray-600">
        Loading SMS management...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 text-gray-800">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
          Mebrek Farms
        </p>

        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          SMS Management
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Send farm announcements to customers who have opted in to
          promotional SMS. Customer order confirmations are handled
          separately by the backend.
        </p>
      </div>

      <section
        className={`rounded-xl border p-4 ${
          smsStatus?.configured
            ? "border-green-200 bg-green-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold">
              {smsStatus?.configured
                ? "Termii credentials detected"
                : "Termii setup required"}
            </h2>

            <p className="mt-1 text-sm text-gray-700">
              {smsStatus?.message ||
                "Termii configuration has not been checked."}
            </p>
          </div>

          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
              smsStatus?.configured
                ? "bg-green-200 text-green-900"
                : "bg-amber-200 text-amber-900"
            }`}
          >
            {smsStatus?.configured ? "CONFIGURED" : "NOT READY"}
          </span>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Active customers</p>
          <p className="mt-2 text-3xl font-bold">
            {customers.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Opted-in, valid numbers</p>
          <p className="mt-2 text-3xl font-bold text-green-700">
            {eligibleCustomers.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Selected recipients</p>
          <p className="mt-2 text-3xl font-bold text-blue-700">
            {selectedCustomers.length}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold">Compose campaign</h2>

        <p className="mt-1 text-sm text-gray-500">
          Campaigns are limited to 100 recipients per request.
          Only opted-in customers with valid Nigerian numbers can be selected.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div>
            <label
              htmlFor="sms-title"
              className="mb-2 block text-sm font-semibold"
            >
              Campaign title
            </label>

            <input
              id="sms-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder="e.g. Weekend egg availability"
              className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
          </div>

          <div>
            <label
              htmlFor="sms-message"
              className="mb-2 block text-sm font-semibold"
            >
              Message
            </label>

            <textarea
              id="sms-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={1000}
              rows={5}
              placeholder="Write your customer announcement..."
              className="w-full resize-y rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />

            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-gray-500">
              <span>
                {segments.characters} characters · approximately{" "}
                {segments.count} SMS segment
                {segments.count === 1 ? "" : "s"} per recipient
              </span>

              <span>{1000 - message.length} characters remaining</span>
            </div>

            {message.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                Estimated total segments:{" "}
                {segments.count * selectedCustomers.length}.
                This is an estimate, not a price quote.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={sendCampaign}
            disabled={
              sending ||
              !smsStatus?.configured ||
              !title.trim() ||
              !message.trim() ||
              selectedCustomers.length === 0 ||
              selectedCustomers.length > 100
            }
            className="rounded-lg bg-green-700 px-5 py-3 font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {sending ? "Processing campaign..." : "Review and send SMS"}
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={sending}
            className="rounded-lg border border-gray-300 px-5 py-3 font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Customer audience</h2>
            <p className="mt-1 text-sm text-gray-500">
              Consent changes are recorded in the customer record.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectAllEligible}
              className="rounded-lg border border-green-700 px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-50"
            >
              Select eligible
            </button>

            <button
              type="button"
              onClick={clearSelection}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Clear selection
            </button>
          </div>
        </div>

        {customers.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">
            No active customers found in the customer database.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Select</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Marketing consent</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {customers.map((customer) => {
                  const eligible = Boolean(
                    customer.smsMarketingConsent &&
                      customer.normalizedPhone,
                  );

                  return (
                    <tr key={customer._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(customer._id)}
                          disabled={!eligible}
                          onChange={() => toggleCustomer(customer._id)}
                          aria-label={`Select ${customer.name}`}
                          className="h-4 w-4 accent-green-700 disabled:cursor-not-allowed"
                        />
                      </td>

                      <td className="px-4 py-3 font-medium">
                        {customer.name}
                      </td>

                      <td className="px-4 py-3">
                        <div>{customer.phone || "No phone number"}</div>
                        {!customer.normalizedPhone && (
                          <p className="mt-1 text-xs text-red-600">
                            Invalid Nigerian number
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {customer.customerType || "Individual"}
                      </td>

                      <td className="px-4 py-3">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={customer.smsMarketingConsent}
                            disabled={updatingConsent === customer._id}
                            onChange={(event) =>
                              updateConsent(customer, event.target.checked)
                            }
                            className="h-4 w-4 accent-green-700"
                          />

                          <span
                            className={
                              customer.smsMarketingConsent
                                ? "text-green-700"
                                : "text-gray-500"
                            }
                          >
                            {updatingConsent === customer._id
                              ? "Saving..."
                              : customer.smsMarketingConsent
                                ? "Opted in"
                                : "Not opted in"}
                          </span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-5">
          <h2 className="text-xl font-bold">Campaign history</h2>
          <p className="mt-1 text-sm text-gray-500">
            Latest 100 campaigns. “Sent” means accepted by the provider,
            not confirmed delivery to the recipient.
          </p>
        </div>

        {campaigns.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">
            No SMS campaigns have been recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Recipients</th>
                  <th className="px-4 py-3">Accepted</th>
                  <th className="px-4 py-3">Failed</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {campaigns.map((campaign) => (
                  <tr key={campaign._id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{campaign.title}</p>
                      <p className="mt-1 max-w-xs truncate text-xs text-gray-500">
                        {campaign.message}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDate(campaign.createdAt)}
                    </td>

                    <td className="px-4 py-3">
                      {campaign.totalRecipients ?? 0}
                    </td>

                    <td className="px-4 py-3 text-green-700">
                      {campaign.sentCount ?? 0}
                    </td>

                    <td className="px-4 py-3 text-red-700">
                      {campaign.failedCount ?? 0}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(campaign.status)}`}
                      >
                        {campaign.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
