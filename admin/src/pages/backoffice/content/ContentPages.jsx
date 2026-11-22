import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { PiMagnifyingGlass, PiSliders } from "react-icons/pi";
import Swal from "sweetalert2";
import { deleteContentPage, getContentPages } from "../../../api/backoffice/contentManager";

export default function ContentPages() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("");
  const [builder, setBuilder] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const filterRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getContentPages(accessToken);
      if (!result?.status) throw new Error(result?.message || "Failed to load pages");
      setPages(result?.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load pages");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsAdvancedOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredPages = useMemo(() => {
    return pages.filter((page) => {
      const matchesKeyword =
        !searchTerm ||
        String(page?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(page?.slug || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        status === "" ? true : String(Number(Boolean(page?.status))) === status;

      const matchesBuilder =
        builder === "" ? true : String(Number(Boolean(page?.has_builder))) === builder;

      return matchesKeyword && matchesStatus && matchesBuilder;
    });
  }, [pages, searchTerm, status, builder]);

  const handleSearch = () => {
    setSearchTerm(keyword.trim());
    setIsAdvancedOpen(false);
  };

  const resetFilters = () => {
    setKeyword("");
    setSearchTerm("");
    setStatus("");
    setBuilder("");
    setIsAdvancedOpen(false);
  };

  const confirmDeletePage = async (pageName) => {
    const result = await Swal.fire({
      title: "Delete Page?",
      text: `You are about to delete "${pageName || "this page"}". This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
      focusCancel: true,
    });
    return result.isConfirmed;
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Pages</h2>
            <p className="text-sm text-gray-600 mt-1">Manage page list and builder mapping.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/backoffice/content/pages/create")}>
            Create Page
          </button>
        </div>

        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                className="input w-full pr-16 focus:outline-none focus:border-none"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search by page name or slug..."
              />
              <div className="absolute right-1 flex items-center gap-0.5">
                <button onClick={handleSearch} className="text-gray-500 hover:text-primary px-1 py-2" title="Search">
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
                <label className="label"><span className="label-text">Status</span></label>
                <select className="select select-bordered h-10 min-h-10 w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label"><span className="label-text">Builder</span></label>
                <select className="select select-bordered h-10 min-h-10 w-full" value={builder} onChange={(e) => setBuilder(e.target.value)}>
                  <option value="">All</option>
                  <option value="1">Enabled</option>
                  <option value="0">Disabled</option>
                </select>
              </div>
              <div className="w-full flex justify-end gap-2">
                <button className="btn btn-error btn-outline h-10 min-h-10" onClick={resetFilters}>Reset</button>
                <button className="btn h-10 min-h-10" onClick={handleSearch}>Search</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        {loading ? (
          <div className="rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 text-slate-600">
              <div className="h-5 w-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
              <p className="font-medium">Loading pages...</p>
            </div>
            <div className="mt-5 space-y-3 animate-pulse">
              <div className="h-10 bg-slate-100 rounded-lg" />
              <div className="h-10 bg-slate-100 rounded-lg" />
              <div className="h-10 bg-slate-100 rounded-lg" />
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr className="bg-gray-100">
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Status</th>
                  <th>Builder</th>
                  <th>Sections</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPages.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8">No pages found.</td></tr>
                ) : (
                  filteredPages.map((page) => {
                    const isDefaultHomePage = Boolean(page?.is_default) || String(page?.slug || "").toLowerCase() === "home";

                    return (
                    <tr key={page.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span>{page.name}</span>
                          {isDefaultHomePage ? <span className="badge badge-ghost">default</span> : null}
                        </div>
                      </td>
                      <td>{page.slug}</td>
                      <td>
                        <span className={`badge text-white ${page.status ? "badge-success" : "badge-error"}`}>
                          {page.status ? "active" : "inactive"}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${page.has_builder ? "badge-info text-white" : "badge-ghost"}`}>
                          {page.has_builder ? "enabled" : "disabled"}
                        </span>
                      </td>
                      <td>{Array.isArray(page.section_names) ? page.section_names.join(", ") : "-"}</td>
                      <td className="space-x-2">
                        <button className="btn btn-sm btn-outline" onClick={() => navigate(`/backoffice/content/pages/${page.id}/edit`)}>
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-error btn-outline"
                          disabled={isDefaultHomePage}
                          title={isDefaultHomePage ? "Default Home page cannot be deleted" : "Delete page"}
                          onClick={async () => {
                            if (isDefaultHomePage) {
                              toast.info("Default Home page cannot be deleted");
                              return;
                            }
                            const confirmed = await confirmDeletePage(page?.name);
                            if (!confirmed) return;
                            try {
                              await deleteContentPage(accessToken, page.id);
                              toast.success("Page deleted");
                              loadData();
                            } catch (error) {
                              toast.error(error?.response?.data?.message || error?.message || "Delete failed");
                            }
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
