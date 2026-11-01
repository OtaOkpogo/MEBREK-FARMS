import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  fetchPayrollWorkers,
  setPayrollSalary,
  createSalaryPayment,
  createBulkSalaryPayments,
} from "../services/expenseService";

const PAYMENT_METHODS = ["Cash", "Transfer", "POS"];

const today = () => {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const currentPeriod = () => today().slice(0, 7);

const money = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const workerId = (worker) => worker?._id || worker?.id || worker?.workerId;

const workerName = (worker) =>
  worker?.workerName ||
  worker?.name ||
  [worker?.firstName, worker?.lastName].filter(Boolean).join(" ") ||
  "Unnamed worker";

const amountValue = (worker) =>
  Number(worker?.agreedSalary ?? worker?.salaryAmount ?? 0);

const paidValue = (worker) =>
  Number(worker?.paidToDate ?? worker?.paidAmount ?? worker?.totalPaid ?? 0);

const outstandingValue = (worker) =>
  Number(
    worker?.outstanding ??
      worker?.balance ??
      Math.max(0, amountValue(worker) - paidValue(worker)),
  );

export default function ExpensePayroll({ onPayrollSaved }) {
  const [salaryPeriod, setSalaryPeriod] = useState(currentPeriod());
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState("Transfer");
  const [remarks, setRemarks] = useState("");

  const [workers, setWorkers] = useState([]);
  const [selectedWorkers, setSelectedWorkers] = useState({});
  const [salaryAmounts, setSalaryAmounts] = useState({});
  const [paymentAmounts, setPaymentAmounts] = useState({});
  const [individualAmounts, setIndividualAmounts] = useState({});

  const [loading, setLoading] = useState(false);
  const [savingSalaryWorkerId, setSavingSalaryWorkerId] = useState("");
  const [savingWorkerId, setSavingWorkerId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const loadPayroll = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetchPayrollWorkers(salaryPeriod);
      const rows = Array.isArray(response?.workers) ? response.workers : [];

      setWorkers(rows);

      setSalaryAmounts((previous) => {
        const next = {};

        rows.forEach((worker) => {
          const id = workerId(worker);
          if (!id) return;

          // Always reflect the saved salary returned by the server.
          // For a worker without a saved salary, retain unsaved typing.
          next[id] = worker.salarySet
            ? String(amountValue(worker))
            : (previous[id] ?? "");
        });

        return next;
      });

      setSelectedWorkers((previous) => {
        const next = {};

        rows.forEach((worker) => {
          const id = workerId(worker);

          if (
            id &&
            previous[id] &&
            worker.salarySet &&
            outstandingValue(worker) > 0
          ) {
            next[id] = true;
          }
        });

        return next;
      });

      setPaymentAmounts((previous) => {
        const next = {};

        rows.forEach((worker) => {
          const id = workerId(worker);
          if (!id) return;

          const balance = outstandingValue(worker);
          const oldAmount = Number(previous[id]);

          next[id] =
            oldAmount > 0 && oldAmount <= balance
              ? String(oldAmount)
              : balance > 0
                ? String(balance)
                : "";
        });

        return next;
      });

      setIndividualAmounts((previous) => {
        const next = {};

        rows.forEach((worker) => {
          const id = workerId(worker);
          if (!id) return;

          const balance = outstandingValue(worker);
          const oldAmount = Number(previous[id]);

          next[id] =
            oldAmount > 0 && oldAmount <= balance
              ? String(oldAmount)
              : balance > 0
                ? String(balance)
                : "";
        });

        return next;
      });
    } catch (error) {
      console.error("LOAD PAYROLL ERROR:", error);
      toast.error(
        error?.response?.data?.message || "Failed to load monthly payroll.",
      );
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [salaryPeriod]);

  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);

  const totals = useMemo(
    () =>
      workers.reduce(
        (result, worker) => {
          result.salary += amountValue(worker);
          result.paid += paidValue(worker);
          result.outstanding += outstandingValue(worker);
          return result;
        },
        { salary: 0, paid: 0, outstanding: 0 },
      ),
    [workers],
  );

  const selectedList = useMemo(
    () =>
      workers.filter((worker) => {
        const id = workerId(worker);

        return (
          id &&
          selectedWorkers[id] &&
          worker.salarySet &&
          outstandingValue(worker) > 0
        );
      }),
    [workers, selectedWorkers],
  );

  const selectedPaymentTotal = useMemo(
    () =>
      selectedList.reduce(
        (sum, worker) => sum + Number(paymentAmounts[workerId(worker)] || 0),
        0,
      ),
    [selectedList, paymentAmounts],
  );

  const updateSalaryAmount = (id, value) => {
    setSalaryAmounts((previous) => ({ ...previous, [id]: value }));
  };

  const updateBulkAmount = (id, value) => {
    setPaymentAmounts((previous) => ({ ...previous, [id]: value }));
  };

  const updateIndividualAmount = (id, value) => {
    setIndividualAmounts((previous) => ({ ...previous, [id]: value }));
  };

  const toggleWorker = (id) => {
    const worker = workers.find((item) => workerId(item) === id);

    if (!worker?.salarySet || outstandingValue(worker) <= 0) return;

    setSelectedWorkers((previous) => ({
      ...previous,
      [id]: !previous[id],
    }));
  };

  const toggleAllWorkers = (checked) => {
    const next = {};

    if (checked) {
      workers.forEach((worker) => {
        const id = workerId(worker);

        if (id && worker.salarySet && outstandingValue(worker) > 0) {
          next[id] = true;
        }
      });
    }

    setSelectedWorkers(next);
  };

  const handleSaveSalary = async (worker) => {
    const id = workerId(worker);
    const salaryAmount = Number(salaryAmounts[id]);

    if (!id) {
      toast.error("Unable to identify this worker.");
      return;
    }

    if (!Number.isFinite(salaryAmount) || salaryAmount <= 0) {
      toast.error("Enter an agreed monthly salary greater than zero.");
      return;
    }

    if (salaryAmount < paidValue(worker)) {
      toast.error(
        `Salary cannot be lower than the ${money(paidValue(worker))} already paid.`,
      );
      return;
    }

    try {
      setSavingSalaryWorkerId(id);

      await setPayrollSalary({
        workerId: id,
        salaryPeriod,
        salaryAmount,
      });

      toast.success(
        `Monthly salary saved for ${workerName(worker)} (${salaryPeriod}).`,
      );

      await loadPayroll();

      if (onPayrollSaved) {
        await onPayrollSaved();
      }
    } catch (error) {
      console.error("SAVE MONTHLY SALARY ERROR:", error);

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to save the agreed monthly salary.",
      );
    } finally {
      setSavingSalaryWorkerId("");
    }
  };

  const validateAmount = (worker, rawAmount) => {
    if (!worker.salarySet) {
      toast.error(`Save the agreed salary for ${workerName(worker)} first.`);
      return null;
    }

    const amount = Number(rawAmount);
    const balance = outstandingValue(worker);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a payment amount greater than zero.");
      return null;
    }

    if (amount > balance + 0.001) {
      toast.error(
        `Payment cannot exceed the outstanding balance of ${money(balance)}.`,
      );
      return null;
    }

    return amount;
  };

  const refreshAfterPayment = async () => {
    await loadPayroll();

    if (onPayrollSaved) {
      await onPayrollSaved();
    }
  };

  const handleIndividualPayment = async (worker) => {
    const id = workerId(worker);
    if (!id) {
      toast.error("Unable to identify this worker.");
      return;
    }

    const amount = validateAmount(worker, individualAmounts[id]);
    if (amount === null) return;

    const confirmed = window.confirm(
      `Record a salary payment of ${money(amount)} for ${workerName(
        worker,
      )} for ${salaryPeriod}?`,
    );

    if (!confirmed) return;

    try {
      setSavingWorkerId(id);

      await createSalaryPayment({
        workerId: id,
        salaryPeriod,
        amount,
        paymentMethod,
        date: paymentDate,
        remarks: remarks.trim(),
      });

      toast.success(`Salary payment recorded for ${workerName(worker)}.`);
      await refreshAfterPayment();
    } catch (error) {
      console.error("INDIVIDUAL SALARY PAYMENT ERROR:", error);

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to record salary payment.",
      );

      await loadPayroll();
    } finally {
      setSavingWorkerId("");
    }
  };

  const handleBulkPayment = async () => {
    if (selectedList.length === 0) {
      toast.error(
        "Select workers with saved salaries and outstanding balances.",
      );
      return;
    }

    const selectedPayments = [];

    for (const worker of selectedList) {
      const id = workerId(worker);
      const amount = validateAmount(worker, paymentAmounts[id]);

      if (amount === null) return;

      selectedPayments.push({ workerId: id, amount });
    }

    const total = selectedPayments.reduce((sum, item) => sum + item.amount, 0);

    const confirmed = window.confirm(
      `Record salary payments for ${selectedPayments.length} worker(s), totalling ${money(
        total,
      )}, for ${salaryPeriod}?\n\nOnly selected workers will be processed.`,
    );

    if (!confirmed) return;

    try {
      setBulkSaving(true);

      const response = await createBulkSalaryPayments({
        salaryPeriod,
        payments: selectedPayments,
        paymentMethod,
        date: paymentDate,
        remarks: remarks.trim(),
      });

      const successes = response?.count ?? response?.payments?.length ?? 0;
      const failures = response?.errors ?? [];

      if (failures.length > 0) {
        toast.warning(
          `${successes} payment(s) recorded. ${failures.length} payment(s) failed. Check the outstanding balances.`,
        );
        console.warn("Bulk payroll errors:", failures);
      } else {
        toast.success(`${successes} salary payment(s) recorded successfully.`);
      }

      setSelectedWorkers({});
      await refreshAfterPayment();
    } catch (error) {
      console.error("BULK SALARY PAYMENT ERROR:", error);

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to process bulk payroll.",
      );

      await refreshAfterPayment();
    } finally {
      setBulkSaving(false);
    }
  };

  const eligibleWorkers = workers.filter(
    (worker) => worker.salarySet && outstandingValue(worker) > 0,
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Monthly Salary Payroll
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Set each worker's agreed salary for the selected month, then
              record full or partial payments.
            </p>
          </div>

          <button
            type="button"
            onClick={loadPayroll}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Payroll"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Salary Month
            </label>
            <input
              type="month"
              value={salaryPeriod}
              onChange={(event) => {
                setSalaryPeriod(event.target.value);
                setSelectedWorkers({});
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Remarks
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Optional note"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "Active Workers",
            value: workers.length.toLocaleString("en-NG"),
            color: "text-gray-900",
          },
          {
            label: "Agreed Salaries",
            value: money(totals.salary),
            color: "text-gray-900",
          },
          {
            label: "Total Paid",
            value: money(totals.paid),
            color: "text-green-700",
          },
          {
            label: "Outstanding Salary",
            value: money(totals.outstanding),
            color: "text-orange-700",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <p className="text-sm text-gray-500">{item.label}</p>
            <p className={`text-xl font-bold mt-2 ${item.color}`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Workers and Salary Balances
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Enter the salary in the Monthly Salary column and click Save
                Salary. You must save it before recording a payment.
              </p>
            </div>

            <button
              type="button"
              onClick={handleBulkPayment}
              disabled={bulkSaving || loading || selectedList.length === 0}
              className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {bulkSaving
                ? "Processing Payroll..."
                : `Pay Selected (${selectedList.length})`}
            </button>
          </div>

          {selectedList.length > 0 && (
            <p className="text-sm text-green-700 mt-3">
              Selected payment total:{" "}
              <strong>{money(selectedPaymentTotal)}</strong>
            </p>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-500">
            Loading workers and salary balances...
          </div>
        ) : workers.length === 0 ? (
          <div className="py-16 px-5 text-center">
            <p className="font-medium text-gray-700">
              No active workers found.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Check that your workers exist in the Worker database and have
              Active status.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-3 text-left">
                    <input
                      type="checkbox"
                      aria-label="Select workers with outstanding salaries"
                      checked={
                        eligibleWorkers.length > 0 &&
                        eligibleWorkers.every(
                          (worker) => selectedWorkers[workerId(worker)],
                        )
                      }
                      onChange={(event) =>
                        toggleAllWorkers(event.target.checked)
                      }
                    />
                  </th>
                  <th className="px-3 py-3 text-left">Worker</th>
                  <th className="px-3 py-3 text-left">Employee ID</th>
                  <th className="px-3 py-3 text-left">Monthly Salary</th>
                  <th className="px-3 py-3 text-right">Paid</th>
                  <th className="px-3 py-3 text-right">Outstanding</th>
                  <th className="px-3 py-3 text-right">Bulk Amount</th>
                  <th className="px-3 py-3 text-right">Individual Payment</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {workers.map((worker) => {
                  const id = workerId(worker);
                  const salary = amountValue(worker);
                  const paid = paidValue(worker);
                  const balance = outstandingValue(worker);
                  const selected = Boolean(selectedWorkers[id]);
                  const salaryBusy = savingSalaryWorkerId === id;
                  const paymentBusy = savingWorkerId === id;

                  return (
                    <tr
                      key={id || workerName(worker)}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${workerName(worker)}`}
                          checked={selected}
                          disabled={
                            !id ||
                            !worker.salarySet ||
                            balance <= 0 ||
                            bulkSaving
                          }
                          onChange={() => toggleWorker(id)}
                        />
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="font-medium text-gray-900">
                          {workerName(worker)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {worker.department || worker.role || "—"}
                        </p>
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap">
                        {worker.employeeId || worker.staffId || "—"}
                      </td>

                      <td className="px-3 py-3 min-w-[230px]">
                        <div className="flex flex-col gap-2">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={salaryAmounts[id] ?? ""}
                            onChange={(event) =>
                              updateSalaryAmount(id, event.target.value)
                            }
                            disabled={salaryBusy || bulkSaving}
                            placeholder="Enter agreed salary"
                            aria-label={`Agreed monthly salary for ${workerName(worker)}`}
                            className="w-48 rounded-lg border border-gray-300 bg-white px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                          />

                          <button
                            type="button"
                            onClick={() => handleSaveSalary(worker)}
                            disabled={salaryBusy || bulkSaving}
                            className="w-fit px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
                          >
                            {salaryBusy
                              ? "Saving..."
                              : worker.salarySet
                                ? "Update Salary"
                                : "Save Salary"}
                          </button>

                          <span
                            className={`text-xs ${
                              worker.salarySet
                                ? "text-green-700"
                                : "text-orange-700"
                            }`}
                          >
                            {worker.salarySet
                              ? `Saved for ${salaryPeriod}`
                              : "Salary not set for this month"}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-right text-green-700 whitespace-nowrap">
                        {money(paid)}
                      </td>

                      <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                        <span
                          className={
                            balance > 0 ? "text-orange-700" : "text-green-700"
                          }
                        >
                          {money(balance)}
                        </span>
                      </td>

                      <td className="px-3 py-3 min-w-[145px]">
                        <input
                          type="number"
                          min="0.01"
                          max={balance}
                          step="0.01"
                          value={paymentAmounts[id] ?? ""}
                          disabled={
                            !worker.salarySet || balance <= 0 || bulkSaving
                          }
                          onChange={(event) =>
                            updateBulkAmount(id, event.target.value)
                          }
                          className="w-36 rounded-lg border border-gray-300 px-2 py-2 text-right disabled:bg-gray-100"
                          aria-label={`Bulk payment amount for ${workerName(worker)}`}
                        />
                      </td>

                      <td className="px-3 py-3 min-w-[145px]">
                        <input
                          type="number"
                          min="0.01"
                          max={balance}
                          step="0.01"
                          value={individualAmounts[id] ?? ""}
                          disabled={
                            !worker.salarySet || balance <= 0 || paymentBusy
                          }
                          onChange={(event) =>
                            updateIndividualAmount(id, event.target.value)
                          }
                          className="w-36 rounded-lg border border-gray-300 px-2 py-2 text-right disabled:bg-gray-100"
                          aria-label={`Individual payment amount for ${workerName(worker)}`}
                        />
                      </td>

                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleIndividualPayment(worker)}
                          disabled={
                            !worker.salarySet ||
                            balance <= 0 ||
                            paymentBusy ||
                            bulkSaving
                          }
                          className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {paymentBusy ? "Saving..." : "Pay"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
          Agreed salary is saved separately for each worker and month. Only
          actual payments count as expenses. Deleted payments are excluded from
          paid totals.
        </div>
      </div>
    </div>
  );
}
