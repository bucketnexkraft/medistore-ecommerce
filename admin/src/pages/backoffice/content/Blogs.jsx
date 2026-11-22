import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { PiMagnifyingGlass, PiNotePencil, PiSliders, PiTrash } from "react-icons/pi";
import { deleteBlog, getBlogOptions, getBlogs } from "../../../api/backoffice/blogs";

export default function Blogs() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", status: "", category_id: "" });
  const [keyword, setKeyword] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const filterRef = useRef(null);

  const normalizeRows = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  };

  const loadData = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    try {
      const [blogResult, optionResult] = await Promise.all([
        getBlogs(accessToken, { ...nextFilters, perPage: 200 }),
        getBlogOptions(accessToken),
      ]);
      if (!blogResult?.status) throw new Error(blogResult?.message || "Failed to load blogs");
      if (!optionResult?.status) throw new Error(optionResult?.message || "Failed to load blog options");

      setRows(normalizeRows(blogResult?.data));
      setCategories(optionResult?.data?.categories || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load blogs");
    } finally {
      setLoading(false);
    }
  }, [accessToken, filters]);

  useEffect(() => {
    if (!accessToken) return;
    loadData();
  }, [accessToken]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsAdvancedOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = () => {
    const next = { ...filters, search: keyword.trim() };
    setFilters(next);
    setIsAdvancedOpen(false);
    loadData(next);
  };

  const resetFilters = () => {
    const next = { search: "", status: "", category_id: "" };
    setKeyword("");
    setFilters(next);
    setIsAdvancedOpen(false);
    loadData(next);
  };

  const remove = async (row) => {
    const result = await Swal.fire({
      title: "Delete Blog?",
      text: `You are deleting "${row.title}".`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
    });
    if (!result.isConfirmed) return;

    try {
      const response = await deleteBlog(accessToken, row.id);
      if (!response?.status) throw new Error(response?.message || "Delete failed");
      toast.success("Blog deleted");
      loadData();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Delete failed");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Blogs</h2>
            <p className="text-sm text-gray-600">Create and manage blog posts.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/backoffice/content/blogs/create")}>+ Add Blog</button>
        </div>

        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                className="input w-full pr-16 focus:outline-none focus:border-none"
                placeholder="Search by title or slug..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
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
                <label className="label"><span className="label-text">Category</span></label>
                <select
                  className="select select-bordered h-10 min-h-10 w-full"
                  value={filters.category_id}
                  onChange={(e) => setFilters((p) => ({ ...p, category_id: e.target.value }))}
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => <option value={cat.id} key={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label"><span className="label-text">Status</span></label>
                <select
                  className="select select-bordered h-10 min-h-10 w-full"
                  value={filters.status}
                  onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="">All Status</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
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

      <div className="bg-white rounded-lg shadow-sm p-4 overflow-x-auto">
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="table">
            <thead>
              <tr className="bg-gray-100">
                <th>Image</th>
                <th>Title</th>
                <th>Category</th>
                <th>Status</th>
                <th>Home</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr><td colSpan={6} className="text-center py-8">No blogs found.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.image_url ? <img src={row.image_url} alt={row.title} className="h-10 w-16 object-cover rounded" /> : "-"}
                  </td>
                  <td className="max-w-[280px] truncate">{row.title}</td>
                  <td>{row.category?.name || "-"}</td>
                  <td>
                    <span className={`badge ${row.status ? "badge-success" : "badge-ghost"}`}>
                      {row.status ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${row.is_show_in_home ? "badge-info text-white" : "badge-ghost"}`}>
                      {row.is_show_in_home ? "Yes" : "No"}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-2">
                      <button className="btn btn-sm border-none bg-primary/10 text-primary" onClick={() => navigate(`/backoffice/content/blogs/${row.id}/edit`)}>
                        <PiNotePencil />
                      </button>
                      <button className="btn btn-sm border-none bg-error/10 text-error" onClick={() => remove(row)}>
                        <PiTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
