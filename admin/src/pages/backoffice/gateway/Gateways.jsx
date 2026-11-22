import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { PiMagnifyingGlass, PiNotePencil, PiPlus, PiSliders, PiTrash } from "react-icons/pi";
import Pagination from "../../../components/common/Pagination";
import TableLoading from "../../../components/loadings/TableLoading";
import {
  getBackofficeGateway,
  getBackofficeGateways,
  updateBackofficeGateway,
} from "../../../api/backoffice/gateway";

const DEFAULT_PARAM = { name: "", label: "", type: "text", is_required: false };

const buildValidationMessage = (error) => {
  const errors = error?.response?.data?.errors;

  if (Array.isArray(errors) && errors.length) {
    return errors.join(" | ");
  }

  if (errors && typeof errors === "object") {
    const flat = Object.values(errors).flat().filter(Boolean);
    if (flat.length) {
      return flat.join(" | ");
    }
  }

  return error?.response?.data?.message || error?.message || "Failed to update gateway";
};

export default function Gateways() {
  const accessToken = useSelector((state) => state.auth.accessToken);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [page, setPage] = useState(1);
  const filterRef = useRef(null);
  const [list, setList] = useState([]);
  const [meta, setMeta] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const [editingGateway, setEditingGateway] = useState(null);
  const [currencies, setCurrencies] = useState([]);
  const [form, setForm] = useState({
    name: "",
    currency_id: "",
    charge: "0",
    charge_type: "fixed",
    status: true,
    description: "",
    gateway_type: "autometic",
    image: null,
    image_url: "",
    parameters: [],
  });

  const loadGateways = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getBackofficeGateways(accessToken, {
        page,
        perPage: 20,
        keyword,
        status,
      });
      if (!result?.status) {
        throw new Error(result?.message || "Failed to load gateways");
      }
      setList(result?.data || []);
      setMeta(result?.meta || meta);
    } catch (error) {
      toast.error(error?.message || "Failed to load gateways");
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, keyword, status]);

  useEffect(() => {
    loadGateways();
  }, [loadGateways]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsAdvancedOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearch = () => {
    if (page !== 1) {
      setPage(1);
    } else {
      loadGateways();
    }
    setIsAdvancedOpen(false);
  };

  const resetFilters = () => {
    setKeyword("");
    setStatus("");
    if (page !== 1) {
      setPage(1);
    } else {
      loadGateways();
    }
    setIsAdvancedOpen(false);
  };

  const openEdit = async (gateway) => {
    try {
      setModalError("");
      const result = await getBackofficeGateway(accessToken, gateway.id);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to load gateway");
      }
      const payload = result?.data?.gateway || {};
      const currenciesData = result?.data?.currencies || [];
      const isManual = payload.gateway_type === "manual";
      let parameters = payload.parameters || (isManual ? [] : {});
      if (isManual && !Array.isArray(parameters)) {
        parameters = [];
      }
      if (!isManual && Array.isArray(parameters)) {
        parameters = {};
      }
      setCurrencies(currenciesData);
      setEditingGateway(payload);
      setForm({
        name: payload.name || "",
        currency_id: payload.currency_id || "",
        charge: String(payload.charge ?? 0),
        charge_type: payload.charge_type || "fixed",
        status: Boolean(payload.status),
        description: payload.description || "",
        gateway_type: payload.gateway_type || "autometic",
        image: null,
        image_url: payload.image_url || "",
        parameters,
      });
      setIsModalOpen(true);
    } catch (error) {
      toast.error(error?.message || "Failed to load gateway");
    }
  };

  const addManualParam = () => {
    setForm((prev) => ({
      ...prev,
      parameters: Array.isArray(prev.parameters)
        ? [...prev.parameters, { ...DEFAULT_PARAM }]
        : [{ ...DEFAULT_PARAM }],
    }));
  };

  const removeManualParam = (index) => {
    setForm((prev) => ({
      ...prev,
      parameters: Array.isArray(prev.parameters)
        ? prev.parameters.filter((_, i) => i !== index)
        : [],
    }));
  };

  const updateManualParam = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      parameters: Array.isArray(prev.parameters)
        ? prev.parameters.map((item, i) => (i === index ? { ...item, [field]: value } : item))
        : [],
    }));
  };

  const updateAutoParam = (key, value) => {
    setForm((prev) => ({
      ...prev,
      parameters: {
        ...(Array.isArray(prev.parameters) ? {} : prev.parameters),
        [key]: value,
      },
    }));
  };

  const saveGateway = async () => {
    if (!editingGateway) return;
    setSaving(true);
    setModalError("");
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("currency_id", form.currency_id);
      fd.append("charge", form.charge);
      fd.append("charge_type", form.charge_type);
      fd.append("status", form.status ? "1" : "0");
      fd.append("description", form.description || "");
      fd.append("parameters", JSON.stringify(form.parameters || (form.gateway_type === "manual" ? [] : {})));
      if (form.image instanceof File) {
        fd.append("image", form.image, form.image.name);
      }

      const result = await updateBackofficeGateway(accessToken, editingGateway.id, fd);
      if (!result?.status) {
        throw new Error(result?.message || "Failed to update gateway");
      }
      toast.success("Gateway updated successfully");
      setIsModalOpen(false);
      loadGateways();
    } catch (error) {
      setModalError(buildValidationMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-xl font-semibold">Payment Gateways</h2>
        <p className="text-sm text-gray-600 mt-1">
          Manage gateway status, charges and configuration parameters.
        </p>

        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search gateway..."
                className="input w-full pr-16 focus:outline-none focus:border-none"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <div className="absolute right-1 w-full max-w-16 flex items-center justify-end gap-0.5">
                <button
                  onClick={handleSearch}
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  title="Search"
                >
                  <PiMagnifyingGlass className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsAdvancedOpen((prev) => !prev)}
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  title="Advanced Search"
                >
                  <PiSliders className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {isAdvancedOpen && (
            <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 flex flex-wrap gap-4">
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label">
                  <span className="label-text">Gateway Status</span>
                </label>
                <select
                  className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="w-full flex justify-end gap-2">
                <button
                  className="btn btn-error btn-outline h-10 min-h-10"
                  onClick={resetFilters}
                >
                  Reset
                </button>
                <button className="btn h-10 min-h-10" onClick={handleSearch}>
                  Search
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="overflow-x-auto">
          {loading ? (
            <TableLoading />
          ) : (
            <table className="table">
              <thead>
                <tr className="bg-gray-100">
                  <th>Gateway</th>
                  <th>Currency</th>
                  <th>Charge</th>
                  <th>Status</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6">No gateways found.</td>
                  </tr>
                ) : (
                  list.map((gateway) => (
                    <tr key={gateway.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          {gateway.image_url ? (
                            <img src={gateway.image_url} alt={gateway.name} className="w-10 h-10 rounded object-contain border" />
                          ) : (
                            <div className="w-10 h-10 rounded border bg-gray-100" />
                          )}
                          <div className="font-medium">{gateway.name}</div>
                        </div>
                      </td>
                      <td>{gateway.currency?.code || "N/A"}</td>
                      <td>
                        {Number(gateway.charge).toFixed(2)}
                        {gateway.charge_type === "percent" ? "%" : ""}
                      </td>
                      <td>
                        <span className={`badge ${gateway.status ? "badge-success" : "badge-error"} text-white`}>
                          {gateway.status ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-center">
                          <button
                            className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                            onClick={() => openEdit(gateway)}
                            title="Edit Gateway"
                          >
                            <PiNotePencil size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={meta.current_page || 1}
          lastPage={meta.last_page || 1}
          handlePrevious={() => setPage((prev) => Math.max(prev - 1, 1))}
          handlePageChange={setPage}
          handleNextPage={() => setPage((prev) => Math.min(prev + 1, meta.last_page || 1))}
          showPrevious={(meta.current_page || 1) > 1}
          showNext={(meta.current_page || 1) < (meta.last_page || 1)}
        />
      </div>

      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg">Edit Gateway</h3>
            {modalError && (
              <div className="alert alert-error mt-3 py-2">
                <span>{modalError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div>
                <label className="label py-1"><span className="label-text">Gateway Name</span></label>
                <input className="input input-bordered w-full" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="label py-1"><span className="label-text">Currency</span></label>
                <select className="select select-bordered w-full" value={form.currency_id} onChange={(e) => setForm((p) => ({ ...p, currency_id: e.target.value }))}>
                  <option value="">Select</option>
                  {currencies.map((currency) => (
                    <option key={currency.id} value={currency.id}>{currency.code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label py-1"><span className="label-text">Charge</span></label>
                <input type="number" min="0" className="input input-bordered w-full" value={form.charge} onChange={(e) => setForm((p) => ({ ...p, charge: e.target.value }))} />
              </div>
              <div>
                <label className="label py-1"><span className="label-text">Charge Type</span></label>
                <select className="select select-bordered w-full" value={form.charge_type} onChange={(e) => setForm((p) => ({ ...p, charge_type: e.target.value }))}>
                  <option value="fixed">Fixed</option>
                  <option value="percent">Percent</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label py-1"><span className="label-text">Gateway Image</span></label>
                <input type="file" accept="image/*" className="file-input file-input-bordered w-full" onChange={(e) => setForm((p) => ({ ...p, image: e.target.files?.[0] || null }))} />
                {(form.image_url || form.image) && (
                  <img src={form.image instanceof File ? URL.createObjectURL(form.image) : form.image_url} alt="Gateway preview" className="mt-2 h-16 rounded border object-contain" />
                )}
              </div>
              <div className="md:col-span-2">
                <label className="cursor-pointer label justify-start gap-3">
                  <input type="checkbox" className="checkbox checkbox-primary" checked={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.checked }))} />
                  <span className="label-text">Gateway Active</span>
                </label>
              </div>

              {form.gateway_type === "manual" ? (
                <div className="md:col-span-2">
                  <label className="label py-1"><span className="label-text">Payment Instruction</span></label>
                  <textarea className="textarea textarea-bordered w-full mb-3" rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Requirements</span>
                    <button type="button" className="btn btn-sm btn-outline" onClick={addManualParam}>
                      <PiPlus /> Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(Array.isArray(form.parameters) ? form.parameters : []).map((param, idx) => (
                      <div key={`manual-param-${idx}`} className="grid grid-cols-1 md:grid-cols-5 gap-2 border rounded-lg p-2">
                        <input className="input input-bordered" placeholder="name" value={param.name || ""} onChange={(e) => updateManualParam(idx, "name", e.target.value.replace(/[^a-z0-9_]/gi, ""))} />
                        <input className="input input-bordered" placeholder="label" value={param.label || ""} onChange={(e) => updateManualParam(idx, "label", e.target.value)} />
                        <select className="select select-bordered" value={param.type || "text"} onChange={(e) => updateManualParam(idx, "type", e.target.value)}>
                          <option value="text">Text</option>
                          <option value="file">File</option>
                          <option value="textarea">Textarea</option>
                        </select>
                        <select className="select select-bordered" value={param.is_required ? "1" : "0"} onChange={(e) => updateManualParam(idx, "is_required", e.target.value === "1")}>
                          <option value="0">Optional</option>
                          <option value="1">Required</option>
                        </select>
                        <button type="button" className="btn btn-error btn-outline" onClick={() => removeManualParam(idx)}>
                          <PiTrash />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="md:col-span-2">
                  <label className="label py-1"><span className="label-text">Gateway Configurations</span></label>
                  <div className="space-y-2">
                    {Object.entries(Array.isArray(form.parameters) ? {} : (form.parameters || {})).map(([key, value]) => (
                      <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                        <label className="font-medium">{key}</label>
                        <input className="input input-bordered md:col-span-2" value={value || ""} onChange={(e) => updateAutoParam(key, e.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setModalError("");
                  setIsModalOpen(false);
                }}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveGateway} disabled={saving}>
                {saving ? "Saving..." : "Update Gateway"}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => {
              setModalError("");
              setIsModalOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
