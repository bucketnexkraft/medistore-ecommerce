import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { PiArrowClockwise, PiLightbulb, PiWarningCircle } from "react-icons/pi";
import {
  fetchInventoryCopilotSettings,
  updateInventoryCopilotSettings,
} from "../../api/inventoryCopilot";

const defaultSettings = {
  baseline_sales_days: 30,
  recent_sales_days: 7,
  low_stock_days: 7,
  critical_stock_days: 3,
  fast_selling_multiplier: 1.4,
  fast_selling_min_quantity: 2,
  fast_selling_high_percent: 75,
  aging_stock_days: 60,
  dead_stock_days: 90,
  new_product_grace_days: 30,
  overstock_days: 120,
  overstock_medium_days: 180,
  max_products: 200,
};

const sections = [
  {
    title: "Sales Windows",
    description: "Controls the normal sales baseline and the recent period used for fast-selling alerts.",
    fields: [
      { name: "baseline_sales_days", label: "Baseline sales days", min: 7, max: 365 },
      { name: "recent_sales_days", label: "Recent sales days", min: 1, max: 90 },
      { name: "fast_selling_multiplier", label: "Fast-selling multiplier", min: 1, max: 10, step: "0.1" },
      { name: "fast_selling_min_quantity", label: "Minimum recent quantity", min: 0, max: 999999, step: "0.01" },
      { name: "fast_selling_high_percent", label: "High priority increase %", min: 1, max: 1000 },
    ],
  },
  {
    title: "Stock Risk",
    description: "Controls low stock, aging stock, and dead stock thresholds.",
    fields: [
      { name: "low_stock_days", label: "Low stock days left", min: 1, max: 365 },
      { name: "critical_stock_days", label: "Critical stock days left", min: 1, max: 365 },
      { name: "aging_stock_days", label: "Aging stock days", min: 1, max: 1000 },
      { name: "dead_stock_days", label: "Dead stock days", min: 1, max: 1000 },
      { name: "new_product_grace_days", label: "New product grace days", min: 0, max: 365 },
    ],
  },
  {
    title: "Overstock",
    description: "Controls overstock coverage and how many products Copilot scans.",
    fields: [
      { name: "overstock_days", label: "Overstock days coverage", min: 1, max: 1000 },
      { name: "overstock_medium_days", label: "Medium priority coverage", min: 1, max: 1000 },
      { name: "max_products", label: "Max products to scan", min: 10, max: 5000 },
    ],
  },
];

function SettingInput({ field, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{field.label}</span>
      <input
        type="number"
        min={field.min}
        max={field.max}
        step={field.step || "1"}
        value={value}
        onChange={(event) => onChange(field.name, event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

export default function InventoryCopilotSetup() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [form, setForm] = useState(defaultSettings);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchInventoryCopilotSettings(accessToken);
      setForm({ ...defaultSettings, ...(result?.data || {}) });
      setReady(result?.ready !== false);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load Inventory Copilot setup");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) {
      loadSettings();
    }
  }, [accessToken, loadSettings]);

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toPayload = () =>
    Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        ["fast_selling_multiplier", "fast_selling_min_quantity"].includes(key)
          ? Number.parseFloat(value)
          : Number.parseInt(value, 10),
      ])
    );

  const validate = (payload) => {
    if (payload.recent_sales_days >= payload.baseline_sales_days) {
      return "Recent sales days must be lower than baseline sales days";
    }
    if (payload.critical_stock_days > payload.low_stock_days) {
      return "Critical stock days must be lower than or equal to low stock days";
    }
    if (payload.dead_stock_days < payload.aging_stock_days) {
      return "Dead stock days must be greater than or equal to aging stock days";
    }
    if (payload.overstock_medium_days < payload.overstock_days) {
      return "Medium priority coverage must be greater than or equal to overstock coverage";
    }
    if (Object.values(payload).some((value) => Number.isNaN(value))) {
      return "All setup values are required";
    }

    return null;
  };

  const handleSave = async () => {
    const payload = toPayload();
    const error = validate(payload);

    if (error) {
      toast.error(error);
      return;
    }

    setSaving(true);
    try {
      const result = await updateInventoryCopilotSettings(accessToken, payload);
      setForm({ ...defaultSettings, ...(result?.data || payload) });
      setReady(result?.ready !== false);
      toast.success(result.message || "Inventory Copilot setup updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update Inventory Copilot setup");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 figtree-regular lg:p-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-semibold text-primary">
            <PiLightbulb size={18} />
            Inventory Copilot
          </div>
          <h1 className="text-2xl font-bold text-slate-950">Copilot Setup</h1>
          <p className="mt-1 text-sm text-slate-600">
            Tune how Stock Guard identifies low stock, fast selling products, dead stock, and overstock.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setForm(defaultSettings)}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
          >
            <PiArrowClockwise size={18} />
            Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Setup"}
          </button>
        </div>
      </div>

      {!ready && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <PiWarningCircle className="mt-0.5 flex-shrink-0" size={20} />
          <span>Setup values can be viewed now. Run php artisan migrate before saving company-specific values.</span>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {sections.map((section) => (
          <section key={section.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-950">{section.title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{section.description}</p>
            </div>
            <div className="grid gap-4">
              {section.fields.map((field) => (
                <SettingInput
                  key={field.name}
                  field={field}
                  value={form[field.name] ?? ""}
                  onChange={handleChange}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
