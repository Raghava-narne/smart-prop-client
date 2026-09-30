import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./auth/ProtectedRoute";
import PermissionRoute from "./auth/PermissionRoute";
import { permission } from "./auth/permissions";
import AppShell from "./components/AppShell";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import MaintenancePage from "./pages/MaintenancePage";
import ResourcePage from "./pages/ResourcePage";
import { resourceModules } from "./config/modules";
import RoleRoute from "./auth/RoleRoute";
import TenantDashboard from "./pages/TenantDashboard";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route element={<RoleRoute allowedRoles={["Tenant"]} />}>
            <Route path="/tenant/rent" element={<TenantDashboard view="rent" />} />
            <Route path="/tenant/maintenance" element={<TenantDashboard view="maintenance" />} />
            <Route path="/tenant/payments" element={<TenantDashboard view="payments" />} />
          </Route>
          <Route element={<PermissionRoute permission={permission.maintenanceView} />}>
            <Route path="/maintenance" element={<MaintenancePage />} />
          </Route>
          {resourceModules.filter((item) => item.key !== "maintenance").map(({ key }) => (
            <Route key={key} element={<PermissionRoute permission={`${key}:view`} />}>
              <Route path={`/${key}`} element={<ResourcePage resourceKey={key} />} />
            </Route>
          ))}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
