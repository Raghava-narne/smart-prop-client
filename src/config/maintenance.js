const field = (name, label, type, options = {}) => ({ name, label, type, ...options });
const enumField = (name, label, values, options = {}) => field(name, label, "select", {
  options: values.map((value) => ({ value, label: value })),
  ...options,
});

export const maintenanceCreateFields = [
  field("tenant_id", "Tenant ID", "number", { required: true, min: 1 }),
  field("apartment_id", "Apartment ID", "number", { required: true, min: 1 }),
  enumField("complaint_category", "Category", ["PLUMBING", "ELECTRICAL", "CARPENTRY", "CLEANING", "APPLIANCE", "STRUCTURAL", "OTHER"], { required: true }),
  field("description", "Description", "text", { required: true, minLength: 5 }),
  enumField("priority", "Priority", ["LOW", "MEDIUM", "HIGH", "CRITICAL"], { required: true, defaultValue: "MEDIUM" }),
];

export const maintenanceAssignFields = [
  field("technician_id", "Technician", "select", {
    required: true,
    valueType: "number",
    loadOptionsEndpoint: "/technicians",
    valueKey: "technician_id",
    labelKey: "name",
    optionFilterField: "availability_status",
    optionFilterValue: "AVAILABLE",
  }),
];

export const maintenanceResolveFields = [
  field("resolution_note", "Resolution note", "text", { required: true, minLength: 5 }),
];
