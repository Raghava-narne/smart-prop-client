import { useState } from "react";
import { ArrowRight, Building2, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { getErrorMessage } from "../api/client";

export default function LoginPage() {
  const { identity, login, loading, startupError, dismissStartupError } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  if (loading) return <div className="page-loader"><span className="spinner" /></div>;
  if (identity) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await login(values);
      toast.success("Welcome back.");
      navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
    } catch (error) {
      const message = getErrorMessage(error, error.message || "Unable to sign in.");
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[1.02fr_.98fr]">
      <section className="relative hidden overflow-hidden bg-[#123f35] px-12 py-10 text-white lg:flex lg:flex-col xl:px-20">
        <div className="absolute -right-24 -top-20 h-96 w-96 rounded-full border border-white/10" />
        <div className="absolute -right-8 -top-4 h-64 w-64 rounded-full border border-white/10" />
        <Link to="/login" className="relative z-10 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><Building2 size={21} /></span>
          <span className="font-display text-lg font-extrabold tracking-tight">smart-prop</span>
        </Link>
        <div className="relative z-10 my-auto max-w-xl pb-8">
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-[#b9e8d9]">Property operations, in sync</span>
          <h1 className="mt-7 font-display text-5xl font-extrabold leading-[1.1] tracking-[-.04em] xl:text-6xl">A calmer way to run your properties.</h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-white/65">Bring your property operations and maintenance workflow into one focused workspace.</p>
          <div className="mt-12 flex items-center gap-3">
            <span className="flex -space-x-2">{["A", "M", "S"].map((letter, index) => <span key={letter} className={`grid h-9 w-9 place-items-center rounded-full border-2 border-[#123f35] text-[10px] font-bold text-white ${["bg-[#c4785d]", "bg-[#739b8f]", "bg-[#a388bc]"][index]}`}>{letter}</span>)}</span>
            <span className="text-xs text-white/65">Thoughtfully built for property teams</span>
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-between text-[10px] text-white/45"><span>© {new Date().getFullYear()} Smart-Prop</span><span>Property management, made clearer.</span></div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[420px]">
          <Link to="/login" className="mb-12 inline-flex items-center gap-2 font-display text-lg font-extrabold tracking-tight lg:hidden"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white"><Building2 size={19} /></span> smart-prop</Link>
          <p className="eyebrow">Welcome back</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Sign in to your account</h2>
          <p className="mt-2 text-sm text-muted">Enter your details to access your workspace.</p>
          {startupError && <div role="alert" className="mt-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">{startupError}<button onClick={dismissStartupError} type="button" className="ml-2 font-bold underline">Dismiss</button></div>}
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {formError && <div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">{formError}</div>}
            <label className="field-label">Email address
              <span className="field-wrap"><Mail size={17} /><input autoComplete="email" type="email" required value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} placeholder="you@company.com" /></span>
            </label>
            <label className="field-label">Password
              <span className="field-wrap"><LockKeyhole size={17} /><input autoComplete="current-password" type={showPassword ? "text" : "password"} minLength={6} maxLength={20} required value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} placeholder="6–20 characters" /><button type="button" className="p-1 text-slate-400 hover:text-ink" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
            </label>
            <button className="button-primary w-full justify-center !py-3" disabled={submitting}>{submitting ? "Signing in..." : "Sign in"} {!submitting && <ArrowRight size={16} />}</button>
          </form>
          <p className="mt-7 text-center text-xs text-muted">New to Smart-Prop? <Link to="/register" className="font-bold text-brand-600 hover:text-brand-700">Create an account</Link></p>
          <p className="mt-12 text-center text-[10px] leading-5 text-slate-400">Your account's workspace access is determined by the role assigned to it.</p>
        </div>
      </section>
    </main>
  );
}
