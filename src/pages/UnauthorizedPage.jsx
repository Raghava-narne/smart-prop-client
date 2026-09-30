import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function UnauthorizedPage() {
  const { identity } = useAuth();
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-12">
      <div className="panel-card w-full max-w-lg p-8 text-center sm:p-10">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-700"><ShieldAlert size={25} /></div>
        <p className="eyebrow mt-6">403 · Access restricted</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold">This area isn't available to your role.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          {identity
            ? `The ${identity.role.role_name} role does not have a configured permission for this page.`
            : "Sign in with an account that has access to this page."}
        </p>
        <Link to={identity ? "/dashboard" : "/login"} className="button-primary mt-7"><ArrowLeft size={16} /> Back to workspace</Link>
      </div>
    </main>
  );
}
