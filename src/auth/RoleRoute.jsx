import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RoleRoute({ allowedRoles }) {
  const { role } = useAuth();
  const normalizedAllowedRoles = allowedRoles.map((item) => item.trim().toUpperCase());
  return role && normalizedAllowedRoles.includes(role.role_name?.trim().toUpperCase())
    ? <Outlet />
    : <Navigate to="/unauthorized" replace />;
}
