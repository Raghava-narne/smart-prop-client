import {
  Banknote,
  Building2,
  ClipboardList,
  FileClock,
  FileText,
  HardHat,
  House,
  Landmark,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";

export const resourceModules = [
  { key: "properties", label: "Properties", icon: Building2 },
  { key: "apartments", label: "Apartments", icon: House },
  { key: "tenants", label: "Tenants", icon: Users },
  { key: "agreements", label: "Rental agreements", icon: FileText },
  { key: "rent-obligations", label: "Rent obligations", icon: Banknote },
  { key: "payments", label: "Payments", icon: Landmark },
  { key: "maintenance", label: "Maintenance", icon: ClipboardList },
  { key: "technicians", label: "Technicians", icon: HardHat },
  { key: "sla-policies", label: "SLA policies", icon: ShieldCheck },
  { key: "overdue-rent", label: "Overdue rent", icon: FileClock },
  { key: "audit", label: "Audit log", icon: FileClock },
  { key: "roles", label: "Roles", icon: Wrench },
];
