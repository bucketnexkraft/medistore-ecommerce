import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { FiArrowRight, FiBox, FiCheckCircle, FiClock, FiPlus, FiTrash2 } from "react-icons/fi";
import { createStockTransfer, getStockTransfers, getTransferSourceItems } from "../../api/stockTransfer";
import { getWarehouse } from "../../api/warehouse";
import { formatPrice } from "../../hooks/currency";

const today = new Date().toISOString().slice(0, 10);

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 48,
    borderRadius: 8,
    borderColor: state.isFocused ? "#2563eb" : "#d1d5db",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(37, 99, 235, 0.12)" : "none",
    ":hover": { borderColor: state.isFocused ? "#2563eb" : "#9ca3af" },
  }),
  placeholder: (base) => ({ ...base, color: "#9ca3af" }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? "#2563eb" : state.isFocused ? "#eff6ff" : "#ffffff",
    color: state.isSelected ? "#ffffff" : "#111827",
  }),
  menu: (base) => ({ ...base, zIndex: 30, borderRadius: 8, overflow: "hidden" }),
};

export default function StockTransfers() {
  const accessToken = useSelector((s) => s.auth.accessToken);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transferLines, setTransferLines] = useState([]);

  const [form, setForm] = useState({
    from_warehouse_id: "",
    to_warehouse_id: "",
    transfer_date: today,
    note: "",
    inventory_item_id: "",
    qty: "",
  });

  const selectedItem = useMemo(
    () => items.find((i) => String(i.inventory_item_id) === String(form.inventory_item_id)),
    [items, form.inventory_item_id]
  );

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: w.name })),
    [warehouses]
  );

  const itemOptions = useMemo(
    () =>
      items.map((it) => ({
        value: it.inventory_item_id,
        label: `${it.product_name} (${it.product_code})`,
        searchLabel: `${it.product_name} ${it.product_code} ${it.variant || ""} ${it.lot_number || ""}`,
        item: it,
      })),
    [items]
  );

  const selectedFromOption = warehouseOptions.find(
    (option) => String(option.value) === String(form.from_warehouse_id)
  ) || null;

  const selectedToOption = warehouseOptions.find(
    (option) => String(option.value) === String(form.to_warehouse_id)
  ) || null;

  const selectedProductOption = itemOptions.find(
    (option) => String(option.value) === String(form.inventory_item_id)
  ) || null;

  const transferSummary = useMemo(
    () =>
      transferLines.reduce(
        (summary, line) => {
          const qty = Number(line.qty) || 0;
          const amount = qty * (Number(line.unit_price) || 0);
          return {
            qty: summary.qty + qty,
            amount: summary.amount + amount,
          };
        },
        { qty: 0, amount: 0 }
      ),
    [transferLines]
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [wRes, hRes] = await Promise.all([
        getWarehouse(accessToken, { perPage: 200, status: "1" }),
        getStockTransfers(accessToken, { perPage: 20, page: 1 }),
      ]);

      if (wRes?.status) setWarehouses(wRes.data || []);
      if (hRes?.status) setHistory(hRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const fromId = form.from_warehouse_id;
    if (!fromId) {
      setItems([]);
      return;
    }
    (async () => {
      const res = await getTransferSourceItems(accessToken, { warehouse_id: fromId });
      if (res?.status) setItems(res.data || []);
    })();
  }, [form.from_warehouse_id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.from_warehouse_id || !form.to_warehouse_id) {
      toast.error("Please select both source and destination warehouse");
      return;
    }
    if (String(form.from_warehouse_id) === String(form.to_warehouse_id)) {
      toast.error("From warehouse and To warehouse must be different");
      return;
    }
    if (transferLines.length === 0) {
      toast.error("Please add at least one product line");
      return;
    }
    setSaving(true);
    const payload = {
      from_warehouse_id: form.from_warehouse_id,
      to_warehouse_id: form.to_warehouse_id,
      transfer_date: form.transfer_date,
      note: form.note,
      items: transferLines.map((line) => ({
        inventory_item_id: Number(line.inventory_item_id),
        qty: Number(line.qty),
      })),
    };
    const res = await createStockTransfer(accessToken, payload);
    setSaving(false);
    if (!res?.status) {
      const errors = res?.error?.errors || res?.data?.errors || res?.errors;
      if (errors && typeof errors === "object") {
        Object.values(errors)
          .flat()
          .slice(0, 8)
          .forEach((msg) => toast.error(String(msg)));
      } else {
        const msg = res?.error?.message || res?.message || "Transfer failed";
        toast.error(msg);
      }
      return;
    }
    toast.success(res.message || "Transfer completed");
    setForm((p) => ({ ...p, inventory_item_id: "", qty: "", note: "" }));
    setTransferLines([]);
    loadAll();
  };

  const addLine = () => {
    if (!form.inventory_item_id || !form.qty) {
      toast.error("Please select source item and quantity");
      return;
    }
    const qty = Number(form.qty);
    if (!(qty > 0)) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (!selectedItem) {
      toast.error("Selected stock item not found");
      return;
    }
    if (qty > Number(selectedItem.available_qty || 0)) {
      toast.error(`Quantity cannot exceed available stock (${selectedItem.available_qty})`);
      return;
    }

    const existingIndex = transferLines.findIndex(
      (line) => String(line.inventory_item_id) === String(form.inventory_item_id)
    );

    if (existingIndex !== -1) {
      const updated = [...transferLines];
      const newQty = Number(updated[existingIndex].qty) + qty;
      if (newQty > Number(selectedItem.available_qty || 0)) {
        toast.error(`Total quantity for this item cannot exceed ${selectedItem.available_qty}`);
        return;
      }
      updated[existingIndex].qty = newQty;
      setTransferLines(updated);
    } else {
      setTransferLines((prev) => [
        ...prev,
        {
          inventory_item_id: selectedItem.inventory_item_id,
          product_name: selectedItem.product_name,
          product_code: selectedItem.product_code,
          variant: selectedItem.variant,
          lot_number: selectedItem.lot_number,
          available_qty: selectedItem.available_qty,
          unit_price: selectedItem.unit_price,
          qty,
        },
      ]);
    }

    setForm((p) => ({ ...p, inventory_item_id: "", qty: "" }));
  };

  const removeLine = (inventoryItemId) => {
    setTransferLines((prev) =>
      prev.filter((line) => String(line.inventory_item_id) !== String(inventoryItemId))
    );
  };

  return (
    <div className="min-h-screen figtree-regular space-y-6 bg-gray-50/70">
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
                <FiBox className="h-4 w-4" />
                Stock Transfer
              </div>
              <h2 className="mt-1 text-2xl font-semibold text-gray-950">Warehouse To Warehouse Transfer</h2>
              <p className="mt-1 text-sm text-gray-500">
                Move stock between warehouses with traceable transfer records.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium text-gray-500">Lines</p>
                <p className="text-lg font-semibold text-gray-950">{transferLines.length}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium text-gray-500">Transfer Qty</p>
                <p className="text-lg font-semibold text-gray-950">{transferSummary.qty}</p>
              </div>
              <div className="col-span-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 sm:col-span-1">
                <p className="text-xs font-medium text-blue-700">Total Value</p>
                <p className="text-lg font-semibold text-blue-900">{formatPrice(transferSummary.amount)}</p>
              </div>
            </div>
          </div>
        </div>

        <form className="space-y-5 p-5" onSubmit={submit}>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-4">
              <label className="mb-2 block text-sm font-semibold text-gray-700">From Warehouse</label>
              <Select
                value={selectedFromOption}
                onChange={(selected) =>
                  setForm((p) => {
                    const nextFrom = selected?.value || "";
                    return {
                      ...p,
                      from_warehouse_id: nextFrom,
                      inventory_item_id: "",
                      to_warehouse_id:
                        String(p.to_warehouse_id) === String(nextFrom) ? "" : p.to_warehouse_id,
                    };
                  })
                }
                options={warehouseOptions}
                isClearable
                placeholder="Select from warehouse"
                styles={selectStyles}
                classNamePrefix="react-select"
              />
            </div>

            <div className="hidden items-end justify-center pb-3 xl:flex xl:col-span-1">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <FiArrowRight className="h-5 w-5" />
              </span>
            </div>

            <div className="xl:col-span-4">
              <label className="mb-2 block text-sm font-semibold text-gray-700">To Warehouse</label>
              <Select
                value={selectedToOption}
                onChange={(selected) => setForm((p) => ({ ...p, to_warehouse_id: selected?.value || "" }))}
                options={warehouseOptions.map((option) => ({
                  ...option,
                  isDisabled: String(option.value) === String(form.from_warehouse_id),
                }))}
                isClearable
                placeholder="Select destination warehouse"
                styles={selectStyles}
                classNamePrefix="react-select"
              />
            </div>

            <div className="xl:col-span-3">
              <label className="mb-2 block text-sm font-semibold text-gray-700">Transfer Date</label>
              <input
                type="date"
                className="input input-bordered h-12 w-full rounded-lg border-gray-300 focus:border-blue-600 focus:outline-none"
                value={form.transfer_date}
                onChange={(e) => setForm((p) => ({ ...p, transfer_date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <label className="mb-2 block text-sm font-semibold text-gray-700">Product Stock Item</label>
                <Select
                  value={selectedProductOption}
                  onChange={(selected) =>
                    setForm((p) => ({ ...p, inventory_item_id: selected?.value || "" }))
                  }
                  options={itemOptions}
                  isClearable
                  isSearchable
                  isDisabled={!form.from_warehouse_id}
                  placeholder={form.from_warehouse_id ? "Search product, code, variant, or lot" : "Select source warehouse first"}
                  styles={selectStyles}
                  classNamePrefix="react-select"
                  filterOption={(option, input) =>
                    option.data.searchLabel.toLowerCase().includes(input.toLowerCase())
                  }
                  formatOptionLabel={(option) => (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-900">{option.label}</span>
                        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          Qty {option.item.available_qty}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        Variant: {option.item.variant || "N/A"} | Lot: {option.item.lot_number || "N/A"} | Price: {formatPrice(option.item.unit_price || 0)}
                      </span>
                    </div>
                  )}
                />
              </div>

              <div className="lg:col-span-3">
                <label className="mb-2 block text-sm font-semibold text-gray-700">Transfer Qty</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="input input-bordered h-12 w-full rounded-lg border-gray-300 focus:border-blue-600 focus:outline-none"
                  placeholder="0.00"
                  value={form.qty}
                  onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))}
                />
              </div>

              <div className="flex items-end lg:col-span-2">
                <button
                  type="button"
                  className="btn h-12 w-full rounded-lg border-0 bg-blue-600 text-white hover:bg-blue-700"
                  onClick={addLine}
                >
                  <FiPlus className="h-4 w-4" />
                  Add Line
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-medium uppercase text-gray-400">Available Stock</p>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {selectedItem ? Number(selectedItem.available_qty || 0) : "Select item"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-medium uppercase text-gray-400">Unit Price</p>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {selectedItem ? formatPrice(selectedItem.unit_price || 0) : formatPrice(0)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-medium uppercase text-gray-400">After Transfer</p>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {selectedItem
                    ? Math.max(Number(selectedItem.available_qty || 0) - Number(form.qty || 0), 0)
                    : "Select item"}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Note</label>
            <input
              type="text"
              className="input input-bordered h-12 w-full rounded-lg border-gray-300 focus:border-blue-600 focus:outline-none"
              placeholder="Optional transfer note"
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <h3 className="font-semibold text-gray-950">Transfer Lines</h3>
                <p className="text-xs text-gray-500">Products queued for this warehouse transfer.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <th>Product</th>
                    <th>Variant</th>
                    <th>Lot</th>
                    <th className="text-right">Before Qty</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">After Qty</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transferLines.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                            <FiBox className="h-6 w-6" />
                          </div>
                          <p className="mt-3 font-semibold text-gray-900">No product line added</p>
                          <p className="mt-1 text-sm text-gray-500">
                            Search a stock item, enter quantity, then add it to the transfer.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : transferLines.map((line) => (
                    <tr key={line.inventory_item_id} className="hover:bg-gray-50">
                      <td>
                        <div className="font-medium text-gray-950">{line.product_name}</div>
                        <div className="text-xs text-gray-500">{line.product_code}</div>
                      </td>
                      <td>{line.variant || "N/A"}</td>
                      <td>{line.lot_number || "N/A"}</td>
                      <td className="text-right">{Number(line.available_qty || 0)}</td>
                      <td className="text-right font-semibold text-blue-700">{line.qty}</td>
                      <td className="text-right">{Math.max(Number(line.available_qty || 0) - Number(line.qty || 0), 0)}</td>
                      <td className="text-right">{formatPrice(line.unit_price || 0)}</td>
                      <td className="text-right font-semibold">{formatPrice((Number(line.qty) || 0) * (Number(line.unit_price) || 0))}</td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => removeLine(line.inventory_item_id)}
                          aria-label={`Remove ${line.product_name}`}
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FiCheckCircle className="h-4 w-4 text-green-600" />
              Review transfer lines before creating the record.
            </div>
            <button className="btn h-12 rounded-lg border-0 bg-indigo-600 px-6 text-white hover:bg-indigo-700" disabled={saving}>
              {saving ? "Transferring..." : "Create Transfer"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
              <FiClock className="h-4 w-4" />
              History
            </div>
            <h3 className="mt-1 text-lg font-semibold text-gray-950">Recent Transfers</h3>
          </div>
        </div>
        <div className="overflow-x-auto p-5">
          <table className="table">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th>No</th>
                <th>Date</th>
                <th>From</th>
                <th>To</th>
                <th className="text-right">Items</th>
                <th className="text-right">Before Qty</th>
                <th className="text-right">Qty</th>
                <th className="text-right">After Qty</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-6 text-center text-gray-500">Loading transfers...</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={9} className="py-6 text-center text-gray-500">No transfer found</td></tr>
              ) : history.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="font-medium text-gray-950">{r.transfer_no}</td>
                  <td>{r.transfer_date}</td>
                  <td>{r.from_warehouse}</td>
                  <td>{r.to_warehouse}</td>
                  <td className="text-right">{r.items_count}</td>
                  <td className="text-right">{Number(r.total_before_qty || 0)}</td>
                  <td className="text-right font-semibold text-blue-700">{r.total_qty}</td>
                  <td className="text-right">{Number(r.total_after_qty || 0)}</td>
                  <td className="text-right font-semibold">{formatPrice(r.total_amount || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
