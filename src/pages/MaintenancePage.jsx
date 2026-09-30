import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownUp, ClipboardList, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { api, getErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import PermissionGuard from "../auth/PermissionGuard";
import { hasPermission, permission } from "../auth/permissions";
import ResourceForm from "../components/ResourceForm";
import { maintenanceAssignFields, maintenanceCreateFields, maintenanceResolveFields } from "../config/maintenance";

const statuses = ["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED", "CANCELLED"];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusStyle(status) {
  if (status === "IN_PROGRESS") return "bg-blue-50 text-blue-700";
  if (status === "RESOLVED" || status === "CLOSED") return "bg-emerald-50 text-emerald-700";
  if (status === "CANCELLED") return "bg-slate-100 text-slate-500";
  if (status === "ON_HOLD") return "bg-amber-50 text-amber-800";
  return "bg-brand-50 text-brand-700";
}

function TicketDetails({ ticket, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="ticket-heading" className="panel-card max-h-[90vh] w-full max-w-xl overflow-auto p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div><p className="eyebrow">Ticket #{ticket.ticket_id}</p><h2 id="ticket-heading" className="mt-2 font-display text-xl font-extrabold">{ticket.complaint_category}</h2></div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-slate-50" aria-label="Close details"><X size={18} /></button>
        </div>
        <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-600">{ticket.description}</p>
        <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-slate-100 pt-5">
          <Detail label="Status"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyle(ticket.status)}`}>{ticket.status}</span></Detail>
          <Detail label="Priority">{ticket.priority}</Detail>
          <Detail label="Tenant ID">{ticket.tenant_id}</Detail>
          <Detail label="Apartment ID">{ticket.apartment_id}</Detail>
          <Detail label="Assigned technician">{ticket.assigned_technician_id ?? "Not assigned"}</Detail>
          <Detail label="Created">{formatDate(ticket.created_timestamp)}</Detail>
          {ticket.resolution_timestamp && <Detail label="Resolved">{formatDate(ticket.resolution_timestamp)}</Detail>}
          {ticket.resolution_note && <div className="col-span-2"><Detail label="Resolution note">{ticket.resolution_note}</Detail></div>}
        </dl>
      </section>
    </div>
  );
}

function Detail({ label, children }) {
  return <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</dt><dd className="mt-1.5 text-xs font-semibold text-ink">{children}</dd></div>;
}

export default function MaintenancePage() {
  const { role } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [workingId, setWorkingId] = useState(null);
  const [actionForm, setActionForm] = useState(null);
  const canStart = hasPermission(role?.role_name, permission.maintenanceStart);

  const loadTickets = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const { data } = await api.get("/maintenance-tickets");
      if (!Array.isArray(data)) throw new Error("The maintenance API returned an unexpected response.");
      setTickets(data);
      setState("ready");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not load maintenance tickets."));
      setState("error");
    }
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const visibleTickets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesStatus = filter === "ALL" || ticket.status === filter;
      const matchesQuery = !needle || [
        ticket.ticket_id,
        ticket.complaint_category,
        ticket.description,
        ticket.priority,
        ticket.status,
      ].some((value) => String(value ?? "").toLowerCase().includes(needle));
      return matchesStatus && matchesQuery;
    });
  }, [tickets, filter, query]);

  async function startTicket(ticket) {
    setWorkingId(ticket.ticket_id);
    try {
      const { data } = await api.patch(`/maintenance-tickets/${ticket.ticket_id}/start`);
      setTickets((current) => current.map((item) => item.ticket_id === ticket.ticket_id ? data : item));
      setSelected((current) => current?.ticket_id === ticket.ticket_id ? data : current);
      toast.success(`Ticket #${ticket.ticket_id} started.`);
    } catch (requestError) {
      toast.error(getErrorMessage(requestError, "Could not start this ticket."));
    } finally {
      setWorkingId(null);
    }
  }

  async function runTicketAction(action, ticket, values = {}) {
    setWorkingId(ticket?.ticket_id ?? "new");
    try {
      let response;
      if (action === "create") {
        response = await api.post("/maintenance-tickets", values);
        setTickets((current) => [response.data, ...current]);
        toast.success("Maintenance ticket created.");
      } else {
        const paths = {
          assign: `/maintenance-tickets/${ticket.ticket_id}/assign`,
          resolve: `/maintenance-tickets/${ticket.ticket_id}/resolve`,
          close: `/maintenance-tickets/${ticket.ticket_id}/close`,
        };
        response = action === "close"
          ? await api.patch(paths[action])
          : await api.patch(paths[action], values);
        setTickets((current) => current.map((item) => item.ticket_id === ticket.ticket_id ? response.data : item));
        setSelected((current) => current?.ticket_id === ticket.ticket_id ? response.data : current);
        toast.success(`Ticket #${ticket.ticket_id} ${action === "assign" ? "assigned" : action === "resolve" ? "resolved" : "closed"}.`);
      }
      setActionForm(null);
    } catch (requestError) {
      toast.error(getErrorMessage(requestError, `Could not ${action} the maintenance ticket.`));
    } finally {
      setWorkingId(null);
    }
  }

  function submitTicketAction(values) {
    return runTicketAction(actionForm.action, actionForm.ticket, values);
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Operations</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Maintenance tickets</h1><p className="mt-2 text-sm text-muted">Review ticket status and assigned maintenance work.</p></div>
        <div className="flex items-center gap-3">
          <PermissionGuard permission={permission.maintenanceCreate}><button onClick={() => setActionForm({ action: "create", ticket: null, fields: maintenanceCreateFields })} className="button-primary"><ClipboardList size={15} /> New ticket</button></PermissionGuard>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[11px] font-semibold text-muted shadow-panel"><Activity size={14} className="text-brand-600" /> {state === "ready" ? `${tickets.length} tickets` : "Ticket queue"}</div>
        </div>
      </div>
      <div className="panel-card mt-7 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Filter tickets</span>
              <ArrowDownUp size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-9 appearance-none rounded-lg border border-slate-100 bg-white pl-9 pr-8 text-[11px] font-semibold outline-none focus:border-brand-500">
                <option value="ALL">All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>
          <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-slate-100 px-3 text-muted sm:w-64"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tickets..." className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400" /></label>
        </div>
        {state === "error" && <div className="flex flex-col items-start gap-3 p-6 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"><span>{error}</span><button onClick={loadTickets} className="button-secondary">Try again</button></div>}
        {state === "loading" && <div className="space-y-3 p-5">{[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-slate-50" />)}</div>}
        {state === "ready" && (
          <>
            <div className="hidden grid-cols-[.55fr_1fr_1.6fr_.8fr_.85fr_1fr] gap-4 bg-slate-50/70 px-5 py-3 text-[9px] font-extrabold uppercase tracking-[.12em] text-slate-400 lg:grid"><span>ID</span><span>Category</span><span>Description</span><span>Priority</span><span>Status</span><span className="text-right">Actions</span></div>
            {visibleTickets.map((ticket) => (
              <article key={ticket.ticket_id} className="grid gap-3 border-t border-slate-50 px-4 py-4 first:border-0 sm:px-5 lg:grid-cols-[.55fr_1fr_1.6fr_.8fr_.85fr_1fr] lg:items-center lg:gap-4">
                <span className="text-[11px] font-bold text-slate-400">#{ticket.ticket_id}</span>
                <span className="text-xs font-bold">{ticket.complaint_category}</span>
                <p className="line-clamp-2 text-xs leading-5 text-muted">{ticket.description}</p>
                <span className="w-fit rounded-md bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">{ticket.priority}</span>
                <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyle(ticket.status)}`}>{ticket.status}</span>
                <div className="flex items-center justify-start gap-2 lg:justify-end">
                  <button onClick={() => setSelected(ticket)} className="button-secondary !px-3 !py-2">Details</button>
                  <PermissionGuard permission={permission.maintenanceAssign}>
                    <button onClick={() => setActionForm({ action: "assign", ticket, fields: maintenanceAssignFields })} className="button-secondary !px-3 !py-2">Assign</button>
                  </PermissionGuard>
                  {canStart && ticket.status === "ASSIGNED" && ticket.assigned_technician_id != null && (
                    <button disabled={workingId === ticket.ticket_id} onClick={() => startTicket(ticket)} className="button-primary !px-3 !py-2">{workingId === ticket.ticket_id ? "Starting..." : "Start"}</button>
                  )}
                  {ticket.status === "IN_PROGRESS" && ticket.assigned_technician_id != null && <PermissionGuard permission={permission.maintenanceResolve}><button onClick={() => setActionForm({ action: "resolve", ticket, fields: maintenanceResolveFields })} className="button-secondary !px-3 !py-2">Resolve</button></PermissionGuard>}
                  {ticket.status === "RESOLVED" && <PermissionGuard permission={permission.maintenanceClose}><button disabled={workingId === ticket.ticket_id} onClick={() => runTicketAction("close", ticket)} className="button-secondary !px-3 !py-2">Close</button></PermissionGuard>}
                </div>
              </article>
            ))}
            {visibleTickets.length === 0 && <div className="p-10 text-center"><div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-slate-400"><ClipboardList size={18} /></div><p className="mt-3 text-sm font-semibold">No tickets found</p><p className="mt-1 text-xs text-muted">{tickets.length ? "Try another status or search." : "There are no maintenance tickets yet."}</p></div>}
          </>
        )}
      </div>
      <p className="mt-4 text-[10px] leading-5 text-slate-400">The API returns an unfiltered ticket list and does not link a technician account to an assigned technician record. Starting work is limited to assigned tickets and the backend validates ticket state and technician role.</p>
      {selected && <TicketDetails ticket={selected} onClose={() => setSelected(null)} />}
      {actionForm && <ResourceForm title={actionForm.action === "create" ? "Create maintenance ticket" : `${actionForm.action[0].toUpperCase()}${actionForm.action.slice(1)} ticket #${actionForm.ticket.ticket_id}`} fields={actionForm.fields} submitting={workingId === (actionForm.ticket?.ticket_id ?? "new")} onCancel={() => setActionForm(null)} onSubmit={submitTicketAction} />}
    </section>
  );
}
