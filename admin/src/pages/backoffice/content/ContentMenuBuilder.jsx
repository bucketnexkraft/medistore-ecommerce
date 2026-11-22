import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import {
  createContentMenu,
  deleteContentMenu,
  getContentMenus,
  getContentPages,
  sortContentMenus,
  updateContentMenu,
} from "../../../api/backoffice/contentManager";

const normalizeTree = (items = []) =>
  items.map((item) => ({
    ...item,
    children: normalizeTree(item.children_recursive || []),
  }));

const flattenTree = (items = [], depth = 0) => {
  const rows = [];
  items.forEach((item) => {
    rows.push({ ...item, depth });
    if (item.children?.length) rows.push(...flattenTree(item.children, depth + 1));
  });
  return rows;
};

const moveSibling = (items, id, direction) => {
  const idx = items.findIndex((x) => String(x.id) === String(id));
  if (idx === -1) return false;
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= items.length) return false;
  const temp = items[idx];
  items[idx] = items[target];
  items[target] = temp;
  return true;
};

const moveInTree = (items, id, direction) => {
  if (moveSibling(items, id, direction)) return true;
  for (const item of items) {
    if (item.children?.length && moveInTree(item.children, id, direction)) return true;
  }
  return false;
};

const serializeSortPayload = (items) =>
  items.map((item) => ({
    id: item.id,
    children: serializeSortPayload(item.children || []),
  }));

function MenuTree({ items, onEdit, onDelete, onMoveUp, onMoveDown, depth = 0, saving = false }) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={item.id} className="border rounded-lg p-3" style={{ marginLeft: depth * 16 }}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-medium text-sm">{item.title}</div>
              <div className="text-xs text-gray-500">{item.url || "-"}</div>
            </div>
            <div className="flex gap-1">
              <button
                className="btn btn-xs btn-outline"
                onClick={() => onMoveUp(item.id)}
                disabled={saving || index === 0}
                title="Move up"
              >
                Up
              </button>
              <button
                className="btn btn-xs btn-outline"
                onClick={() => onMoveDown(item.id)}
                disabled={saving || index === items.length - 1}
                title="Move down"
              >
                Down
              </button>
              <button className="btn btn-xs btn-outline" onClick={() => onEdit(item)}>
                Edit
              </button>
              <button className="btn btn-xs btn-error btn-outline" onClick={() => onDelete(item.id)}>
                Delete
              </button>
            </div>
          </div>
          {item.children?.length > 0 && (
            <div className="mt-2">
              <MenuTree
                items={item.children}
                onEdit={onEdit}
                onDelete={onDelete}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                depth={depth + 1}
                saving={saving}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ContentMenuBuilder() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pages, setPages] = useState([]);
  const [menusTree, setMenusTree] = useState([]);
  const [form, setForm] = useState({
    id: null,
    title: "",
    page_id: "",
    url: "",
    parent_id: "",
    target: "_self",
    order: 0,
  });

  const flatMenus = useMemo(() => flattenTree(menusTree), [menusTree]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, m] = await Promise.all([getContentPages(accessToken), getContentMenus(accessToken)]);
      setPages(p?.data || []);
      setMenusTree(normalizeTree(m?.data || []));
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load menu builder");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm({
      id: null,
      title: "",
      page_id: "",
      url: "",
      parent_id: "",
      target: "_self",
      order: 0,
    });
  };

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        page_id: form.page_id ? Number(form.page_id) : null,
        url: form.url || null,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        target: form.target,
        order: Number(form.order || 0),
      };

      const result = form.id
        ? await updateContentMenu(accessToken, form.id, payload)
        : await createContentMenu(accessToken, payload);

      if (!result?.status) throw new Error(result?.message || "Failed to save menu");

      toast.success("Menu saved");
      resetForm();
      await loadData();
    } catch (error) {
      const errors = error?.response?.data?.errors;
      toast.error(Array.isArray(errors) ? errors[0] : error?.response?.data?.message || error?.message);
    } finally {
      setSaving(false);
    }
  };

  const saveSort = async (nextTree) => {
    setMenusTree(nextTree);
    setSaving(true);
    try {
      const payload = { items: serializeSortPayload(nextTree) };
      const result = await sortContentMenus(accessToken, payload);
      if (!result?.status) throw new Error(result?.message || "Sort failed");
      toast.success("Menu order updated");
      await loadData();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Sort failed");
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const move = (id, direction) => {
    const cloned = JSON.parse(JSON.stringify(menusTree));
    const moved = moveInTree(cloned, id, direction);
    if (!moved) return;
    saveSort(cloned);
  };

  const confirmDeleteMenu = async () => {
    const result = await Swal.fire({
      title: "Delete Menu Item?",
      text: "This menu item will be removed permanently.",
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
        <h2 className="text-xl font-semibold">Menu Builder</h2>
        <p className="text-sm text-gray-600 mt-1">Create, nest and reorder website menus.</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 text-slate-600">
            <div className="h-5 w-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
            <p className="font-medium">Loading menu builder...</p>
          </div>
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4 animate-pulse">
            <div className="h-56 bg-slate-100 rounded-xl" />
            <div className="h-56 bg-slate-100 rounded-xl" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
            <h3 className="font-semibold">Add / Edit Menu</h3>

            <div className="space-y-1">
              <label className="label py-1"><span className="label-text font-medium">Menu Title</span></label>
              <input
                className="input input-bordered w-full"
                placeholder="Enter menu title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="label py-1"><span className="label-text font-medium">URL</span></label>
              <input
                className="input input-bordered w-full"
                placeholder="Enter URL (optional if page selected)"
                value={form.url}
                onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="label py-1"><span className="label-text font-medium">Linked Page</span></label>
              <select
                className="select select-bordered w-full"
                value={form.page_id}
                onChange={(e) => setForm((p) => ({ ...p, page_id: e.target.value }))}
              >
                <option value="">No page linked</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="label py-1"><span className="label-text font-medium">Parent Menu</span></label>
              <select
                className="select select-bordered w-full"
                value={form.parent_id}
                onChange={(e) => setForm((p) => ({ ...p, parent_id: e.target.value }))}
              >
                <option value="">No parent (root menu)</option>
                {flatMenus
                  .filter((item) => !form.id || item.id !== form.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {"- ".repeat(item.depth)}
                      {item.title}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="label py-1"><span className="label-text font-medium">Open Target</span></label>
              <select
                className="select select-bordered w-full"
                value={form.target}
                onChange={(e) => setForm((p) => ({ ...p, target: e.target.value }))}
              >
                <option value="_self">Same Tab (_self)</option>
                <option value="_blank">New Tab (_blank)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="label py-1"><span className="label-text font-medium">Order</span></label>
              <input
                className="input input-bordered w-full"
                type="number"
                value={form.order}
                onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
                placeholder="0"
              />
            </div>

            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={submit} disabled={saving}>
                {form.id ? "Update" : "Add Menu"}
              </button>
              <button className="btn btn-ghost" onClick={resetForm}>
                Reset
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
            <h3 className="font-semibold">Added Menus</h3>
            <p className="text-xs text-gray-500">Use Up/Down buttons to reorder items inside the same level.</p>
            {menusTree.length === 0 ? (
              <div className="text-sm text-gray-500">No menu items yet.</div>
            ) : (
              <MenuTree
                items={menusTree}
                onEdit={(item) =>
                  setForm({
                    id: item.id,
                    title: item.title || "",
                    page_id: item.page_id ? String(item.page_id) : "",
                    url: item.url || "",
                    parent_id: item.parent_id ? String(item.parent_id) : "",
                    target: item.target || "_self",
                    order: Number(item.order || 0),
                  })
                }
                onDelete={async (id) => {
                  const confirmed = await confirmDeleteMenu();
                  if (!confirmed) return;
                  try {
                    await deleteContentMenu(accessToken, id);
                    toast.success("Menu deleted");
                    await loadData();
                  } catch (error) {
                    toast.error(error?.response?.data?.message || error?.message || "Delete failed");
                  }
                }}
                onMoveUp={(id) => move(id, "up")}
                onMoveDown={(id) => move(id, "down")}
                saving={saving}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

