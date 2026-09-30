import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Banknote, Building2, CircleAlert, ClipboardList, CreditCard, Plus, Wrench } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { api, getErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import ResourceForm from "../components/ResourceForm";

const razorpayScriptUrl = "https://checkout.razorpay.com/v1/checkout.js";

const maintenanceFields = [
  {
    name: "apartment_id",
    label: "Apartment",
    type: "select",
    valueType: "number",
    required: true,
  },
  {
    name: "complaint_category",
    label: "Category",
    type: "select",
    required: true,
    options: ["PLUMBING", "ELECTRICAL", "CARPENTRY", "CLEANING", "APPLIANCE", "STRUCTURAL", "OTHER"]
      .map((value) => ({ value, label: value })),
  },
  {
    name: "description",
    label: "Describe the issue",
    type: "text",
    required: true,
    minLength: 5,
    maxLength: 1000,
  },
  {
    name: "priority",
    label: "Priority",
    type: "select",
    required: true,
    defaultValue: "MEDIUM",
    options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
      .map((value) => ({ value, label: value })),
  },
];

const closedTicketStatuses = new Set(["RESOLVED", "CLOSED", "CANCELLED"]);

function money(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function prettyStatus(value) {
  return value?.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Unknown";
}

function StatusPill({ status }) {
  const style = closedTicketStatuses.has(status)
    ? "bg-emerald-50 text-emerald-700"
    : status === "IN_PROGRESS"
      ? "bg-blue-50 text-blue-700"
      : status === "OVERDUE" || status === "HIGH" || status === "CRITICAL"
        ? "bg-amber-50 text-amber-800"
        : "bg-brand-50 text-brand-700";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${style}`}>{prettyStatus(status)}</span>;
}

export default function TenantDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const view = location.pathname.split("/").at(-1) || "dashboard";
  const [tenant, setTenant] = useState(null);
  const [rent, setRent] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [apartments, setApartments] = useState([]);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payingRentId, setPayingRentId] = useState(null);
  const [paymentError, setPaymentError] = useState("");
  const [paymentFeedback, setPaymentFeedback] = useState("");

  const loadDashboard = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const { data: tenants } = await api.get("/tenants");
      if (!Array.isArray(tenants)) throw new Error("The tenants API returned an unexpected response.");

      const accountEmail = user?.email?.trim().toLowerCase();
      const matchingTenant = accountEmail
        ? tenants.find((record) => record.email?.trim().toLowerCase() === accountEmail)
        : null;

      if (!matchingTenant) {
        setTenant(null);
        setRent([]);
        setTickets([]);
        setApartments([]);
        setState("unlinked");
        return;
      }

      const [rentResult, ticketResult, agreementResult] = await Promise.allSettled([
        api.get(`/tenants/${matchingTenant.tenant_id}/rent`),
        api.get(`/tenants/${matchingTenant.tenant_id}/maintenance-tickets`),
        api.get("/rental-agreements"),
      ]);

      if (rentResult.status === "rejected") throw rentResult.reason;
      if (ticketResult.status === "rejected") throw ticketResult.reason;
      if (!Array.isArray(rentResult.value.data) || !Array.isArray(ticketResult.value.data)) {
        throw new Error("The tenant API returned an unexpected response.");
      }

      const agreements = agreementResult.status === "fulfilled" ? agreementResult.value.data : [];
      const activeApartments = Array.isArray(agreements)
        ? [...new Map(
          agreements
            .filter((agreement) => agreement.tenant_id === matchingTenant.tenant_id && agreement.status === "ACTIVE")
            .map((agreement) => [agreement.apartment_id, {
              value: agreement.apartment_id,
              label: `Apartment ${agreement.apartment_id}`,
            }]),
        ).values()]
        : [];

      setTenant(matchingTenant);
      setRent(rentResult.value.data);
      setTickets(ticketResult.value.data);
      setApartments(activeApartments);
      setState("ready");
      if (agreementResult.status === "rejected") {
        setError("Rental agreements could not be loaded, so maintenance requests may be unavailable.");
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not load your tenant dashboard."));
      setState("error");
    }
  }, [user?.email]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const outstandingBalance = useMemo(
    () => rent.reduce(
      (total, item) => total + Math.max(0, Number(item.amount_due) - Number(item.amount_paid)),
      0,
    ),
    [rent],
  );
  const openTickets = tickets.filter((ticket) => !closedTicketStatuses.has(ticket.status));

  async function payRent(obligation) {
    setPayingRentId(obligation.rent_id);
    setPaymentError("");
    setPaymentFeedback("");
    try {
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const existingScript = document.querySelector(`script[src="${razorpayScriptUrl}"]`);
          if (existingScript) {
            existingScript.addEventListener("load", resolve, { once: true });
            existingScript.addEventListener("error", () => reject(new Error("Could not load Razorpay Checkout.")), { once: true });
            return;
          }
          const script = document.createElement("script");
          script.src = razorpayScriptUrl;
          script.async = true;
          script.onload = resolve;
          script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
          document.body.appendChild(script);
        });
      }
      if (!window.Razorpay) throw new Error("Razorpay Checkout did not initialize.");

      const remaining = Math.max(0, Number(obligation.amount_due) - Number(obligation.amount_paid));
      if (!Number.isFinite(remaining) || remaining <= 0) {
        throw new Error("This rent obligation has no amount outstanding.");
      }

      const { data: order } = await api.post("/payments/razorpay/orders", {
        rent_id: obligation.rent_id,
        amount: Number(remaining.toFixed(2)),
      });

      const checkout = new window.Razorpay({
        key: order.razorpay_key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Smart-Prop",
        description: `Rent obligation ${obligation.rent_id}`,
        order_id: order.razorpay_order_id,
        handler: async (payment) => {
          try {
            const { data } = await api.post("/payments/razorpay/verify", {
              razorpay_order_id: payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature,
            });
            setPaymentFeedback(`Payment ${data.payment_id} verified successfully.`);
            toast.success("Rent payment verified.");
            await loadDashboard();
          } catch (error) {
            const message = getErrorMessage(error, "The payment could not be verified.");
            setPaymentError(message);
            toast.error(message);
          }
        },
      });
      checkout.on("payment.failed", (event) => {
        const message = event.error?.description || "Razorpay could not complete the payment.";
        setPaymentError(message);
        toast.error(message);
      });
      checkout.open();
    } catch (error) {
      const message = getErrorMessage(error, error.message || "Could not start the rent payment.");
      setPaymentError(message);
      toast.error(message);
    } finally {
      setPayingRentId(null);
    }
  }

  async function createMaintenanceRequest(values) {
    setSubmitting(true);
    try {
      await api.post("/maintenance-tickets", {
        ...values,
        tenant_id: tenant.tenant_id,
      });
      toast.success("Your maintenance request has been submitted.");
      setRequestOpen(false);
      await loadDashboard();
    } catch (requestError) {
      toast.error(getErrorMessage(requestError, "Could not submit your maintenance request."));
    } finally {
      setSubmitting(false);
    }
  }

  const greetingName = tenant?.full_name || (
    user?.full_name && !user.full_name.includes("@")
      ? user.full_name
      : user?.email?.split("@")[0]?.replace(/[._-]+/g, " ") || "there"
  );

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {view !== "dashboard" && <Link to="/dashboard" className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-muted hover:text-brand-700"><ArrowLeft size={14} /> Tenant overview</Link>}
          <p className="eyebrow">Tenant portal</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
            {view === "dashboard" ? `Welcome, ${greetingName}.` : view === "rent" ? "My rent" : view === "payments" ? "Payments" : "Maintenance requests"}
          </h1>
          <p className="mt-2 text-sm text-muted">{view === "dashboard" ? "Your rent and maintenance, together in one place." : view === "rent" ? "Check your rent obligations and due dates." : view === "payments" ? "Pay outstanding rent securely." : "Track and submit a maintenance request."}</p>
        </div>
        {state === "ready" && apartments.length > 0 && (view === "dashboard" || view === "maintenance") && (
          <button className="button-primary" onClick={() => setRequestOpen(true)}>
            <Plus size={16} /> Request maintenance
          </button>
        )}
      </div>

      {view === "dashboard" && (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { to: "/tenant/rent", label: "My rent", description: "View rent obligations and due dates.", icon: Banknote },
            { to: "/tenant/maintenance", label: "Maintenance requests", description: "Track requests or report an issue.", icon: ClipboardList },
            { to: "/tenant/payments", label: "Payments", description: "Pay outstanding rent with Razorpay.", icon: CreditCard },
          ].map(({ to, label, description, icon: Icon }) => (
            <Link to={to} key={to} className="panel-card group flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:border-brand-100">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon size={19} /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{label}</span><span className="mt-1 block text-xs text-muted">{description}</span></span>
              <ArrowRight size={17} className="text-brand-600 transition group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      )}

      {state === "loading" && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="panel-card h-32 animate-pulse bg-white" />)}
        </div>
      )}

      {state === "error" && (
        <div role="alert" className="panel-card mt-8 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-rose-700">{error}</p>
          <button className="button-secondary" onClick={loadDashboard}>Try again</button>
        </div>
      )}

      {state === "unlinked" && (
        <div className="panel-card mt-8 max-w-3xl p-6 sm:p-8">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-700"><CircleAlert size={20} /></div>
          <h2 className="mt-5 font-display text-xl font-extrabold">Your tenant profile needs to be linked</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            This login uses <strong className="text-ink">{user?.email || "an account without an email address"}</strong>, but there is no tenant profile with that same email address. To protect other tenants’ information, rent history and maintenance requests are only shown after an exact email match.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted">
            Ask your property manager to update your tenant profile to the email you use to sign in, then sign out and back in. Your dashboard will load your rent obligations and maintenance history automatically.
          </p>
          <button onClick={loadDashboard} disabled={state === "loading"} className="button-secondary mt-5">
            {state === "loading" ? "Checking profile..." : "Check profile again"}
          </button>
        </div>
      )}

      {state === "ready" && (
        <>
          {(view === "dashboard" || view === "rent" || view === "payments") && <div className={`${view === "dashboard" ? "mt-8" : "mt-6"} grid gap-4 sm:grid-cols-2 xl:grid-cols-3`}>
            <div className="panel-card p-5">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted">Outstanding rent</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><Banknote size={18} /></span></div>
              <p className="mt-4 font-display text-2xl font-extrabold">{money(outstandingBalance)}</p>
              <p className="mt-1 text-[11px] text-muted">{rent.filter((item) => Number(item.amount_due) > Number(item.amount_paid)).length} unpaid rent obligations</p>
            </div>
            <div className="panel-card p-5">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted">Rent obligations</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><Building2 size={18} /></span></div>
              <p className="mt-4 font-display text-2xl font-extrabold">{rent.length}</p>
              <p className="mt-1 text-[11px] text-muted">Your rent history on file</p>
            </div>
            <div className="panel-card p-5">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted">Open maintenance requests</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700"><Wrench size={18} /></span></div>
              <p className="mt-4 font-display text-2xl font-extrabold">{openTickets.length}</p>
              <p className="mt-1 text-[11px] text-muted">{tickets.length} total requests</p>
            </div>
          </div>}

          {error && <p role="status" className="mt-4 text-xs text-amber-700">{error}</p>}
          {paymentError && <p role="alert" className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700">{paymentError}</p>}
          {paymentFeedback && <p role="status" className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">{paymentFeedback}</p>}

          {(view === "dashboard" || view === "rent" || view === "payments") && <div className="mt-7 grid gap-5 xl:grid-cols-2">
            <div className="panel-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-bold">Your rent</h2><p className="mt-1 text-[11px] text-muted">Rent obligations and payment status</p></div><Banknote size={17} className="text-brand-600" /></div>
              {rent.length === 0
                ? <p className="p-6 text-xs text-muted">No rent obligations are currently listed for your tenant profile.</p>
                : rent.slice(0, 5).map((item) => (
                  <div key={item.rent_id} className="flex items-center justify-between gap-3 border-b border-slate-50 px-5 py-4 last:border-0">
                    <div><p className="text-xs font-bold">{item.billing_month}</p><p className="mt-1 text-[10px] text-muted">Due {item.due_date} · {money(Number(item.amount_due) - Number(item.amount_paid))} remaining</p></div>
                    <div className="flex shrink-0 items-center gap-2"><StatusPill status={item.status} />{Number(item.amount_due) > Number(item.amount_paid) && <button disabled={payingRentId === item.rent_id} onClick={() => payRent(item)} className="button-primary !px-3 !py-2">{payingRentId === item.rent_id ? "Loading..." : "Pay"}</button>}</div>
                  </div>
                ))}
              <p className="border-t border-slate-100 px-5 py-3 text-[10px] leading-5 text-muted">Payment checkout uses the API's Razorpay order and verification endpoints.</p>
            </div>

            {view === "dashboard" && <div className="panel-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-bold">Maintenance requests</h2><p className="mt-1 text-[11px] text-muted">Your submitted maintenance tickets</p></div><ClipboardList size={17} className="text-brand-600" /></div>
              {tickets.length === 0
                ? <div className="p-6"><p className="text-xs text-muted">You don’t have any maintenance requests yet.</p>{apartments.length > 0 && <button className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-brand-600" onClick={() => setRequestOpen(true)}>Create a request <ArrowRight size={14} /></button>}</div>
                : tickets.slice(0, 5).map((ticket) => (
                  <div key={ticket.ticket_id} className="flex items-center justify-between gap-4 border-b border-slate-50 px-5 py-4 last:border-0">
                    <div className="min-w-0"><p className="truncate text-xs font-bold">{ticket.complaint_category} · #{ticket.ticket_id}</p><p className="mt-1 truncate text-[10px] text-muted">{ticket.description}</p></div>
                    <StatusPill status={ticket.status} />
                  </div>
                ))}
              </div>}
            {view === "maintenance" && <div className="panel-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-bold">Your requests</h2><p className="mt-1 text-[11px] text-muted">Current ticket status and priority</p></div><ClipboardList size={17} className="text-brand-600" /></div>
              {tickets.length === 0
                ? <div className="p-6"><p className="text-xs text-muted">You don’t have any maintenance requests yet.</p>{apartments.length > 0 && <button className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-brand-600" onClick={() => setRequestOpen(true)}>Create a request <ArrowRight size={14} /></button>}</div>
                : tickets.map((ticket) => (
                  <div key={ticket.ticket_id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-50 px-5 py-4 last:border-0">
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{ticket.complaint_category} · #{ticket.ticket_id}</p><p className="mt-1 text-[10px] text-muted">{ticket.description}</p><p className="mt-1 text-[10px] text-muted">Priority: {prettyStatus(ticket.priority)}</p></div>
                    <StatusPill status={ticket.status} />
                  </div>
                ))}
            </div>}
          </div>}

          {view === "maintenance" && apartments.length === 0 && (
            <div className="mt-5 rounded-xl border border-slate-100 bg-white px-5 py-4 text-xs leading-5 text-muted">
              A maintenance request can be submitted once an active rental agreement links this tenant to an apartment.
            </div>
          )}

          {view === "payments" && (
            <div className="mt-5 rounded-xl border border-slate-100 bg-white px-5 py-4 text-xs leading-5 text-muted">
              {rent.some((item) => Number(item.amount_due) > Number(item.amount_paid))
                ? "Choose Pay next to an outstanding rent obligation to open the payment checkout."
                : "There are no outstanding rent obligations available to pay."}
            </div>
          )}
        </>
      )}

      {state === "unlinked" && (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { label: "Rent obligations", icon: Banknote, description: "Your rent will appear here after your tenant profile is linked." },
            { label: "Maintenance requests", icon: ClipboardList, description: "Your ticket history will appear here after your tenant profile is linked." },
            { label: "Rent payments", icon: CreditCard, description: "Payment actions become available when your tenant profile and rent are linked." },
          ].filter((item) => {
            if (view === "rent") return item.label === "Rent obligations";
            if (view === "maintenance") return item.label === "Maintenance requests";
            if (view === "payments") return item.label === "Rent payments";
            return true;
          }).map(({ label, icon: Icon, description }) => (
            <div className="panel-card p-5" key={label}>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon size={18} /></span>
              <h2 className="mt-4 text-sm font-bold">{label}</h2>
              <p className="mt-2 text-xs leading-5 text-muted">{description}</p>
            </div>
          ))}
        </div>
      )}

      {requestOpen && (
        <ResourceForm
          title="Request maintenance"
          fields={[
            { ...maintenanceFields[0], options: apartments },
            ...maintenanceFields.slice(1),
          ]}
          submitting={submitting}
          onCancel={() => setRequestOpen(false)}
          onSubmit={createMaintenanceRequest}
        />
      )}
    </section>
  );
}
