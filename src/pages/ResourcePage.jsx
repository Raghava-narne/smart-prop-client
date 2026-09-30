import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleAlert, Plus, Search } from "lucide-react";
import toast from "react-hot-toast";
import PermissionGuard from "../auth/PermissionGuard";
import { modulePermission } from "../auth/permissions";
import { api, getErrorMessage } from "../api/client";
import { resources } from "../config/resources";
import ResourceForm from "../components/ResourceForm";

function displayValue(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function RecordPanel({ record, columns }) {
  return (
    <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
      {columns.map((key) => (
        <div className="min-w-0" key={key}>
          <dt className="text-[9px] font-extrabold uppercase tracking-[.12em] text-slate-400">{key.replaceAll("_", " ")}</dt>
          <dd className="mt-1 break-words text-xs font-semibold text-ink">{displayValue(record[key])}</dd>
        </div>
      ))}
    </dl>
  );
}

function loadRazorpaySdk() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => window.Razorpay ? resolve() : reject(new Error("Razorpay Checkout did not initialize."));
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
    document.body.appendChild(script);
  });
}

export default function ResourcePage({ resourceKey }) {
  const config = resources[resourceKey];
  const [records, setRecords] = useState([]);
  const [state, setState] = useState(config.listEndpoint ? "loading" : "ready");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [workingKey, setWorkingKey] = useState("");
  const [selected, setSelected] = useState(null);
  const [lookupId, setLookupId] = useState("");
  const [pendingOrder, setPendingOrder] = useState(null);
  const [relatedResult, setRelatedResult] = useState(null);
  const [relatedLoaded, setRelatedLoaded] = useState(false);
  const [relatedLabel, setRelatedLabel] = useState("");
  const [relatedError, setRelatedError] = useState("");
  const [relatedLoading, setRelatedLoading] = useState(false);

  const loadRecords = useCallback(async () => {
    if (!config.listEndpoint) {
      setState("ready");
      return;
    }
    setState("loading");
    setError("");
    try {
      const { data } = await api.get(config.listEndpoint);
      if (!Array.isArray(data)) throw new Error("The API returned an unexpected list response.");
      setRecords(data);
      setState("ready");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not load this module."));
      setState("error");
    }
  }, [config]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const filteredRecords = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((record) => config.columns.some((key) => displayValue(record[key]).toLowerCase().includes(needle)));
  }, [records, query, config.columns]);

  async function saveRecord(values) {
    setSubmitting(true);
    try {
      if (form.record) {
        const endpoint = config.updateEndpoint(form.record);
        const { data } = await api.patch(endpoint, values);
        setRecords((current) => current.map((item) => item[config.idField] === form.record[config.idField] ? data : item));
        setSelected(data);
        toast.success(`${config.title} record updated.`);
      } else {
        const endpoint = typeof config.createEndpoint === "function" ? config.createEndpoint(values) : config.createEndpoint;
        const { data } = await api.post(endpoint, values);
        if (config.listEndpoint) setRecords((current) => [...current, data]);
        setSelected(data);
        toast.success(`${config.title} record created.`);
      }
      setForm(null);
    } catch (requestError) {
      toast.error(getErrorMessage(requestError, "Could not save this record."));
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(action, record) {
    if (action.confirm && !window.confirm(action.confirm)) return;
    const id = record[config.idField];
    const actionKey = `${action.label}:${id}`;
    setWorkingKey(actionKey);
    try {
      const endpoint = action.endpoint(record);
      const { data } = await api[action.method](endpoint);
      if (data && typeof data === "object") {
        setRecords((current) => current.map((item) => item[config.idField] === id ? data : item));
        setSelected((current) => current?.[config.idField] === id ? data : current);
      } else {
        await loadRecords();
      }
      toast.success(`${action.label} complete.`);
    } catch (requestError) {
      toast.error(getErrorMessage(requestError, `Could not ${action.label.toLowerCase()} this record.`));
    } finally {
      setWorkingKey("");
    }
  }

  async function deleteRecord(record) {
    if (!window.confirm("Delete this property? This action cannot be undone.")) return;
    setWorkingKey(`delete:${record[config.idField]}`);
    try {
      await api.delete(config.deleteEndpoint(record));
      setRecords((current) => current.filter((item) => item[config.idField] !== record[config.idField]));
      setSelected(null);
      toast.success("Property deleted.");
    } catch (requestError) {
      toast.error(getErrorMessage(requestError, "Could not delete this property."));
    } finally {
      setWorkingKey("");
    }
  }

  async function lookupRecord(event) {
    event.preventDefault();
    if (!lookupId.trim()) return;
    try {
      const { data } = await api.get(config.lookupEndpoint(lookupId.trim()));
      setSelected(data);
      setError("");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not find that record."));
      setSelected(null);
    }
  }

  async function loadRelated(lookup, record) {
    setRelatedLabel(lookup.label);
    setRelatedResult(null);
    setRelatedLoaded(false);
    setRelatedError("");
    setRelatedLoading(true);
    try {
      const { data } = await api.get(lookup.endpoint(record));
      setRelatedResult(data);
      setRelatedLoaded(true);
    } catch (requestError) {
      setRelatedError(getErrorMessage(requestError, `Could not load ${lookup.label.toLowerCase()}.`));
    } finally {
      setRelatedLoading(false);
    }
  }

  async function createRazorpayOrder(values) {
    setSubmitting(true);
    try {
      await loadRazorpaySdk();
      const { data: order } = await api.post("/payments/razorpay/orders", values);
      setPendingOrder(order);
      setForm(null);
      const checkout = new window.Razorpay({
        key: order.razorpay_key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Smart-Prop",
        order_id: order.razorpay_order_id,
        handler: async (payment) => {
          try {
            const { data } = await api.post("/payments/razorpay/verify", {
              razorpay_order_id: payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature,
            });
            setSelected(data);
            setPendingOrder(null);
            toast.success("Payment verified.");
          } catch (requestError) {
            toast.error(getErrorMessage(requestError, "The payment could not be verified."));
          }
        },
      });
      checkout.on("payment.failed", (event) => {
        const message = event.error?.description || "Razorpay could not complete the payment.";
        toast.error(message);
      });
      checkout.open();
    } catch (requestError) {
      toast.error(getErrorMessage(requestError, "Could not start Razorpay checkout."));
    } finally {
      setSubmitting(false);
    }
  }

  if (!config) return <div className="panel-card p-6">This module is not available.</div>;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Workspace module</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">{config.title}</h1><p className="mt-2 text-sm text-muted">{config.description}</p></div>
        <div className="flex flex-wrap gap-2">
          {config.razorpayFields && <PermissionGuard permission={modulePermission(resourceKey, "create")}><button className="button-secondary" onClick={() => setForm({ record: null, fields: config.razorpayFields, razorpay: true })}>Razorpay checkout</button></PermissionGuard>}
          {config.createEndpoint && config.createFields && <PermissionGuard permission={modulePermission(resourceKey, "create")}><button className="button-primary" onClick={() => setForm({ record: null, fields: config.createFields })}><Plus size={16} /> Create record</button></PermissionGuard>}
        </div>
      </div>

      {pendingOrder && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/70 p-4 text-xs"><span>Payment #{pendingOrder.payment_id} · Razorpay order {pendingOrder.razorpay_order_id}</span><button className="button-secondary !py-2" onClick={() => setLookupId(String(pendingOrder.payment_id))}>Look up payment</button></div>}
      {config.lookupEndpoint && (
        <form onSubmit={lookupRecord} className="panel-card mt-7 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <label className="field-label flex-1">Payment ID<span className="field-wrap"><Search size={16} /><input value={lookupId} onChange={(event) => setLookupId(event.target.value)} required placeholder="Enter a payment ID" /></span></label>
          <button className="button-secondary self-end">Look up payment</button>
        </form>
      )}

      {config.listEndpoint && (
        <div className="panel-card mt-7 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:px-5">
            <div><h2 className="text-sm font-bold">All {config.title.toLowerCase()}</h2><p className="mt-1 text-[10px] text-muted">{state === "ready" ? `${records.length} records` : "API results"}</p></div>
            <label className="flex h-9 w-full max-w-64 items-center gap-2 rounded-lg border border-slate-100 px-3 text-muted"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400" /></label>
          </div>
          {state === "error" && <div className="flex flex-col gap-3 p-6 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"><span>{error}</span><button onClick={loadRecords} className="button-secondary">Try again</button></div>}
          {state === "loading" && <div className="space-y-3 p-5">{[0, 1, 2].map((row) => <div key={row} className="h-11 animate-pulse rounded-lg bg-slate-50" />)}</div>}
          {state === "ready" && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left">
                <thead><tr className="bg-slate-50/70 text-[9px] font-extrabold uppercase tracking-[.12em] text-slate-400">{config.columns.map((key) => <th key={key} className="px-4 py-3 first:pl-5">{key.replaceAll("_", " ")}</th>)}<th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody>{filteredRecords.map((record, index) => (
                  <tr key={record[config.idField] ?? `${resourceKey}-${index}`} className="border-t border-slate-50 text-xs hover:bg-slate-50/50">
                    {config.columns.map((key) => <td key={key} className="max-w-[240px] truncate px-4 py-3.5 first:pl-5" title={displayValue(record[key])}>{displayValue(record[key])}</td>)}
                    <td className="px-4 py-3.5"><div className="flex justify-end gap-2">
                      <button onClick={() => { setSelected(record); setRelatedResult(null); setRelatedLoaded(false); setRelatedError(""); }} className="button-secondary !px-3 !py-2">Details</button>
                      {config.updateEndpoint && config.updateFields && <PermissionGuard permission={modulePermission(resourceKey, "update")}><button onClick={() => setForm({ record, fields: config.updateFields })} className="button-secondary !px-3 !py-2">Edit</button></PermissionGuard>}
                      {config.actions?.map((action) => action.when(record) && <PermissionGuard key={action.label} permission={modulePermission(resourceKey, action.permission)}><button disabled={workingKey === `${action.label}:${record[config.idField]}`} onClick={() => runAction(action, record)} className="button-secondary !px-3 !py-2">{workingKey === `${action.label}:${record[config.idField]}` ? "Working..." : action.label}</button></PermissionGuard>)}
                      {config.deleteEndpoint && <PermissionGuard permission={modulePermission(resourceKey, "delete")}><button disabled={workingKey === `delete:${record[config.idField]}`} onClick={() => deleteRecord(record)} className="button-secondary !px-3 !py-2 !text-rose-600">{workingKey === `delete:${record[config.idField]}` ? "Deleting..." : "Delete"}</button></PermissionGuard>}
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
              {filteredRecords.length === 0 && <div className="p-10 text-center"><CircleAlert size={18} className="mx-auto text-slate-400" /><p className="mt-3 text-sm font-semibold">No records found</p><p className="mt-1 text-xs text-muted">{records.length ? "Try another search." : "The API returned no records."}</p></div>}
            </div>
          )}
        </div>
      )}

      {!config.listEndpoint && !config.lookupEndpoint && <div className="panel-card mt-7 p-8 text-sm text-muted">This API does not expose a collection endpoint for this resource.</div>}
      {!config.listEndpoint && config.lookupEndpoint && selected && <div className="panel-card mt-5 p-5"><h2 className="mb-5 text-sm font-bold">Payment details</h2><RecordPanel record={selected} columns={config.columns} /></div>}
      {error && !config.listEndpoint && <p className="mt-3 text-xs text-rose-600">{error}</p>}
      {config.listEndpoint && state === "ready" && <p className="mt-3 text-[10px] leading-5 text-slate-400">List results use the API response as returned; available actions are limited to documented endpoints and configured UI permissions.</p>}

      {selected && config.listEndpoint && <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><section role="dialog" aria-modal="true" className="panel-card max-h-[90vh] w-full max-w-2xl overflow-auto p-6 sm:p-8"><div className="mb-6 flex items-start justify-between"><div><p className="eyebrow">Record details</p><h2 className="mt-2 font-display text-xl font-extrabold">{config.title} · {displayValue(selected[config.idField])}</h2></div><button onClick={() => setSelected(null)} className="button-secondary">Close</button></div><RecordPanel record={selected} columns={config.columns} />{config.relatedLookups && <div className="mt-6 border-t border-slate-100 pt-5"><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-400">Related API records</p><div className="mt-3 flex flex-wrap gap-2">{config.relatedLookups.map((lookup) => <button key={lookup.label} onClick={() => loadRelated(lookup, selected)} className="button-secondary">{lookup.label}</button>)}</div>{relatedLoading && <p className="mt-4 text-xs text-muted">Loading {relatedLabel.toLowerCase()}...</p>}{relatedError && <p role="alert" className="mt-4 text-xs text-rose-600">{relatedError}</p>}{relatedLoaded && <pre className="mt-4 max-h-64 overflow-auto rounded-xl bg-slate-50 p-4 text-[11px] leading-5 text-slate-600">{JSON.stringify(relatedResult, null, 2) ?? String(relatedResult)}</pre>}</div>}</section></div>}
      {form && <ResourceForm title={form.razorpay ? "Create Razorpay order" : `${form.record ? "Edit" : "Create"} ${config.title.toLowerCase()}`} fields={form.fields} initial={form.record ?? {}} submitting={submitting} onCancel={() => setForm(null)} onSubmit={form.razorpay ? createRazorpayOrder : saveRecord} />}
    </section>
  );
}
