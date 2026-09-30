import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api, getErrorMessage } from "../api/client";

export default function ResourceForm({ title, fields, initial = {}, onCancel, onSubmit, submitting }) {
  const [values, setValues] = useState({});
  const [loadedOptions, setLoadedOptions] = useState({});
  const [optionsError, setOptionsError] = useState("");

  useEffect(() => {
    const defaults = {};
    for (const item of fields) {
      defaults[item.name] = initial[item.name] ?? item.defaultValue ?? "";
    }
    setValues(defaults);
  }, [fields, initial]);

  useEffect(() => {
    let active = true;
    setOptionsError("");
    setLoadedOptions({});
    const dynamicFields = fields.filter((item) => item.loadOptionsEndpoint);
    if (dynamicFields.length === 0) return undefined;
    Promise.all(dynamicFields.map(async (item) => {
      const { data } = await api.get(item.loadOptionsEndpoint);
      if (!Array.isArray(data)) throw new Error("The options API returned an unexpected response.");
      return [item.name, data];
    }))
      .then((items) => {
        if (active) setLoadedOptions(Object.fromEntries(items));
      })
      .catch((error) => {
        if (active) setOptionsError(getErrorMessage(error, "Could not load form options."));
      });
    return () => { active = false; };
  }, [fields]);

  function handleSubmit(event) {
    event.preventDefault();
    const payload = {};
    for (const item of fields) {
      const raw = values[item.name];
      if (raw === "" || raw == null) {
        if (item.required) payload[item.name] = raw;
        continue;
      }
      payload[item.name] = item.type === "number" || item.valueType === "number" ? Number(raw) : raw;
    }
    onSubmit(payload);
  }

  function optionsFor(item) {
    return (loadedOptions[item.name] ?? [])
      .filter((entry) => !item.optionFilterField || entry[item.optionFilterField] === item.optionFilterValue)
      .map((entry) => ({
        value: entry[item.valueKey],
        label: entry[item.labelKey],
      }));
  }

  const hasUnavailableOptions = fields.some((item) =>
    item.loadOptionsEndpoint && loadedOptions[item.name] && optionsFor(item).length === 0,
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section role="dialog" aria-modal="true" aria-labelledby="resource-form-title" className="panel-card my-auto w-full max-w-xl p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div><p className="eyebrow">Smart-Prop</p><h2 id="resource-form-title" className="mt-2 font-display text-xl font-extrabold">{title}</h2></div>
          <button type="button" onClick={onCancel} className="rounded-lg p-2 text-muted hover:bg-slate-50" aria-label="Close form"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
          {fields.map((item) => (
            <label className="field-label" key={item.name}>
              {item.label}
              <span className="field-wrap">
                {item.type === "select" ? (
                  <select
                    value={values[item.name] ?? ""}
                    required={item.required}
                    disabled={Boolean(item.loadOptionsEndpoint) && !loadedOptions[item.name]?.length}
                    onChange={(event) => setValues((current) => ({ ...current, [item.name]: event.target.value }))}
                  >
                    <option value="">Select {item.label.toLowerCase()}</option>
                    {(item.loadOptionsEndpoint ? optionsFor(item) : item.options).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : (
                  <input
                    type={item.type}
                    required={item.required}
                    min={item.min}
                    max={item.max}
                    minLength={item.minLength}
                    maxLength={item.maxLength}
                    step={item.step}
                    value={values[item.name] ?? ""}
                    placeholder={item.placeholder}
                    onChange={(event) => setValues((current) => ({ ...current, [item.name]: event.target.value }))}
                  />
                )}
              </span>
            </label>
          ))}
          {optionsError && <p className="text-xs text-rose-600 sm:col-span-2">{optionsError}</p>}
          {hasUnavailableOptions && <p className="text-xs text-amber-700 sm:col-span-2">No options are available for this required selection.</p>}
          <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="button-secondary" onClick={onCancel}>Cancel</button>
            <button className="button-primary" disabled={submitting}>{submitting ? "Saving..." : title.startsWith("Create ") ? "Create record" : "Save changes"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
