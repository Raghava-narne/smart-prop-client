import { useAuth } from "./AuthContext";
import { hasPermission } from "./permissions";

export default function PermissionGuard({ permission, children, fallback = null }) {
  const { role } = useAuth();
  return hasPermission(role?.role_name, permission) ? children : fallback;
}
