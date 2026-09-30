import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, CircleAlert, LockKeyhole, Mail, UserRound } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api, getErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export default function RegisterPage() {
  const { identity, register, loading } = useAuth();
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [rolesState, setRolesState] = useState("loading");
  const [roleError, setRoleError] = useState("");
  const [formError, setFormError] = useState("");
  const [values, setValues] = useState({ full_name: "", email: "", password: "", role_id: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/roles")
      .then(({ data }) => {
        if (!Array.isArray(data)) throw new Error("The roles API returned an unexpected response.");
        setRoles(data);
        setRolesState("ready");
      })
      .catch((error) => {
        setRoleError(getErrorMessage(error, "Could not load the roles available for registration."));
        setRolesState("error");
      });
  }, []);

  if (loading) return <div className="page-loader"><span className="spinner" /></div>;
  if (identity) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await register({ ...values, role_id: Number(values.role_id) });
      toast.success("Your account is ready.");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const message = getErrorMessage(error, error.message || "Unable to create your account.");
      if (error.response?.status === 409) setFormError("This email is already registered. Sign in with your existing account instead.");
      else setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-canvas px-5 py-10 sm:place-items-center">
      <section className="panel-card mx-auto w-full max-w-xl p-6 sm:p-9">
        <Link to="/login" className="inline-flex items-center gap-2 text-xs font-bold text-muted hover:text-brand-700"><ArrowLeft size={15} /> Back to sign in</Link>
        <div className="mt-7 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white"><Building2 size={20} /></span><span className="font-display text-lg font-extrabold">smart-prop</span></div>
        <p className="eyebrow mt-8">Get started</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-muted">Your account will be linked to an existing workspace role.</p>

        <div className="mt-5 flex gap-3 rounded-xl border border-amber-100 bg-amber-50/70 p-3 text-[11px] leading-5 text-amber-900">
          <CircleAlert size={16} className="mt-0.5 shrink-0" />
          <p>Choose only the role assigned to you by your organization. The backend currently accepts a role ID at registration and does not enforce role assignment policy.</p>
        </div>

        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          {formError && <div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700 sm:col-span-2">{formError}{formError.includes("already registered") && <> <Link to="/login" className="font-bold underline">Sign in</Link>.</>}</div>}
          <label className="field-label sm:col-span-2">Full name
            <span className="field-wrap"><UserRound size={17} /><input autoComplete="name" minLength={2} maxLength={100} required value={values.full_name} onChange={(event) => setValues({ ...values, full_name: event.target.value })} placeholder="Your full name" /></span>
          </label>
          <label className="field-label sm:col-span-2">Email address
            <span className="field-wrap"><Mail size={17} /><input autoComplete="email" type="email" required value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} placeholder="you@company.com" /></span>
          </label>
          <label className="field-label sm:col-span-2">Password
            <span className="field-wrap"><LockKeyhole size={17} /><input autoComplete="new-password" type="password" minLength={6} maxLength={20} required value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} placeholder="6–20 characters" /></span>
          </label>
          <label className="field-label sm:col-span-2">Account role
            <span className="field-wrap"><Building2 size={17} /><select required disabled={rolesState !== "ready" || roles.length === 0} value={values.role_id} onChange={(event) => setValues({ ...values, role_id: event.target.value })}>
              <option value="">{rolesState === "loading" ? "Loading available roles..." : "Select your assigned role"}</option>
              {roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.role_name}</option>)}
            </select></span>
          </label>
          {rolesState === "error" && <p className="text-xs text-rose-600 sm:col-span-2">{roleError}</p>}
          {rolesState === "ready" && roles.length === 0 && <p className="text-xs text-amber-700 sm:col-span-2">No roles are currently available. Ask your administrator to configure a role before registering.</p>}
          <button className="button-primary mt-2 w-full justify-center sm:col-span-2" disabled={submitting || rolesState !== "ready" || roles.length === 0}>{submitting ? "Creating account..." : "Create account"} {!submitting && <ArrowRight size={16} />}</button>
        </form>
        <p className="mt-6 text-center text-xs text-muted">Already have an account? <Link to="/login" className="font-bold text-brand-600 hover:text-brand-700">Sign in</Link></p>
      </section>
    </main>
  );
}
