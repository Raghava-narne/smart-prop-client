import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, Building2, CircleAlert, FileText, Home, ShieldCheck, Users, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { hasConfiguredPermissions, hasPermission, permission } from "../auth/permissions";
import TechnicianDashboard from "./TechnicianDashboard";
import TenantDashboard from "./TenantDashboard";
import { resourceModules } from "../config/modules";

const dashboardMetrics = [
  {
    key: "properties",
    label: "Properties",
    endpoint: "/properties",
    icon: Building2,
    description: (items) => `${items.length} registered properties`,
    value: (items) => items.length,
  },
  {
    key: "apartments",
    label: "Apartments",
    endpoint: "/apartments",
    icon: Home,
    description: (items) => `${items.filter((item) => item.status === "AVAILABLE").length} available`,
    value: (items) => items.length,
  },
  {
    key: "tenants",
    label: "Tenants",
    endpoint: "/tenants",
    icon: Users,
    description: (items) => `${items.filter((item) => item.status?.toLowerCase() === "active").length} active`,
    value: (items) => items.length,
  },
  {
    key: "agreements",
    label: "Active agreements",
    endpoint: "/rental-agreements",
    icon: FileText,
    description: (items) => `${items.filter((item) => item.status === "ACTIVE").length} currently active`,
    value: (items) => items.filter((item) => item.status === "ACTIVE").length,
  },
  {
    key: "rent-obligations",
    label: "Rent obligations",
    endpoint: "/rent-obligations",
    icon: Wallet,
    description: (items) => `${items.filter((item) => item.status === "OVERDUE").length} overdue`,
    value: (items) => items.length,
  },
  {
    key: "maintenance",
    label: "Open tickets",
    endpoint: "/maintenance-tickets",
    icon: Activity,
    description: (items) => `${items.filter((item) => ["IN_PROGRESS", "ASSIGNED"].includes(item.status)).length} assigned or in progress`,
    value: (items) => items.filter((item) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(item.status)).length,
  },
  {
    key: "overdue-rent",
    label: "Overdue rent",
    endpoint: "/reports/overdue-rent",
    icon: Wallet,
    description: (items) => `${items.length} overdue obligations`,
    value: (items) => items.reduce((total, item) => total + Math.max(0, Number(item.amount_due) - Number(item.amount_paid)), 0),
    money: true,
  },
];

function formatMetric(metric, records) {
  if (metric.money) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(metric.value(records));
  }
  return metric.value(records);
}

export default function DashboardPage() {
  const { user, role } = useAuth();
  const [metricResults, setMetricResults] = useState({});

  const normalizedRoleName = role?.role_name?.trim().toUpperCase();
  const greetingName = user?.full_name && !user.full_name.includes("@")
    ? user.full_name.split(" ")[0]
    : user?.email?.split("@")[0]?.replace(/[._-]+/g, " ") || "there";
  const visibleMetrics = dashboardMetrics.filter(({ key }) =>
    hasPermission(role?.role_name, key === "maintenance" ? permission.maintenanceView : `${key}:view`),
  );

  useEffect(() => {
    let active = true;
    setMetricResults({});
    if (!normalizedRoleName || normalizedRoleName === "TECHNICIAN" || !hasConfiguredPermissions(role?.role_name)) {
      return () => { active = false; };
    }
    Promise.all(visibleMetrics.map(async (metric) => {
      try {
        const { data } = await api.get(metric.endpoint);
        if (!Array.isArray(data)) throw new Error("Unexpected response from the API.");
        return [metric.key, { data, error: "" }];
      } catch (error) {
        return [metric.key, {
          data: null,
          error: error.response?.data?.detail || "Could not load this summary.",
        }];
      }
    })).then((results) => {
      if (active) setMetricResults(Object.fromEntries(results));
    });
    return () => { active = false; };
  }, [normalizedRoleName]);

  if (normalizedRoleName === "TECHNICIAN") return <TechnicianDashboard user={user} />;
  if (normalizedRoleName === "TENANT") return <TenantDashboard user={user} />;

  if (!hasConfiguredPermissions(role?.role_name)) {
    return (
      <section className="mx-auto max-w-3xl py-10">
        <div className="panel-card p-7 sm:p-10">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
            <CircleAlert size={23} />
          </div>
          <p className="eyebrow mt-7">Access setup required</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Welcome, {user?.full_name?.split(" ")[0] || "there"}.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
            Your account is linked to the <strong className="text-ink">{role?.role_name}</strong> role. The API provides the role record, but does not publish role permissions; no access policy has been assumed for this role.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/unauthorized" className="button-secondary"><ShieldCheck size={16} /> View access details</Link>
            <span className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-500"><Building2 size={15} /> Role ID: {role?.role_id}</span>
          </div>
        </div>
      </section>
    );
  }

  if (!hasPermission(role?.role_name, permission.dashboardView)) {
    return (
      <section className="panel-card mx-auto max-w-2xl p-8">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-700"><CircleAlert size={20} /></div>
        <h1 className="mt-5 font-display text-xl font-extrabold">Dashboard access is not configured</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Your role has no dashboard permission. Ask your workspace administrator to configure the UI permission mapping.</p>
      </section>
    );
  }

  const roleModules = resourceModules.filter(({ key }) =>
    hasPermission(role?.role_name, key === "maintenance" ? permission.maintenanceView : `${key}:view`),
  );

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Good to see you, {greetingName}.</h1>
          <p className="mt-2 text-sm text-muted">Here's what needs your attention today.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-muted shadow-panel"><span className="h-2 w-2 rounded-full bg-brand-500" /> {role?.role_name}</span>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visibleMetrics.map((metric) => {
          const result = metricResults[metric.key];
          const Icon = metric.icon;
          return (
            <Link key={metric.key} to={`/${metric.key}`} title={result?.error || metric.description(result?.data ?? [])} className="panel-card group p-5 transition hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">{metric.label}</span>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon size={18} /></span>
              </div>
              <p className="mt-4 font-display text-2xl font-extrabold">
                {result?.error ? "Unavailable" : result ? formatMetric(metric, result.data) : <span className="inline-block h-7 w-12 animate-pulse rounded bg-slate-100" />}
              </p>
              <p className={`mt-1 text-[11px] ${result?.error ? "text-rose-600" : "text-muted"}`}>
                {result?.error || (result ? metric.description(result.data) : "Loading live summary…")}
              </p>
            </Link>
          );
        })}
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="panel-card p-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted">Role access</span><ShieldCheck size={18} className="text-brand-600" /></div><p className="mt-5 font-display text-2xl font-extrabold">Configured</p><p className="mt-1 text-xs text-muted">Visible modules follow your configured UI permissions.</p></div>
        {roleModules.map(({ key, label, icon: Icon }) => (
          <Link key={key} to={`/${key}`} className="panel-card group p-5 transition hover:-translate-y-0.5">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted">{label}</span><ArrowUpRight size={18} className="text-brand-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
            <p className="mt-5 grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon size={18} /></p>
            <p className="mt-4 text-xs font-semibold">Open module</p>
          </Link>
        ))}
        {roleModules.length === 0 && <div className="panel-card p-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted">Workspace modules</span><Building2 size={18} className="text-brand-600" /></div><p className="mt-5 text-sm font-bold">No modules are enabled</p><p className="mt-1 text-xs text-muted">Your role currently has no module-view permissions.</p></div>}
      </div>
      {role?.role_name?.trim().toUpperCase() === "ADMIN" && (
        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 text-xs leading-6 text-blue-900">
          User administration is not available because the running API does not expose a `/users` route. Registration and login are available; user-list and user-management screens require a backend endpoint.
        </div>
      )}
    </section>
  );
}
