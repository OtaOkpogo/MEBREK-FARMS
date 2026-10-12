import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { requestOlderSaleAccess, fetchSaleAccessRequests, reviewSaleAccessRequest } from "../services/eggSalesService";
import * as manureService from "../services/manureSalesService";

export default function SaleAccessPanel({ saleType = "egg", isSuperadmin = false, canRequest = false, onAccessChanged }) {
  const service = saleType === "manure" ? manureService : null;
  const requestAccess = service?.requestOlderSaleAccess || requestOlderSaleAccess;
  const getRequests = service?.fetchSaleAccessRequests || fetchSaleAccessRequests;
  const reviewRequest = service?.reviewSaleAccessRequest || reviewSaleAccessRequest;
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [reason, setReason] = useState("");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const loadRequests = useCallback(async () => {
    setLoading(true);
    try { const data = await getRequests(); setRequests(Array.isArray(data) ? data : Array.isArray(data?.requests) ? data.requests : []); }
    catch (err) { toast.error(err?.response?.data?.message || "Unable to load older-sale access requests."); }
    finally { setLoading(false); }
  }, [getRequests]);
  useEffect(() => { loadRequests(); }, [loadRequests]);
  const submit = async (e) => {
    e.preventDefault();
    if (!invoiceNumber.trim() || !reason.trim()) return toast.error("Enter an invoice number and a reason.");
    try { const result = await requestAccess({ invoiceNumber, reason }); toast.success(result?.message || "Access request submitted."); setInvoiceNumber(""); setReason(""); loadRequests(); }
    catch (err) { toast.error(err?.response?.data?.message || "Unable to submit access request."); }
  };
  const review = async (item, decision) => {
    const reviewNote = window.prompt(`${decision === "approved" ? "Approval" : "Rejection"} note (optional):`, "");
    if (reviewNote === null) return;
    setBusyId(item._id);
    try { const result = await reviewRequest(item._id, { decision, reviewNote }); toast.success(result?.message || "Request reviewed."); await loadRequests(); if (decision === "approved" && onAccessChanged) await onAccessChanged(); }
    catch (err) { toast.error(err?.response?.data?.message || "Unable to review request."); }
    finally { setBusyId(""); }
  };
  const title = saleType === "manure" ? "Manure sales" : "Egg sales";
  return <section className="mb-6 rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold text-gray-800">Older {title} access</h2><p className="mt-1 text-sm text-gray-500">Managers can request access to one older invoice. Approval lasts 2 hours and does not allow deletion.</p></div><button type="button" onClick={loadRequests} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">Refresh requests</button></div>
    {!isSuperadmin && canRequest && <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr_auto]">
      <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Invoice number" className="rounded border px-3 py-2" required />
      <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for access" className="rounded border px-3 py-2" maxLength={1000} required />
      <button type="submit" className="rounded bg-amber-700 px-4 py-2 font-medium text-white hover:bg-amber-800">Request access</button>
    </form>}
    <div className="mt-4 overflow-x-auto">
      {loading ? <p className="py-3 text-sm text-gray-500">Loading requests…</p> : requests.length === 0 ? <p className="py-3 text-sm text-gray-500">No access requests for this section yet.</p> : <table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-2 pr-3">Invoice</th><th className="py-2 pr-3">Requested by</th><th className="py-2 pr-3">Reason</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Access expiry</th>{isSuperadmin && <th className="py-2">Review</th>}</tr></thead><tbody>{requests.map(item => <tr key={item._id} className="border-b last:border-0"><td className="py-3 pr-3 font-medium">{item.invoiceNumber}</td><td className="py-3 pr-3">{item.requesterName || item.requesterId?.name || "Manager"}</td><td className="py-3 pr-3 whitespace-normal">{item.reason}</td><td className="py-3 pr-3"><span className={`rounded-full px-2 py-1 text-xs ${item.status === "approved" ? "bg-green-100 text-green-800" : item.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{item.status}</span></td><td className="py-3 pr-3">{item.accessExpiresAt && new Date(item.accessExpiresAt) > new Date() ? new Date(item.accessExpiresAt).toLocaleString() : "—"}</td>{isSuperadmin && <td className="py-3"><div className="flex gap-2">{item.status === "pending" ? <><button disabled={busyId === item._id} onClick={() => review(item, "approved")} className="rounded bg-green-700 px-2 py-1 text-white disabled:opacity-50">Approve</button><button disabled={busyId === item._id} onClick={() => review(item, "rejected")} className="rounded bg-red-700 px-2 py-1 text-white disabled:opacity-50">Reject</button></> : <span className="text-gray-400">Reviewed</span>}</div></td>}</tr>)}</tbody></table>}
    </div>
  </section>;
}


