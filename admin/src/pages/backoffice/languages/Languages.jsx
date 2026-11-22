import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { FaPlus } from "react-icons/fa";
import { PiDownloadSimple, PiMagnifyingGlass, PiNotePencil, PiSliders, PiTrash } from "react-icons/pi";
import { useTranslation } from "react-i18next";
import Swal from "sweetalert2";
import {
  createBackofficeLanguage,
  deleteBackofficeLanguage,
  downloadEnglishTemplate,
  downloadLanguageJson,
  getBackofficeLanguages,
  updateBackofficeLanguage,
  uploadLanguageJson,
} from "../../../api/backoffice/languages";

const saveBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

export default function Languages() {
  const { t } = useTranslation();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadData, setLoadData] = useState(true);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const filterRef = useRef(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newLanguageName, setNewLanguageName] = useState("");
  const [newLanguageCode, setNewLanguageCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [createJsonFile, setCreateJsonFile] = useState(null);
  const [createImageFile, setCreateImageFile] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editLanguageId, setEditLanguageId] = useState(null);
  const [editLanguageName, setEditLanguageName] = useState("");
  const [editLanguageCode, setEditLanguageCode] = useState("");
  const [editLanguageImageUrl, setEditLanguageImageUrl] = useState("");
  const [updating, setUpdating] = useState(false);
  const [editJsonFile, setEditJsonFile] = useState(null);
  const [editImageFile, setEditImageFile] = useState(null);


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getBackofficeLanguages(accessToken);
      if (!result?.status) throw new Error(result?.message || "Failed to fetch languages");
      setRows(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to fetch languages");
    } finally {
      setLoading(false);
      setLoadData(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (loadData) fetchData();
  }, [fetchData, loadData]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) setIsAdvancedOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filteredRows = rows.filter((row) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      String(row.code || "").toLowerCase().includes(q) ||
      String(row.name || "").toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "" ||
      (statusFilter === "available" && row.has_json) ||
      (statusFilter === "missing" && !row.has_json);
    return matchesSearch && matchesStatus;
  });

  const handleCreate = async () => {
    if (!newLanguageName.trim() || !newLanguageCode.trim()) {
      toast.error("Language name and code are required");
      return;
    }

    setCreating(true);
    try {
      const result = await createBackofficeLanguage(accessToken, {
        name: newLanguageName.trim(),
        code: newLanguageCode.trim(),
        image: createImageFile,
      });
      if (!result?.status) throw new Error(result?.message || "Failed to create language");

      const createdLanguageId = result?.data?.id;
      if (createJsonFile && createdLanguageId) {
        const uploadResult = await uploadLanguageJson(accessToken, {
          language_id: createdLanguageId,
          file: createJsonFile,
        });
        if (!uploadResult?.status) {
          throw new Error(uploadResult?.message || "Language created but JSON upload failed");
        }
      }

      toast.success("Language created successfully");
      setNewLanguageName("");
      setNewLanguageCode("");
      setCreateJsonFile(null);
      setCreateImageFile(null);
      setIsCreateOpen(false);
      setLoadData(true);
    } catch (error) {
      const errors = error?.response?.data?.errors;
      toast.error(Array.isArray(errors) ? errors[0] : error?.response?.data?.message || error?.message || "Failed to create language");
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (row) => {
    setEditLanguageId(row.id);
    setEditLanguageName(row.name || "");
    setEditLanguageCode(row.code || "");
    setEditLanguageImageUrl(row.image_url || "");
    setEditJsonFile(null);
    setEditImageFile(null);
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editLanguageId || !editLanguageName.trim() || !editLanguageCode.trim()) {
      toast.error("Language name and code are required");
      return;
    }

    setUpdating(true);
    try {
      const result = await updateBackofficeLanguage(accessToken, editLanguageId, {
        name: editLanguageName.trim(),
        code: editLanguageCode.trim(),
        image: editImageFile,
      });
      if (!result?.status) throw new Error(result?.message || "Failed to update language");

      if (editJsonFile) {
        const uploadResult = await uploadLanguageJson(accessToken, {
          language_id: editLanguageId,
          file: editJsonFile,
        });
        if (!uploadResult?.status) {
          throw new Error(uploadResult?.message || "Language updated but JSON upload failed");
        }
      }

      toast.success("Language updated successfully");
      setIsEditOpen(false);
      setEditLanguageId(null);
      setEditLanguageName("");
      setEditLanguageCode("");
      setEditLanguageImageUrl("");
      setEditJsonFile(null);
      setEditImageFile(null);
      setLoadData(true);
    } catch (error) {
      const errors = error?.response?.data?.errors;
      toast.error(Array.isArray(errors) ? errors[0] : error?.response?.data?.message || error?.message || "Failed to update language");
    } finally {
      setUpdating(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await downloadEnglishTemplate(accessToken);
      saveBlob(blob, "en.json");
      toast.success("en.json downloaded");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to download en.json");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleDownloadLanguage = async (code) => {
    try {
      const blob = await downloadLanguageJson(accessToken, code);
      saveBlob(blob, `${code}.json`);
      toast.success(`${code}.json downloaded`);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to download JSON");
    }
  };

  const handleDeleteLanguage = async (row) => {
    const result = await Swal.fire({
      title: t("Delete Language?"),
      text: t("You are deleting {{name}} ({{code}}).", { name: row.name || row.code, code: row.code }),
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: t("Yes, Delete"),
      cancelButtonText: t("Cancel"),
    });

    if (!result.isConfirmed) return;

    try {
      const response = await deleteBackofficeLanguage(accessToken, row.id);
      if (!response?.status) throw new Error(response?.message || "Failed to delete language");
      toast.success(t("Language deleted successfully"));
      setLoadData(true);
    } catch (error) {
      const errors = error?.response?.data?.errors;
      toast.error(Array.isArray(errors) ? errors[0] : error?.response?.data?.message || error?.message || t("Failed to delete language"));
    }
  };

  return (
    <div className="p-4">
      <div className="bg-white figtree-regular rounded-lg shadow-sm p-4 mb-6">
        <h2 className="text-xl font-semibold">{t("Language Management")}</h2>
        <p className="text-sm text-gray-600">Create languages and manage translation JSON files.</p>

        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder={t("Search language code")}
                className="input w-full pr-16 focus:outline-none focus:border-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="absolute right-1 flex items-center gap-0.5">
                <button className="text-gray-500 hover:text-primary px-1 py-2">
                  <PiMagnifyingGlass fontSize={20} />
                </button>
                <button className="text-gray-500 hover:text-primary px-1 py-2" onClick={() => setIsAdvancedOpen((p) => !p)}>
                  <PiSliders fontSize={20} />
                </button>
              </div>
            </div>
          </div>

          {isAdvancedOpen && (
            <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 flex flex-wrap gap-4">
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label"><span className="label-text">{t("JSON")} Status</span></label>
                <select className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">{t("All")}</option>
                  <option value="available">{t("Available")}</option>
                  <option value="missing">{t("Missing")}</option>
                </select>
              </div>
              <div className="w-full flex justify-end gap-2">
                <button className="btn btn-error btn-outline h-10 min-h-10" onClick={() => { setSearchQuery(""); setStatusFilter(""); setIsAdvancedOpen(false); }}>
                  {t("Reset")}
                </button>
                <button className="btn h-10 min-h-10" onClick={() => setIsAdvancedOpen(false)}>
                  {t("Search")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white figtree-regular rounded-lg shadow-sm py-4">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-2 px-4">
          <h5 className="font-semibold text-custom-gray-400">{t("Language List")}</h5>
          <div className="flex items-center gap-2">
            <button className="btn btn-outline" onClick={handleDownloadTemplate} disabled={downloadingTemplate}>
              <PiDownloadSimple className="mr-1" />
              {downloadingTemplate ? "Downloading..." : t("Download en.json")}
            </button>
            <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
              <FaPlus className="mr-1" />
              {t("Add Language")}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded" />)}
              </div>
            </div>
          ) : (
            <table className="table figtree-regular">
              <thead>
                <tr className="bg-gray-100 font-semibold">
                  <th>{t("Image")}</th>
                  <th>Name</th>
                  <th>{t("Code")}</th>
                  <th>{t("JSON")}</th>
                  <th>{t("Updated At")}</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="hover">
                      <td>
                        {row.image_url ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={row.image_url} alt={row.name || row.code} className="h-8 w-8 rounded-full object-cover border border-gray-200" />
                          </>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-gray-100 border border-gray-200" />
                        )}
                      </td>
                      <td className="font-medium">{row.name || row.code}</td>
                      <td className="font-medium">{row.code}</td>
                      <td>
                        <span className={`badge ${row.has_json ? "badge-success" : "badge-warning"}`}>
                          {row.has_json ? t("Available") : t("Missing")}
                        </span>
                      </td>
                      <td>{row.updated_at || "N/A"}</td>
                      <td>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownloadLanguage(row.code)}
                            className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                            title="Download"
                          >
                            <PiDownloadSimple fontSize={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                            title="Edit"
                          >
                            <PiNotePencil fontSize={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLanguage(row)}
                            className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                            title={t("Delete")}
                          >
                            <PiTrash fontSize={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center pt-4 pb-4">No Languages Found</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isCreateOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg">{t("Add Language")}</h3>
            <p className="text-sm text-gray-600 mt-1">Example: `spanish` or `es`</p>
            <div className="mt-4">
              <label className="label"><span className="label-text">Language Name</span></label>
              <input
                type="text"
                className="input input-bordered w-full mb-3"
                value={newLanguageName}
                onChange={(e) => setNewLanguageName(e.target.value)}
                placeholder="English"
              />
              <label className="label"><span className="label-text">{t("Language Code")}</span></label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={newLanguageCode}
                onChange={(e) => setNewLanguageCode(e.target.value)}
                placeholder={t("Language Code")}
              />
              <label className="label mt-2"><span className="label-text">{t("Language Image")} ({t("Optional")})</span></label>
              <input
                type="file"
                accept="image/*"
                className="file-input file-input-bordered w-full"
                onChange={(e) => setCreateImageFile(e.target.files?.[0] || null)}
              />
              <label className="label mt-2"><span className="label-text">{t("JSON")} File ({t("Optional")})</span></label>
              <input
                type="file"
                accept=".json,application/json,text/plain"
                className="file-input file-input-bordered w-full"
                onChange={(e) => setCreateJsonFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setIsCreateOpen(false); setCreateJsonFile(null); setCreateImageFile(null); }}>{t("Cancel")}</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? "Creating..." : t("Create")}
              </button>
            </div>
          </div>
        </dialog>
      )}

      {isEditOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg">Edit Language</h3>
            <div className="mt-4">
              <label className="label"><span className="label-text">Language Name</span></label>
              <input
                type="text"
                className="input input-bordered w-full mb-3"
                value={editLanguageName}
                onChange={(e) => setEditLanguageName(e.target.value)}
                placeholder="English"
              />
              <label className="label"><span className="label-text">{t("Language Code")}</span></label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={editLanguageCode}
                onChange={(e) => setEditLanguageCode(e.target.value)}
                placeholder={t("Language Code")}
              />
              {editLanguageImageUrl ? (
                <div className="mt-3">
                  <p className="text-sm text-gray-600 mb-2">{t("Current Image")}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={editLanguageImageUrl} alt={editLanguageName || editLanguageCode} className="h-12 w-12 rounded-full object-cover border border-gray-200" />
                </div>
              ) : null}
              <label className="label mt-2"><span className="label-text">{t("Replace Image")} ({t("Optional")})</span></label>
              <input
                type="file"
                accept="image/*"
                className="file-input file-input-bordered w-full"
                onChange={(e) => setEditImageFile(e.target.files?.[0] || null)}
              />
              <label className="label mt-2"><span className="label-text">{t("Replace JSON")} ({t("Optional")})</span></label>
              <input
                type="file"
                accept=".json,application/json,text/plain"
                className="file-input file-input-bordered w-full"
                onChange={(e) => setEditJsonFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setIsEditOpen(false); setEditJsonFile(null); setEditImageFile(null); setEditLanguageImageUrl(""); }}>{t("Cancel")}</button>
              <button className="btn btn-primary" onClick={handleUpdate} disabled={updating}>
                {updating ? "Updating..." : t("Edit")}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}

