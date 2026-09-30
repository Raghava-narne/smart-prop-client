import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Building2, ChevronDown, CircleHelp, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { hasPermission, permission } from "../auth/permissions";
import { resourceModules } from "../config/modules";
import { Banknote, ClipboardList, CreditCard } from "lucide-react";

export default function AppShell() {
  const { user, role, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const links = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    ...(role?.role_name?.trim().toUpperCase() === "TENANT"
      ? [
        { to: "/tenant/rent", label: "My rent", icon: Banknote, permission: "tenant:rent:view" },
        { to: "/tenant/maintenance", label: "Maintenance requests", icon: ClipboardList, permission: "tenant:maintenance:view" },
        { to: "/tenant/payments", label: "Payments", icon: CreditCard, permission: "tenant:payments:view" },
      ]
      : []),
    ...resourceModules.map(({ key, label, icon }) => ({
      to: `/${key}`,
      label,
      icon,
      permission: key === "maintenance" ? permission.maintenanceView : `${key}:view`,
    })),
  ];

  function signOut() {
    logout();
    navigate("/login", { replace: true });
  }

  const visibleLinks = links.filter(
    (link) => !link.permission || hasPermission(role?.role_name, link.permission),
  );

  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      {menuOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-ink/30 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-slate-100 bg-white px-5 py-6 transition-transform lg:static lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-2">
          <Link to="/dashboard" className="flex items-center gap-3" aria-label="Smart-Prop home">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
              <Building2 size={21} strokeWidth={2.2} />
            </span>
            <span>
              <span className="block font-display text-[17px] font-extrabold tracking-tight">smart-prop</span>
              <span className="block text-[10px] font-bold uppercase tracking-[.16em] text-muted">Property workspace</span>
            </span>
          </Link>
          <button className="rounded-lg p-2 text-muted lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.17em] text-slate-400">Workspace</div>
        <nav className="mt-3 space-y-1">
          {visibleLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-50 hover:text-ink"
                }`
              }
            >
              <Icon size={18} />
              {label}
              {to === "/maintenance" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto">
          <div className="mb-4 rounded-2xl bg-[#f5f8f7] p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm">
              <CircleHelp size={16} />
            </div>
            <p className="mt-3 text-xs font-bold">Need a hand?</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">Your workspace access follows the role assigned to your account.</p>
          </div>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600">
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-100 bg-white/90 px-5 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button className="rounded-lg p-2 text-muted hover:bg-slate-100 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open navigation">
              <Menu size={20} />
            </button>
            <div className="hidden items-center gap-2 text-[11px] text-muted sm:flex">
              <span>Smart-Prop</span><span>/</span><span className="font-semibold text-ink">Workspace</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-right sm:block">
              <span className="block max-w-48 truncate text-xs font-bold">{user?.full_name}</span>
              <span className="block text-[10px] font-medium text-muted">{role?.role_name}</span>
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#dff1eb] text-xs font-extrabold text-brand-700">
              {(user?.full_name ?? "U").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
            </span>
            <ChevronDown size={14} className="hidden text-muted sm:block" />
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] p-5 md:p-8 xl:px-10">
          {!visibleLinks.some((link) => link.to === "/maintenance") && (
            <div className="sr-only" aria-live="polite">Maintenance pages are hidden unless the role grants access.</div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
