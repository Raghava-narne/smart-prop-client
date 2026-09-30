import { useEffect, useState } from "react";
import { Activity, ArrowRight, ClipboardList, Clock3, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client";

function getTickets(payload) {
  if (!Array.isArray(payload)) throw new Error("The maintenance API returned an unexpected response.");
  return payload;
}

export default function TechnicianDashboard({ user }) {
  const [tickets, setTickets] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/maintenance-tickets")
      .then(({ data }) => {
        setTickets(getTickets(data));
        setStatus("ready");
      })
      .catch((requestError) => {
        setError(getErrorMessage(requestError, "Could not load maintenance tickets."));
        setStatus("error");
      });
  }, []);

  const openCount = tickets.filter((ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status)).length;
  const activeCount = tickets.filter((ticket) => ticket.status === "IN_PROGRESS").length;
  const resolvedCount = tickets.filter((ticket) => ["RESOLVED", "CLOSED"].includes(ticket.status)).length;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Technician workspace</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Good to see you, {user?.full_name?.split(" ")[0]}.</h1><p className="mt-2 text-sm text-muted">Your maintenance queue, at a glance.</p></div>
        <Link to="/maintenance" className="button-primary">View tickets <ArrowRight size={16} /></Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Open tickets", value: status === "ready" ? openCount : "—", icon: ClipboardList, tint: "bg-brand-50 text-brand-700" },
          { label: "In progress", value: status === "ready" ? activeCount : "—", icon: Activity, tint: "bg-blue-50 text-blue-700" },
          { label: "Resolved", value: status === "ready" ? resolvedCount : "—", icon: Wrench, tint: "bg-violet-50 text-violet-700" },
        ].map(({ label, value, icon: Icon, tint }) => (
          <div className="panel-card p-5" key={label}><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted">{label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${tint}`}><Icon size={18} /></span></div><p className="mt-5 font-display text-3xl font-extrabold">{status === "loading" ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-slate-100" /> : value}</p><p className="mt-1 text-[11px] text-muted">From the current maintenance queue</p></div>
        ))}
      </div>

      <div className="mt-7 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="panel-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-bold">Recent tickets</h2><p className="mt-1 text-[11px] text-muted">Latest maintenance requests</p></div><Link to="/maintenance" className="text-xs font-bold text-brand-600 hover:text-brand-700">View all</Link></div>
          {status === "error" ? <div className="p-6 text-sm text-rose-600">{error}</div> : null}
          {status === "loading" ? <div className="space-y-3 p-5"><div className="h-11 animate-pulse rounded-lg bg-slate-50" /><div className="h-11 animate-pulse rounded-lg bg-slate-50" /></div> : null}
          {status === "ready" && tickets.length === 0 ? <div className="p-8 text-center"><div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-slate-400"><ClipboardList size={18} /></div><p className="mt-3 text-sm font-semibold">You're all caught up</p><p className="mt-1 text-xs text-muted">No maintenance tickets are available.</p></div> : null}
          {status === "ready" && tickets.slice(0, 4).map((ticket) => (
            <div key={ticket.ticket_id} className="flex items-center justify-between gap-4 border-b border-slate-50 px-5 py-4 last:border-0">
              <div className="min-w-0"><p className="truncate text-xs font-bold">{ticket.complaint_category || "Maintenance request"}</p><p className="mt-1 truncate text-[11px] text-muted">{ticket.description}</p></div>
              <span className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">{ticket.status}</span>
            </div>
          ))}
        </div>
        <div className="panel-card p-5">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><Clock3 size={19} /></span><div><h2 className="text-sm font-bold">Your next step</h2><p className="mt-1 text-[11px] text-muted">Keep tickets moving</p></div></div>
          <p className="mt-5 text-sm leading-6 text-slate-600">Open a ticket to review its details and start work when you're ready.</p>
          <Link to="/maintenance" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-brand-600">Go to maintenance <ArrowRight size={14} /></Link>
        </div>
      </div>
    </section>
  );
}
