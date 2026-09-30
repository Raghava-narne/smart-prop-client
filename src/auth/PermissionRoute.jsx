import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { hasPermission } from "./permissions";

export default function PermissionRoute({ permission }) {
  const { role } = useAuth();
  if (!role || !hasPermission(role.role_name, permission)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <Outlet />;
}
