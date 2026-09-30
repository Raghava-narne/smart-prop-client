import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute() {
  const { identity, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page-loader"><span className="spinner" /></div>;
  if (!identity) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
