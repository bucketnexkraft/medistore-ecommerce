import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  PiBarcode,
  PiCalendarBlank,
  PiFloppyDisk,
  PiMagnifyingGlass,
  PiNotePencil,
  PiPackage,
  PiPlus,
  PiReceipt,
  PiTrash,
  PiX,
} from "react-icons/pi";
import Select from "react-select";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import TableLoading from "../../components/loadings/TableLoading";
import Pagination from "../../components/common/Pagination";
import { closeModal } from "../../hooks/modalConfig";
import { getAllProduct } from "../../api/products";
import {
  createBarcodeStore,
  deleteBarcodeStore,
  deleteMultipleBarcodeStore,
  getBarcodeStoreList,
  updateBarcodeStore,
} from "../../api/barcodeStore";
import { getAllInvoices } from "../../api/purchase";
import noImage from "../../../public/images/no-images/no-img.jpg";

export default function BarcodeList() {
  const accessToken = useSelector((state) => state.auth.accessToken);

  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadData, setLoadData] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [data, setData] = useState({ data: [], meta: {} });
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState("");
  const barcodeInputRef = useRef(null);
  const createDialogRef = useRef(null);
  const editDialogRef = useRef(null);
  const [form, setForm] = useState({
    product_id: "",
    invoice_no: "",
    note: "",
    date: new Date().toISOString().split("T")[0],
    barcodes: [],
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editErrors, setEditErrors] = useState("");
  const [editForm, setEditForm] = useState({
    id: "",
    product_id: "",
    invoice_no: "",
    note: "",
    date: "",
    barcode: "",
  });

  const fetchProducts = useCallback(async () => {
    try {
      const res = await getAllProduct(accessToken);
      if (res?.status) {
        setProducts(Array.isArray(res.data) ? res.data : []);
      }
    } catch (error) {
      toast.error("Failed to load products", { className: "alert alert-error" });
    }
  }, [accessToken]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getBarcodeStoreList(accessToken, {
        perPage,
        page: currentPage,
        search: searchQuery,
        sortField: "created_at",
        sortOrder: "desc",
      });

      if (!result?.status) {
        throw new Error(result?.error?.message || result?.message || "Failed to fetch");
      }

      setData({
        data: result.data || [],
        meta: result.meta || {},
      });
    } catch (error) {
      toast.error(error.message || "Failed to load barcode list", {
        className: "alert alert-error",
      });
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [accessToken, currentPage, perPage, searchQuery]);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await getAllInvoices(accessToken);
      if (!res?.status) {
        throw new Error(res?.error?.message || res?.message || "Failed to load invoices");
      }
      setInvoices(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error(error.message || "Failed to load invoices", {
        className: "alert alert-error",
      });
    }
  }, [accessToken]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    if (loadData) fetchData();
  }, [fetchData, loadData]);

  useEffect(() => {
    const visibleIds = Array.isArray(data.data) ? data.data.map((row) => row.id) : [];
    setSelectedIds((prev) => prev.filter((id) => visibleIds.includes(id)));
  }, [data.data]);

  const parseBarcodeInput = (input) => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return [];

    let barcodeArray = [];

    if (trimmedInput.includes(";")) {
      const parts = trimmedInput.split(";").map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 3) {
        barcodeArray = parts.slice(3);
        if (barcodeArray.length === 0 && parts[1]) barcodeArray = [parts[1]];
      } else {
        barcodeArray = parts;
      }
    } else if (trimmedInput.startsWith("T") && trimmedInput.includes("M")) {
      const parts = trimmedInput.split("M").map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 3) {
        barcodeArray = parts.slice(3).map((serial) =>
          serial.startsWith("M") ? serial : `M${serial}`
        );
      } else {
        barcodeArray = [trimmedInput];
      }
    } else if (trimmedInput.includes(" ")) {
      barcodeArray = trimmedInput.split(/\s+/).map((code) => code.trim()).filter(Boolean);
    } else if (trimmedInput.includes(".")) {
      barcodeArray = trimmedInput.split(".").map((code) => code.trim()).filter(Boolean);
    } else {
      const matches = trimmedInput.match(/([A-Z]\d+)/g);
      barcodeArray = matches && matches.length > 0 ? matches : [trimmedInput];
    }

    return barcodeArray;
  };

  const handleBarcodeInputScan = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const input = e.target.value.trim();
    if (!input) return;

    const barcodeArray = parseBarcodeInput(input);
    const barcodeRegex = /^[a-zA-Z0-9\-_.]+$/;

    setForm((prev) => {
      let nextBarcodes = [...prev.barcodes];
      for (const barcode of barcodeArray) {
        if (!barcodeRegex.test(barcode)) {
          toast.error(`Invalid barcode format: "${barcode}"`);
          continue;
        }
        if (nextBarcodes.includes(barcode)) {
          toast.warn(`Barcode "${barcode}" already exists`);
          continue;
        }
        nextBarcodes = [barcode, ...nextBarcodes];
      }
      return { ...prev, barcodes: nextBarcodes };
    });

    e.target.value = "";
    barcodeInputRef.current?.focus();
  };

  const removeBarcodeAt = (index) => {
    setForm((prev) => ({
      ...prev,
      barcodes: prev.barcodes.filter((_, i) => i !== index),
    }));
  };

  const handleSearch = () => {
    setCurrentPage(1);
    setLoadData(true);
  };

  const openCreateModal = () => {
    setFormErrors("");
    setForm({
      product_id: "",
      invoice_no: "",
      note: "",
      date: new Date().toISOString().split("T")[0],
      barcodes: [],
    });
    document.getElementById("create_barcode_store_modal").showModal();
    setTimeout(() => barcodeInputRef.current?.focus(), 60);
  };

  const openEditModal = (row) => {
    setEditErrors("");
    setEditForm({
      id: row.id,
      product_id: row.product_id || "",
      invoice_no: row.invoice_no || "",
      note: row.note || "",
      date: row.date ? String(row.date).split("T")[0] : "",
      barcode: row.barcode || "",
    });
    document.getElementById("edit_barcode_store_modal").showModal();
  };

  const productOptions = products.map((product) => ({
    value: product.id,
    label: `${product.name} (${product.code || "N/A"})`,
  }));

  const invoiceOptions = invoices
    .filter((invoice) => Boolean(invoice?.invoice_no))
    .map((invoice) => ({
      value: invoice.invoice_no,
      label: `${invoice.invoice_no} (${invoice.type || "N/A"})`,
      date: invoice.date ? String(invoice.date).split("T")[0] : "",
    }));

  const selectedProductOption = productOptions.find((opt) => opt.value === form.product_id) || null;
  const selectedInvoiceOption = invoiceOptions.find((opt) => opt.value === form.invoice_no) || null;
  const selectedEditProductOption =
    productOptions.find((opt) => opt.value === editForm.product_id) || null;
  const selectedEditInvoiceOption =
    invoiceOptions.find((opt) => opt.value === editForm.invoice_no) || null;
  const visibleRows = Array.isArray(data.data) ? data.data : [];
  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id));
  const totalRecords = data?.meta?.total ?? visibleRows.length;
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: 44,
      borderRadius: 8,
      borderColor: state.isFocused ? "#2563eb" : "#cbd5e1",
      boxShadow: state.isFocused ? "0 0 0 3px rgba(37, 99, 235, 0.12)" : "none",
      "&:hover": { borderColor: state.isFocused ? "#2563eb" : "#94a3b8" },
    }),
    valueContainer: (base) => ({ ...base, padding: "0 12px" }),
    placeholder: (base) => ({ ...base, color: "#94a3b8" }),
    indicatorSeparator: (base) => ({ ...base, backgroundColor: "#e2e8f0" }),
    menuPortal: (base) => ({ ...base, zIndex: 99999 }),
    menu: (base) => ({ ...base, zIndex: 99999, borderRadius: 8, overflow: "hidden" }),
  };
  const fieldLabelClass = "mb-1.5 block text-sm font-semibold text-slate-700";
  const inputClass =
    "input input-bordered h-11 min-h-11 w-full rounded-lg border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100";
  const textareaClass =
    "textarea textarea-bordered w-full rounded-lg border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100";

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const visibleIds = visibleRows.map((row) => row.id);
      if (allVisibleSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }
      const next = new Set([...prev, ...visibleIds]);
      return Array.from(next);
    });
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    setFormErrors("");

    if (!form.product_id) {
      setFormErrors("Please select a product.");
      return;
    }
    if (!form.date) {
      setFormErrors("Please select a date.");
      return;
    }
    if (!Array.isArray(form.barcodes) || form.barcodes.length === 0) {
      setFormErrors("Please scan at least one barcode.");
      return;
    }

    try {
      setSaving(true);
      const res = await createBarcodeStore(accessToken, {
        product_id: form.product_id,
        invoice_no: form.invoice_no,
        note: form.note,
        date: form.date,
        barcodes: form.barcodes,
      });

      if (!res?.status) {
        const errorMessage = res?.error?.errors
          ? Object.values(res.error.errors).flat().join("\n")
          : res?.error?.message || res?.message || "Failed to save barcodes";
        throw new Error(errorMessage);
      }

      toast.success("Barcodes stored successfully");
      closeModal("create_barcode_store_modal");
      setCurrentPage(1);
      setLoadData(true);
    } catch (error) {
      setFormErrors(error.message || "Failed to save barcodes");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    setEditErrors("");

    if (!editForm.product_id) {
      setEditErrors("Please select a product.");
      return;
    }
    if (!editForm.date) {
      setEditErrors("Please select a date.");
      return;
    }
    if (!editForm.barcode?.trim()) {
      setEditErrors("Please enter a barcode.");
      return;
    }

    try {
      setEditing(true);
      const res = await updateBarcodeStore(accessToken, editForm.id, {
        product_id: editForm.product_id,
        invoice_no: editForm.invoice_no,
        note: editForm.note,
        date: editForm.date,
        barcode: editForm.barcode.trim(),
      });

      if (!res?.status) {
        const errorMessage = res?.error?.errors
          ? Object.values(res.error.errors).flat().join("\n")
          : res?.error?.message || res?.message || "Failed to update barcode";
        throw new Error(errorMessage);
      }

      toast.success("Barcode updated successfully");
      closeModal("edit_barcode_store_modal");
      setLoadData(true);
    } catch (error) {
      setEditErrors(error.message || "Failed to update barcode");
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteOne = async (id) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });
    if (!result.isConfirmed) return;

    try {
      setDeletingId(id);
      const res = await deleteBarcodeStore(accessToken, id);
      if (!res?.status) {
        throw new Error(res?.error?.message || res?.message || "Failed to delete barcode");
      }
      toast.success("Barcode deleted successfully");
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      setLoadData(true);
    } catch (error) {
      toast.error(error.message || "Failed to delete barcode", {
        className: "alert alert-error",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete ${selectedIds.length} barcodes. This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete them!",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;

    try {
      setBulkDeleting(true);
      const res = await deleteMultipleBarcodeStore(accessToken, selectedIds);
      if (!res?.status) {
        throw new Error(res?.error?.message || res?.message || "Failed to delete selected barcodes");
      }
      toast.success("Selected barcodes deleted successfully");
      setSelectedIds([]);
      setLoadData(true);
    } catch (error) {
      toast.error(error.message || "Failed to delete selected barcodes", {
        className: "alert alert-error",
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="figtree-regular min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6">
      <div className="mb-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/80">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <PiBarcode fontSize={24} />
            </div>
            <h2 className="text-2xl font-bold text-slate-950">Barcode Store</h2>
            <p className="mt-1 text-sm text-slate-500">
              Store and manage standalone product barcodes without purchase or sale relation.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase text-slate-500">Records</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{totalRecords}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase text-slate-500">Selected</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{selectedIds.length}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/70 p-4">
          <div className="relative max-w-3xl">
            <PiMagnifyingGlass
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              fontSize={21}
            />
            <input
              type="text"
              placeholder="Search product, invoice, or barcode"
              className={`${inputClass} pl-12 pr-28`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setLoadData(true);
              }}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              onClick={handleSearch}
              className="btn btn-primary absolute right-1.5 top-1/2 h-8 min-h-8 -translate-y-1/2 rounded-md px-4 text-white"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      <dialog id="create_barcode_store_modal" className="modal" ref={createDialogRef}>
        <div className="modal-box flex max-h-[92vh] w-11/12 max-w-4xl flex-col overflow-visible rounded-lg border border-slate-200 bg-white p-0 shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <PiBarcode fontSize={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-950">Add Barcode Record</h3>
                <p className="text-xs text-slate-500">Scan one barcode or paste multiple values.</p>
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm btn-square rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={() => closeModal("create_barcode_store_modal")}
              disabled={saving}
              title="Close"
            >
              <PiX fontSize={20} />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {formErrors && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formErrors.split("\n").map((msg, i) => <p key={i}>{msg}</p>)}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={fieldLabelClass}>Product</label>
                <Select
                  value={selectedProductOption}
                  onChange={(selected) =>
                    setForm((prev) => ({ ...prev, product_id: selected?.value || "" }))
                  }
                  options={productOptions}
                  isClearable
                  placeholder="Select Product"
                  className="react-select-container"
                  classNamePrefix="react-select"
                  menuPortalTarget={createDialogRef.current || undefined}
                  menuPosition="fixed"
                  menuPlacement="auto"
                  menuShouldScrollIntoView={false}
                  styles={selectStyles}
                />
              </div>

              <div>
                <label className={fieldLabelClass}>Date</label>
                <div className="relative">
                  <PiCalendarBlank
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    fontSize={18}
                  />
                  <input
                    type="date"
                    className={`${inputClass} pl-10`}
                    value={form.date}
                    onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className={fieldLabelClass}>Invoice No</label>
                <Select
                  value={selectedInvoiceOption}
                  onChange={(selected) =>
                    setForm((prev) => ({
                      ...prev,
                      invoice_no: selected?.value || "",
                      date: selected?.date || prev.date,
                    }))
                  }
                  options={invoiceOptions}
                  isClearable
                  placeholder="Select Invoice"
                  className="react-select-container"
                  classNamePrefix="react-select"
                  menuPortalTarget={createDialogRef.current || undefined}
                  menuPosition="fixed"
                  menuPlacement="auto"
                  menuShouldScrollIntoView={false}
                  styles={selectStyles}
                />
              </div>
            </div>

            <div>
              <label className={fieldLabelClass}>Note</label>
              <textarea
                className={textareaClass}
                placeholder="Enter note (optional)"
                value={form.note}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                rows={4}
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <label className={fieldLabelClass}>Scan Barcodes</label>
                  <p className="text-xs text-slate-500">
                    Supports semicolon, M format, space, or dot-separated values.
                  </p>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                  <PiBarcode fontSize={16} />
                  {form.barcodes.length} total
                </span>
              </div>
              <input
                type="text"
                className={inputClass}
                placeholder="Scan barcode and press Enter"
                onKeyDown={handleBarcodeInputScan}
                ref={barcodeInputRef}
              />

              <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
                {form.barcodes.length === 0 ? (
                  <div className="flex min-h-20 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                    No barcodes added yet.
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {form.barcodes.map((barcode, index) => (
                      <div
                        key={`${barcode}-${index}`}
                        className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <span className="truncate font-mono text-sm font-semibold text-slate-800">
                          {barcode}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square ml-auto rounded-md text-red-600 hover:bg-red-50"
                          onClick={() => removeBarcodeAt(index)}
                          title="Remove barcode"
                        >
                          <PiX fontSize={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
            <button
              className="btn btn-ghost h-10 min-h-10 rounded-lg px-5"
              onClick={() => closeModal("create_barcode_store_modal")}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className={`btn btn-primary h-10 min-h-10 rounded-lg px-5 text-white ${saving ? "loading" : ""}`}
              onClick={handleSave}
              disabled={saving}
            >
              <PiFloppyDisk fontSize={18} />
              Save
            </button>
          </div>
        </div>
      </dialog>

      <dialog id="edit_barcode_store_modal" className="modal" ref={editDialogRef}>
        <div className="modal-box flex max-h-[92vh] w-11/12 max-w-4xl flex-col overflow-visible rounded-lg border border-slate-200 bg-white p-0 shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <PiNotePencil fontSize={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-950">Edit Barcode Record</h3>
                <p className="text-xs text-slate-500">Update barcode details and product reference.</p>
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm btn-square rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={() => closeModal("edit_barcode_store_modal")}
              disabled={editing}
              title="Close"
            >
              <PiX fontSize={20} />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {editErrors && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {editErrors.split("\n").map((msg, i) => <p key={i}>{msg}</p>)}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={fieldLabelClass}>Product</label>
                <Select
                  value={selectedEditProductOption}
                  onChange={(selected) =>
                    setEditForm((prev) => ({ ...prev, product_id: selected?.value || "" }))
                  }
                  options={productOptions}
                  isClearable
                  placeholder="Select Product"
                  className="react-select-container"
                  classNamePrefix="react-select"
                  menuPortalTarget={editDialogRef.current || undefined}
                  menuPosition="fixed"
                  menuPlacement="auto"
                  menuShouldScrollIntoView={false}
                  styles={selectStyles}
                />
              </div>

              <div>
                <label className={fieldLabelClass}>Date</label>
                <div className="relative">
                  <PiCalendarBlank
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    fontSize={18}
                  />
                  <input
                    type="date"
                    className={`${inputClass} pl-10`}
                    value={editForm.date}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className={fieldLabelClass}>Invoice No</label>
                <Select
                  value={selectedEditInvoiceOption}
                  onChange={(selected) =>
                    setEditForm((prev) => ({
                      ...prev,
                      invoice_no: selected?.value || "",
                      date: selected?.date || prev.date,
                    }))
                  }
                  options={invoiceOptions}
                  isClearable
                  placeholder="Select Invoice"
                  className="react-select-container"
                  classNamePrefix="react-select"
                  menuPortalTarget={editDialogRef.current || undefined}
                  menuPosition="fixed"
                  menuPlacement="auto"
                  menuShouldScrollIntoView={false}
                  styles={selectStyles}
                />
              </div>
            </div>

            <div>
              <label className={fieldLabelClass}>Barcode</label>
              <input
                type="text"
                className={`${inputClass} font-mono font-semibold`}
                placeholder="Enter barcode"
                value={editForm.barcode}
                onChange={(e) => setEditForm((prev) => ({ ...prev, barcode: e.target.value }))}
              />
            </div>

            <div>
              <label className={fieldLabelClass}>Note</label>
              <textarea
                className={textareaClass}
                placeholder="Enter note (optional)"
                value={editForm.note}
                onChange={(e) => setEditForm((prev) => ({ ...prev, note: e.target.value }))}
                rows={4}
              />
            </div>
          </div>

          <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
            <button
              className="btn btn-ghost h-10 min-h-10 rounded-lg px-5"
              onClick={() => closeModal("edit_barcode_store_modal")}
              disabled={editing}
            >
              Cancel
            </button>
            <button
              className={`btn btn-primary h-10 min-h-10 rounded-lg px-5 text-white ${editing ? "loading" : ""}`}
              onClick={handleUpdate}
              disabled={editing}
            >
              <PiFloppyDisk fontSize={18} />
              Update
            </button>
          </div>
        </div>
      </dialog>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/80">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h5 className="font-bold text-slate-900">Barcode Records</h5>
            <p className="text-sm text-slate-500">Review, edit, and remove stored barcode entries.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedIds.length > 1 && (
              <button
                className={`btn btn-outline btn-error h-10 min-h-10 rounded-lg ${bulkDeleting ? "loading" : ""}`}
                onClick={handleDeleteSelected}
                disabled={bulkDeleting}
                title="Delete Selected"
              >
                <PiTrash />
                Delete ({selectedIds.length})
              </button>
            )}
            <button className="btn btn-primary h-10 min-h-10 rounded-lg px-4 text-white" onClick={openCreateModal}>
              <PiPlus /> Add Barcode
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <TableLoading />
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr className="bg-slate-100 text-xs font-bold uppercase text-slate-500">
                    <th>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                      />
                    </th>
                    <th>Date</th>
                    <th>Invoice</th>
                    <th>Product</th>
                    <th>Barcode</th>
                    <th>Note</th>
                    <th className="w-2/12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(data.data) && data.data.length > 0 ? (
                    data.data.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-b border-slate-100 text-sm text-slate-700 hover:bg-slate-50 ${
                          selectedIds.includes(row.id) ? "bg-blue-50" : ""
                        }`}
                      >
                        <td>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={selectedIds.includes(row.id)}
                            onChange={() => toggleSelectOne(row.id)}
                          />
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-700">
                            <PiCalendarBlank className="text-slate-400" fontSize={16} />
                            {row.date ? new Date(row.date).toLocaleDateString() : "N/A"}
                          </span>
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-sm font-semibold text-blue-700">
                            <PiReceipt fontSize={15} />
                            {row.invoice_no || "N/A"}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="avatar">
                              <div className="h-11 w-11 rounded-lg border border-slate-200 bg-slate-100">
                                <img src={row.product_thumbnail || noImage} alt={row.product_name || "Product"} />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p className="max-w-56 truncate text-sm font-semibold text-slate-900">
                                {row.product_name || "N/A"}
                              </p>
                              <p className="flex items-center gap-1 text-xs text-slate-500">
                                <PiPackage fontSize={13} />
                                {row.product_code || "N/A"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="inline-flex max-w-56 items-center rounded-md bg-slate-100 px-2.5 py-1 font-mono text-sm font-bold text-slate-800">
                            <span className="truncate">{row.barcode}</span>
                          </span>
                        </td>
                        <td>
                          <span className="line-clamp-2 max-w-xs text-slate-500">{row.note || "N/A"}</span>
                        </td>
                        <td className="w-2/12">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-square rounded-lg border-none bg-blue-50 text-blue-700 hover:bg-blue-100"
                              onClick={() => openEditModal(row)}
                              title="Edit Barcode"
                            >
                              <PiNotePencil fontSize={16} />
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm btn-square rounded-lg border-none bg-red-50 text-red-600 hover:bg-red-100 ${
                                deletingId === row.id ? "loading" : ""
                              }`}
                              onClick={() => handleDeleteOne(row.id)}
                              disabled={deletingId === row.id}
                              title="Delete Barcode"
                            >
                              <PiTrash fontSize={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center py-4">
                        No barcode found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {data?.meta?.last_page > 1 && (
                <Pagination
                  currentPage={data.meta.current_page}
                  lastPage={data.meta.last_page}
                  handlePrevious={() => { setCurrentPage((p) => Math.max(p - 1, 1)); setLoadData(true); }}
                  handlePageChange={(page) => { setCurrentPage(page); setLoadData(true); }}
                  handleNextPage={() => { setCurrentPage((p) => p + 1); setLoadData(true); }}
                  showPrevious={currentPage > 1}
                  showNext={currentPage < data.meta.last_page}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
