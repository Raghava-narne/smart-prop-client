export const permission = {
  dashboardView: "dashboard:view",
  maintenanceView: "maintenance:view",
  maintenanceCreate: "maintenance:create",
  maintenanceAssign: "maintenance:assign",
  maintenanceStart: "maintenance:start",
  maintenanceResolve: "maintenance:resolve",
  maintenanceClose: "maintenance:close",
};

const allModuleKeys = [
  "properties",
  "apartments",
  "tenants",
  "agreements",
  "rent-obligations",
  "payments",
  "maintenance",
  "technicians",
  "sla-policies",
  "overdue-rent",
  "audit",
  "roles",
];

const operationalModuleKeys = allModuleKeys.filter(
  (key) => !["audit", "roles"].includes(key),
);

const ownerModuleKeys = [
  "properties",
  "apartments",
  "tenants",
  "agreements",
  "rent-obligations",
  "payments",
  "overdue-rent",
];

function viewPermissions(moduleKeys) {
  return moduleKeys.map((key) => `${key}:view`);
}

function buildPermissions({ view, actions = {} }) {
  return [
    permission.dashboardView,
    ...viewPermissions(view),
    ...Object.entries(actions).flatMap(([moduleKey, moduleActions]) =>
      moduleActions.map((action) => `${moduleKey}:${action}`),
    ),
  ];
}

const administrativeActions = {
  properties: ["create", "update", "delete"],
  apartments: ["create", "update"],
  tenants: ["create", "update", "deactivate"],
  agreements: ["create", "terminate"],
  "rent-obligations": ["create", "update"],
  payments: ["create"],
  maintenance: ["create", "assign", "start", "resolve", "close"],
  technicians: ["create", "update"],
  "sla-policies": ["create", "update"],
  roles: ["create", "update"],
};

const managerActions = {
  ...administrativeActions,
  properties: ["create", "update"],
};

const knownRolePermissions = {
  ADMIN: buildPermissions({
    view: allModuleKeys,
    actions: administrativeActions,
  }),
  "PROPERTY MANAGER": buildPermissions({
    view: operationalModuleKeys,
    actions: managerActions,
  }),
  OWNER: buildPermissions({
    view: ownerModuleKeys,
  }),
  TENANT: [
    permission.dashboardView,
    "tenant:rent:view",
    "tenant:maintenance:view",
    "tenant:payments:view",
    "maintenance:create",
    "payments:create",
  ],
  TECHNICIAN: [
    permission.dashboardView,
    permission.maintenanceView,
    permission.maintenanceStart,
  ],
};

const configurablePermissions = (() => {
  const source = import.meta.env.VITE_ROLE_PERMISSIONS_JSON;
  if (!source) return {};
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("VITE_ROLE_PERMISSIONS_JSON must contain a valid JSON object.");
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("VITE_ROLE_PERMISSIONS_JSON must map role names to permission arrays.");
  }
  for (const [roleName, permissions] of Object.entries(parsed)) {
    if (!Array.isArray(permissions) || !permissions.every((item) => typeof item === "string")) {
      throw new Error(`Permissions for role "${roleName}" must be an array of strings.`);
    }
  }
  return parsed;
})();

const rolePermissions = { ...knownRolePermissions, ...configurablePermissions };

function normalizeRoleName(roleName) {
  return typeof roleName === "string" ? roleName.trim().toUpperCase() : "";
}

export function getPermissions(roleName) {
  const normalizedName = normalizeRoleName(roleName);
  const configuredExact = rolePermissions[roleName];
  return configuredExact ?? knownRolePermissions[normalizedName] ?? [];
}

export function hasPermission(roleName, requiredPermission) {
  return getPermissions(roleName).includes(requiredPermission);
}

export function hasAnyPermission(roleName, requiredPermissions) {
  return requiredPermissions.some((item) => hasPermission(roleName, item));
}

export function hasConfiguredPermissions(roleName) {
  return Boolean(rolePermissions[roleName] ?? knownRolePermissions[normalizeRoleName(roleName)]);
}

export function modulePermission(moduleName, action = "view") {
  return `${moduleName}:${action}`;
}
