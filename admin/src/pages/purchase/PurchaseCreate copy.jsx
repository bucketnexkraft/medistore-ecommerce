import React, { useEffect, useRef, useState } from "react";
import { CiSearch, CiSquarePlus } from "react-icons/ci";
import { FiPlus } from "react-icons/fi";
import { IoClose } from "react-icons/io5";
import {
  createPurchaseInvoice,
  createPurchaseOrder,
  getInvoice,
} from "../../api/purchase";
import { useSelector } from "react-redux";
import {
  fetchInventory,
  fetchProductDetail,
  fetchProductOptions,
  getAllProduct,
  getStockGroupDetail,
  getVariantAttributes,
} from "../../api/products";
import CategoryAddEditModal from "../product-setup/category/components/CategoryAddEditModal";
import { closeModal, showModal } from "../../hooks/modalConfig";
import { toast } from "react-toastify";
import { storeCategories } from "../../api/category";
import BrandAddEditModal from "../product-setup/brand/components/BrandAddEditModal";
import { storeBrands } from "../../api/brand";
import { getWarehouse } from "../../api/warehouse";
import { getSuppliers, storeSuppliers } from "../../api/supplier";
import SupplierAddEditModal from "../suppliers/components/SupplierAddEditModal";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ProductModal from "../product-setup/products/components/ProductModal";
import { createId } from "../../utils/createId";

export default function PurchaseCreate() {
  const [supplier, setSupplier] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [stockItems, setStockItems] = useState([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [amount, setAmount] = useState("");
  const [total_amount, setTotalAmount] = useState(0);
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productList, setProductList] = useState([]);
  const [categorylist, setCategoryList] = useState([]);
  const [brandlist, setBrandList] = useState([]);
  const [isEdit, setIsEdit] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [isDrawer, setDrawer] = useState(true);
  const dropdownRef = useRef();
  const [stockGroupOptions, setStockGroupOptions] = useState([]);
  const [selectedVariants, setSelectedVariants] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [isSupplierAdd, setSupplierAdd] = useState(false);
  const [productcategory, setproductCategory] = useState(null);
  const [variantList, setVariantList] = useState([]);
  const [selectProduct, setSelectedProduct] = useState(null);
  const [variantMap, setVariantMap] = useState({});
  const [combinationDrawerOpen, setCombinationDrawerOpen] = useState(false);
  const [editingCombinationIndex, setEditingCombinationIndex] = useState(null);

  const [stockCombinations, setStockCombinations] = useState([]);
  const [currentCombination, setCurrentCombination] = useState({
    id: "",
    product: "",
    combination: {},
    quantity: 0,
    purchase_price: "",
    selling_price: "",
    expiry_date: "",
    batch_no: "",
    barcodes: [""],
    custom_barcodes: [""],
    scan_each: false,
    use_custom_code: false,
  });

  const generateCustomBarcode = () => {
    return `CUST-${Math.random().toString(36).substr(2, 9)}`;
  };

  const buildVariantMap = (variantsArray) => {
    const map = {};
    variantsArray.forEach((v) => {
      const key = Object.keys(v)[0];
      const value = v[key];
      if (!map[key]) map[key] = [];
      if (!map[key].includes(value)) map[key].push(value);
    });
    return map;
  };

  const handleSaveCombination = () => {
    const filled = Object.keys(variantMap).every(
      (k) => currentCombination.combination[k]
    );
    if (
      !filled ||
      !currentCombination.quantity ||
      !currentCombination.purchase_price ||
      !currentCombination.selling_price ||
      (currentCombination.scan_each &&
        currentCombination.barcodes.some((b) => !b)) ||
      (!currentCombination.scan_each && !currentCombination.barcodes[0]) ||
      (currentCombination.scan_each &&
        currentCombination.use_custom_code &&
        currentCombination.custom_barcodes.some((c) => !c)) ||
      (!currentCombination.scan_each &&
        currentCombination.use_custom_code &&
        !currentCombination.custom_barcodes[0])
    ) {
      toast.error(
        "Please complete all required fields, including barcodes or custom codes"
      );
      return;
    }

    const isDuplicate = stockCombinations.some(
      (row, i) =>
        i !== editingCombinationIndex &&
        Object.keys(variantMap).every(
          (key) => row.combination[key] === currentCombination.combination[key]
        )
    );
    if (isDuplicate && editingCombinationIndex === null) {
      toast.error("This variant combination already exists");
      return;
    }

    if (editingCombinationIndex !== null) {
      setStockCombinations((prev) =>
        prev.map((row, i) =>
          i === editingCombinationIndex
            ? { ...currentCombination, id: row.id }
            : row
        )
      );
      setEditingCombinationIndex(null);
    } else {
      setStockCombinations((prev) => [
        ...prev,
        { ...currentCombination, id: createId("purchase-combination") },
      ]);
    }

    setCurrentCombination({
      id: "",
      product: selectProduct?.name || "",
      combination: {},
      quantity: 0,
      purchase_price: "",
      selling_price: "",
      expiry_date: "",
      batch_no: "",
      barcodes: [""],
      scan_each: false,
      custom_barcodes: [""],
    });
  };

  const handleEditCombination = (index) => {
    setEditingCombinationIndex(index);
    setCurrentCombination((prev) => ({
      ...prev,
      ...stockCombinations[index],
      barcodes: [...stockCombinations[index].barcodes],
      custom_barcodes: [...(stockCombinations[index].custom_barcodes || [""])],
    }));
  };

  const handleDeleteCombination = (index) => {
    setStockCombinations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddToList = async () => {
    try {
      const incomplete = stockCombinations.some((row) => {
        return (
          Object.values(row.combination).some((v) => !v) ||
          !row.quantity ||
          !row.purchase_price ||
          !row.selling_price ||
          (row.scan_each && row.barcodes.some((b) => !b)) ||
          (!row.scan_each && !row.barcodes[0]) ||
          (row.scan_each &&
            row.use_custom_code &&
            row.custom_barcodes.some((c) => !c)) ||
          (!row.scan_each && row.use_custom_code && !row.custom_barcodes[0])
        );
      });

      if (incomplete) {
        toast.error(
          "Please complete all variant combinations with qty, purchase, selling price, and barcodes or custom codes"
        );
        return;
      }

      const updatedRows = await Promise.all(
        stockCombinations.map(async (row) => {
          try {
            const response = await fetchInventory(accessToken, {
              product_id: selectProduct.id,
              combination: row.combination,
              lot_number: row.batch_no,
            });

            const data = response?.data;

            return {
              ...row,
              id: selectProduct.id,
              product: selectProduct.name,
              barcode: data?.barcode || row.barcodes[0],
              custom_barcode: row?.use_custom_code,
              currentStock: data?.quantity ?? 0,
            };
          } catch (error) {
            return {
              ...row,
              id: selectProduct.id,
              product: selectProduct.name,
              barcode: row.barcodes[0],
              custom_barcode: row?.use_custom_code,
              currentStock: 0,
            };
          }
        })
      );

      setStockItems((prev) => [...prev, ...updatedRows]);
      setStockCombinations([]);
      setCurrentCombination({
        id: "",
        product: "",
        combination: {},
        quantity: 0,
        purchase_price: "",
        selling_price: "",
        expiry_date: "",
        batch_no: "",
        barcodes: [""],
        scan_each: false,
        use_custom_code: false,
      });
      setCombinationDrawerOpen(false);
    } catch (error) {
      toast.error("An error occurred while adding combinations to the list");
    }
  };

  const handleSelect = async (product) => {
    setSelectedProductId(product.id);
    setproductCategory(product.category_id);
    setSelectedProduct(product);
    setOpen(false);

    if (product.has_variant) {
      setVariantMap(buildVariantMap(product.variants));
      setCurrentCombination((prev) => ({ ...prev, product: product.name }));
      setCombinationDrawerOpen(true);
    } else {
      const newItem = {
        id: product.id,
        name: product.name,
        batch_no: "",
        quantity: 1,
        purchase_price: product.purchase_price || 0,
        selling_price: product.selling_price || 0,
        expiry_date: "",
        combination: {},
        barcode: "",
      };
      setStockItems((prev) => [...prev, newItem]);
      toast.success("Product added to stock list");
    }
  };

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const result = await getSuppliers(accessToken, []);
        setSuppliers(result.data);
      } catch (err) {
        console.error("Failed to fetch suppliers:", err);
      }
    };
    fetchSuppliers();
  }, [accessToken]);

  useEffect(() => {
    const total = stockItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.purchase_price) || 0;
      return sum + qty * price;
    }, 0);
    setAmount(total.toFixed(2));
  }, [stockItems]);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await getWarehouse(accessToken);
        setWarehouses(response.data);
      } catch (error) {
        console.error("Error fetching warehouses:", error);
      }
    };
    fetchWarehouses();
  }, [accessToken]);

  useEffect(() => {
    const fetchMissingStockGroupDetails = async () => {
      const missingIndexes = [];
      for (let i = 0; i < stockItems.length; i++) {
        const item = stockItems[i];
        if (item.stockGroupId && !item.stockGroupDetail) {
          missingIndexes.push(i);
        }
      }
      if (missingIndexes.length === 0) return;
      const newStockItems = [...stockItems];
      await Promise.all(
        missingIndexes.map(async (index) => {
          const item = stockItems[index];
          try {
            const response = await getStockGroupDetail(
              accessToken,
              item.stockGroupId
            );
            const stockArray = response.data || [];
            const totalStock = stockArray.reduce((sum, entry) => {
              return sum + (parseFloat(entry.quantity) || 0);
            }, 0);
            newStockItems[index] = {
              ...item,
              currentStock: totalStock,
              stockGroupDetail: stockArray,
            };
          } catch (err) {
            console.error(
              `Error fetching stock group for ID ${item.stockGroupId}:`,
              err
            );
          }
        })
      );
      setStockItems(newStockItems);
    };
    fetchMissingStockGroupDetails();
  }, [accessToken, stockItems]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const selected = productList.find((p) => p.id === selectedProductId);
    if (selected) setQuery(selected.name);
  }, [selectedProductId, productList]);

  const handleCheckInvoice = async () => {
    if (!invoiceNo) return;
    try {
      const response = await getInvoice(accessToken, invoiceNo);
      if (response.status) {
        const invoice = response.data;
        setSupplier(invoice.supplier_id);
        setInvoiceDate(invoice.invoice_date);
        setTotalAmount(invoice.total_amount);
        setSelectedWarehouseId(invoice.warehouse);
        setSelectedSupplierId(invoice.supplier_id);
        const inventoryItems = invoice.inventory || [];
        const mappedStockItems = await Promise.all(
          inventoryItems.map(async (item) => {
            let productName = item.product.name + "-" + item.stock_group.group;
            return {
              id: createId("purchase-stock-item"),
              name: productName,
              productId: item.productId || item.product_id || "",
              batch_no: item.lotNumber || item.lot_number || "",
              quantity: item.quantity || 1,
              purchase_price: item.purchasePrice || item.purchase_price || 0,
              selling_price: item.price || 0,
              expiry_date: item.expiryDate || item.expiry_date || "",
              stockGroupId: item.variant_id || "",
              currentStock: item.quantity || 0,
              stockGroupDetail: item.stockGroupDetail || [],
              barcode: item.barcode || "",
            };
          })
        );
        setStockItems(mappedStockItems);
        document.getElementById("invoice_drawer").checked = false;
      } else {
        setInvoiceNo(invoiceNo);
        document.getElementById("invoice_drawer").checked = true;
      }
    } catch (error) {
      console.error("Error checking invoice:", error);
      document.getElementById("invoice_drawer").checked = true;
    }
  };

  const createBrand = async (formData) => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("title", formData.title);
      formDataToSend.append("status", formData.status ? "1" : "0");
      if (formData.image instanceof File) {
        formDataToSend.append("image", formData.image);
      }
      const response = await storeBrands(accessToken, formDataToSend);
      if (!response.status) {
        throw new Error(
          response.message || `Failed to ${isEdit ? "update" : "create"} brand`
        );
      }
      const allDependency = await fetchProductOptions(accessToken);
      setBrandList(allDependency.data.brands);
      toast.success(`Brand ${isEdit ? "updated" : "created"} successfully!`);
      document.getElementById("my-drawer-4").checked = false;
    } catch (error) {
      if (error.response && error.response.status === 422) {
        const messages = error.response.data.errors;
        toast.error(messages.join("\n"));
      }
      document.getElementById("my-drawer-4").checked = false;
    }
  };

  const createCategory = async (formData) => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("title", formData.title);
      formDataToSend.append("status", formData.status ? "1" : "0");
      formDataToSend.append("parentId", formData.ancestor_id || "");
      if (formData.image instanceof File) {
        formDataToSend.append("image", formData.image);
      }
      const response = await storeCategories(accessToken, formDataToSend);
      if (!response.status) {
        throw new Error(
          response.message ||
            `Failed to ${isEdit ? "update" : "create"} category`
        );
      }
      const allDependency = await fetchProductOptions(accessToken);
      setCategoryList(allDependency.data.categories);
      document.getElementById("category_drawer").checked = false;
      toast.success(`Category ${isEdit ? "updated" : "created"} successfully!`);
    } catch (error) {
      if (error.response && error.response.status === 422) {
        const messages = error.response.data.errors;
        toast.error(messages.join("\n"));
      }
      document.getElementById("category_drawer").checked = false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    data.append("supplier_id", selectedSupplierId);
    data.append("invoice_date", invoiceDate);
    data.append("total_amount", total_amount);
    const response = await createPurchaseInvoice(accessToken, invoiceNo, data);
    if (response.status) {
      setSupplier(response.invoice.supplier_name);
      setInvoiceDate(response.invoice.invoice_date);
      setAmount(response.invoice.total_amount);
      document.getElementById("invoice_drawer").checked = false;
      setStockItems([]);
    } else {
      setSupplier("");
      setInvoiceDate("");
      setAmount(0);
    }
  };

  const handleChange = (id, field, value) => {
    if (field === "remove") {
    setStockItems((prev) => prev.filter((item) => item.id !== id));
    return;
  }

    if (field === "batch_no") {
      const existingItem = stockItems.find(
        (item) => item.id !== id && item.batch_no === value
      );
      if (existingItem) {
        toast.error(
          `Batch number "${value}" already exists for this product/variant. Please use a unique batch number.`
        );
        return;
      }
    }
    setStockItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const fetchData = async () => {
    try {
      const productList = await getAllProduct(accessToken);
      setProductList(productList.data);
      const allDependency = await fetchProductOptions(accessToken);
      setVariantList(allDependency.data.variants || []);
      setCategoryList(allDependency.data.categories);
      setBrandList(allDependency.data.brands);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    }
  };

  const createPurchaseHandler = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("invoice_no", invoiceNo);
      formData.append("warehouse_id", selectedWarehouseId);
      formData.append("supplier_id", selectedSupplierId);
      formData.append("invoice_date", invoiceDate);
      formData.append("total_amount", amount);
      if (invoiceFile) {
        formData.append("invoice_file", invoiceFile);
      }
      formData.append("items", JSON.stringify(stockItems));
      const result = await createPurchaseOrder(accessToken, formData);
      if (result.status) {
        toast.success("Purchase order created successfully!");
      } else {
        toast.error(result.message || "Failed to create purchase order");
      }
    } catch (error) {
      console.error("Error creating purchase order:", error);
      toast.error(
        error.response?.data?.message ||
          "An error occurred while creating the purchase order"
      );
    }
  };

  const handleSupplierAdd = async (formData) => {
    try {
      const response = await storeSuppliers(accessToken, formData);
      if (!response.status) {
        throw new Error(
          response.message ||
            `Failed to ${isEdit ? "update" : "create"} supplier`
        );
      }
      toast.success(`Supplier created successfully!`);
      const updatedSuppliers = await getSuppliers(accessToken);
      setSuppliers(updatedSuppliers.data);
      setSupplierAdd(false);
    } catch (error) {
      toast.error(error.message || `Failed to create supplier`);
    }
  };

  useEffect(() => {
    fetchData();
  }, [accessToken]);

  const filtered = selectProduct
    ? productList
    : productList.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase())
      );

  return (
    <>
      <form onSubmit={createPurchaseHandler} className="p-4 space-y-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Stock In</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          <div className="form-control w-full">
            <label className="label font-semibold" htmlFor="invoiceNo">
              Invoice No{" "}
              <span className="text-sm text-gray-400">
                (Press Enter to search)
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                id="invoiceNo"
                placeholder="Enter invoice no and press Enter"
                className="input input-bordered w-full pl-10"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    await handleCheckInvoice();
                  }
                }}
              />
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                <CiSearch />
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-4 w-full">
          <div className="w-8/12">
            <label className="label font-semibold">Search Product</label>
            <div className="relative w-full" ref={dropdownRef}>
              <div className="flex gap-2">
                <input
                  type="text"
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                  }}
                  onClick={() => setOpen(true)}
                  placeholder="Search and select product"
                  className="input input-bordered w-full"
                  value={query}
                />
                <label htmlFor="product_drawer" className="btn btn-outline">
                  <CiSquarePlus />
                </label>
              </div>
              {open && (
                <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded max-h-60 overflow-y-auto shadow-md">
                  {filtered.length > 0 ? (
                    filtered.map((product) => (
                      <li
                        key={product.id}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => handleSelect(product)}
                      >
                        {product.name}
                      </li>
                    ))
                  ) : (
                    <li className="px-4 py-2 text-gray-500">
                      No results found
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
          <div className="w-4/12">
            <label className="label font-semibold">Select Warehouse</label>
            <select
              className="select select-bordered w-full"
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              required
            >
              <option value="">-- Choose Warehouse --</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Current Inventory</h2>
          <button type="submit" className="btn btn-info text-white">
            Save
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="table w-full border">
            <thead>
              <tr>
                <th>Product</th>
                <th>Combination</th>
                <th>Lot Number</th>
                <th>Qty</th>
                <th>Purchase Price</th>
                <th>Selling Price</th>
                <th>Expiry</th>
                <th>Barcode</th>
                <th>Total Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {stockItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.product || "Selected"}</td>
                  <td>
                    {Object.entries(item.combination)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")}
                  </td>
                  <td>
                    <input
                      type="text"
                      required
                      className="input input-bordered w-full"
                      value={item.batch_no}
                      onChange={(e) =>
                        handleChange(item.id, "batch_no", e.target.value)
                      }
                      placeholder="LOT#"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input input-bordered w-full"
                      value={item.quantity ?? 0}
                      onChange={(e) =>
                        handleChange(item.id, "quantity", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input input-bordered w-full"
                      value={item.purchase_price}
                      onChange={(e) =>
                        handleChange(item.id, "purchase_price", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input input-bordered w-full"
                      value={item.selling_price}
                      onChange={(e) =>
                        handleChange(item.id, "selling_price", e.target.value)
                      }
                      required
                    />
                  </td>
                  <td>
                    <DatePicker
                      selected={
                        item.expiry_date ? new Date(item.expiry_date) : null
                      }
                      onChange={(date) =>
                        handleChange(
                          item.id,
                          "expiry_date",
                          date ? date.toISOString().split("T")[0] : ""
                        )
                      }
                      className="input input-bordered w-full"
                      placeholderText="Select a date"
                      dateFormat="yyyy-MM-dd"
                      required
                      minDate={new Date()}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={item.barcode}
                      onChange={(e) =>
                        handleChange(item.id, "barcode", e.target.value)
                      }
                      placeholder="Barcode"
                    />
                  </td>
                  <td className="text-right font-semibold">
                    {(
                      (parseFloat(item.quantity) || 0) *
                      (parseFloat(item.purchase_price) || 0)
                    ).toFixed(2)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-error text-white"
                      onClick={() => handleChange(item.id, "remove", null)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="8" className="text-right font-semibold">
                  Grand Total
                </td>
                <td className="text-right font-bold">
                  {stockItems
                    .reduce((total, item) => {
                      const qty = parseFloat(item.quantity) || 0;
                      const price = parseFloat(item.purchase_price) || 0;
                      return total + qty * price;
                    }, 0)
                    .toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <h3 className="text-lg font-bold mt-10 mb-2">📦 Stock Overview</h3>
        <div className="overflow-x-auto">
          <table className="table w-full border border-gray-300">
            <thead className="bg-base-200">
              <tr>
                <th>Product</th>
                <th>Combination</th>
                <th className="text-center">Current Stock</th>
                <th className="text-center text-success">Incoming Qty</th>
                <th className="text-center text-error">Updated Stock</th>
              </tr>
            </thead>
            <tbody>
              {stockItems.map((item) => (
                <tr key={`stock-${item.id}`}>
                  <td>{item?.product || "Selected"}</td>
                  <td>
                    {Object.entries(item.combination)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")}
                  </td>
                  <td className="text-center">{item.currentStock ?? 0}</td>
                  <td className="text-center text-success">
                    {item.quantity ?? 0}
                  </td>
                  <td className="text-center font-bold text-red-500">
                    {(parseFloat(item.currentStock) || 0) +
                      (parseFloat(item.quantity) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>

      <div className="drawer drawer-end">
        <input
          id="combination_drawer"
          type="checkbox"
          className="drawer-toggle"
          checked={combinationDrawerOpen}
          onChange={(e) => setCombinationDrawerOpen(e.target.checked)}
        />
        <div className="drawer-content"></div>
        <div className="drawer-side">
          <label
            htmlFor="combination_drawer"
            className="drawer-overlay"
          ></label>
          <div className="menu bg-base-200 text-base-content min-h-full w-full p-4 flex flex-row relative">
            <button
              type="button"
              className="btn btn-circle btn-outline absolute top-4 right-4"
              onClick={() => setCombinationDrawerOpen(false)}
            >
              <IoClose size={24} />
            </button>
            {/* Left Sidebar */}
            <div className="w-1/4 p-4 border-r border-gray-300 flex flex-col">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Product History
              </h3>

              <div className="flex-grow overflow-y-auto pr-1 space-y-3">
                {stockCombinations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center text-gray-500 mt-10 px-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-12 h-12 mb-3 text-gray-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 17v-2a4 4 0 018 0v2M12 7h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
                      />
                    </svg>
                    <p className="text-base font-medium text-gray-600">
                      No Products yet
                    </p>
                    <p className="text-sm text-gray-400">
                      Add Products using the form on the right
                    </p>
                  </div>
                ) : (
                  stockCombinations.map((row, index) => (
                    <div
                      key={row.id}
                      className="border border-gray-200 rounded-lg p-3 shadow-sm bg-white hover:shadow transition-all duration-150"
                    >
                      <div className="text-sm text-gray-700 space-y-1">
                        <p>
                          <span className="font-medium text-gray-900">
                            Combination:
                          </span>{" "}
                          {Object.entries(row.combination)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")}
                        </p>
                      
                      </div>

                      <div className="flex justify-end gap-2 mt-3">
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCombination(index);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-error btn-xs"
                          onClick={() => handleDeleteCombination(index)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                className="btn btn-primary w-full mt-4"
                onClick={handleAddToList}
              >
                Add to List
              </button>
            </div>

            {/* Right Content */}
            <div className="w-3/4 p-4">
              <h3 className="text-lg font-semibold mb-4">
                Add/Edit Combination
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.keys(variantMap).map((variantKey) => (
                  <div key={variantKey} className="form-control w-full">
                    <label className="label">
                      <span className="label-text">{variantKey}</span>
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={currentCombination.combination[variantKey] || ""}
                      onChange={(e) => {
                        setCurrentCombination((prev) => ({
                          ...prev,
                          combination: {
                            ...prev.combination,
                            [variantKey]: e.target.value,
                          },
                        }));
                      }}
                    >
                      <option value="">Select {variantKey}</option>
                      {variantMap[variantKey].map((val) => (
                        <option key={val} value={val}>
                          {val}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">Quantity</span>
                  </label>
                  <input
                    type="number"
                    placeholder="Qty"
                    min={0}
                    className="input input-bordered w-full"
                    value={currentCombination.quantity}
                    onChange={(e) => {
                      const qty = Number(e.target.value) || 0;
                      setCurrentCombination((prev) => ({
                        ...prev,
                        quantity: qty,
                        barcodes:
                          prev.scan_each && qty > 0
                            ? prev.barcodes.slice(0, 1)
                            : [""],
                      }));
                    }}
                  />
                </div>
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">Purchase Price</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    value={currentCombination.purchase_price}
                    onChange={(e) => {
                      setCurrentCombination((prev) => ({
                        ...prev,
                        purchase_price: e.target.value,
                      }));
                    }}
                  />
                </div>
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">Selling Price</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    value={currentCombination.selling_price}
                    onChange={(e) => {
                      setCurrentCombination((prev) => ({
                        ...prev,
                        selling_price: e.target.value,
                      }));
                    }}
                  />
                </div>

                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">Expiry Date</span>
                  </label>
                  <DatePicker
                    selected={
                      currentCombination.expiry_date
                        ? new Date(currentCombination.expiry_date)
                        : null
                    }
                    onChange={(date) => {
                      setCurrentCombination((prev) => ({
                        ...prev,
                        expiry_date: date
                          ? date.toISOString().split("T")[0]
                          : "",
                      }));
                    }}
                    className="input input-bordered w-full"
                    dateFormat="yyyy-MM-dd"
                    minDate={new Date()}
                  />
                </div>
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">Batch No</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={currentCombination.batch_no}
                    onChange={(e) => {
                      setCurrentCombination((prev) => ({
                        ...prev,
                        batch_no: e.target.value,
                      }));
                    }}
                  />
                </div>
                {/* Scan Options */}
                <div className="grid md:grid-cols-2 gap-4 w-full">
                  <label className="flex items-center gap-3">
                    <span className="label-text">Scan Each Item</span>
                    <input
                      type="checkbox"
                      className="toggle"
                      checked={currentCombination.scan_each}
                      onChange={(e) =>
                        setCurrentCombination((prev) => ({
                          ...prev,
                          scan_each: e.target.checked,
                          barcodes: e.target.checked
                            ? [""]
                            : [prev.barcodes[0] || ""],
                          custom_barcodes: e.target.checked
                            ? [""]
                            : [prev.custom_barcodes[0] || ""],
                        }))
                      }
                    />
                  </label>

                  <label className="flex items-center gap-3">
                    <span className="label-text">Use Custom Barcode</span>
                    <input
                      type="checkbox"
                      className="toggle"
                      checked={currentCombination.use_custom_code}
                      onChange={(e) =>
                        setCurrentCombination((prev) => ({
                          ...prev,
                          use_custom_code: e.target.checked,
                        }))
                      }
                    />
                  </label>
                </div>

                {/* Barcode Input Section */}

              </div>
                {currentCombination.scan_each ? (
                  <div className="w-full mt-4">
                    <details className="collapse collapse-arrow border border-base-300 bg-base-100 rounded-box">
                      <summary className="collapse-title font-medium">
                        Barcodes & Custom Barcodes (Qty:{" "}
                        {currentCombination.quantity})
                      </summary>
                      <div className="collapse-content">
                        <div className="grid md:grid-cols-3 gap-4">
                          {currentCombination.barcodes.map((barcode, index) => (
                            <div
                              key={index}
                              className="space-y-2 border p-2 rounded shadow-sm"
                            >
                              <input
                                type="text"
                                className="input input-bordered w-full"
                                value={barcode}
                                placeholder={`Barcode #${index + 1}`}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setCurrentCombination((prev) => {
                                    const newBarcodes = [...prev.barcodes];
                                    newBarcodes[index] = value;
                                    if (
                                      value &&
                                      index === newBarcodes.length - 1 &&
                                      newBarcodes.length < prev.quantity
                                    ) {
                                      newBarcodes.push("");
                                      const newCustomBarcodes = [
                                        ...prev.custom_barcodes,
                                      ];
                                      newCustomBarcodes.push("");
                                      return {
                                        ...prev,
                                        barcodes: newBarcodes,
                                        custom_barcodes: newCustomBarcodes,
                                      };
                                    }
                                    return { ...prev, barcodes: newBarcodes };
                                  });
                                }}
                              />

                              {currentCombination.use_custom_code && (
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    className="input input-bordered w-full"
                                    value={
                                      currentCombination.custom_barcodes[
                                        index
                                      ] || ""
                                    }
                                    placeholder={`Custom Barcode #${index + 1}`}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setCurrentCombination((prev) => {
                                        const newCustomBarcodes = [
                                          ...prev.custom_barcodes,
                                        ];
                                        newCustomBarcodes[index] = value;
                                        if (
                                          value &&
                                          index ===
                                            newCustomBarcodes.length - 1 &&
                                          newCustomBarcodes.length <
                                            prev.quantity
                                        ) {
                                          newCustomBarcodes.push("");
                                          const newBarcodes = [
                                            ...prev.barcodes,
                                          ];
                                          newBarcodes.push("");
                                          return {
                                            ...prev,
                                            barcodes: newBarcodes,
                                            custom_barcodes: newCustomBarcodes,
                                          };
                                        }
                                        return {
                                          ...prev,
                                          custom_barcodes: newCustomBarcodes,
                                        };
                                      });
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-md"
                                    onClick={() => {
                                      setCurrentCombination((prev) => {
                                        const newCustomBarcodes = [
                                          ...prev.custom_barcodes,
                                        ];
                                        newCustomBarcodes[index] =
                                          generateCustomBarcode();
                                        return {
                                          ...prev,
                                          custom_barcodes: newCustomBarcodes,
                                        };
                                      });
                                    }}
                                  >
                                    Generate
                                  </button>
                                </div>
                              )}

                              {index > 0 && (
                                <button
                                  type="button"
                                  className="btn btn-error btn-sm w-full"
                                  onClick={() => {
                                    setCurrentCombination((prev) => ({
                                      ...prev,
                                      barcodes: prev.barcodes.filter(
                                        (_, i) => i !== index
                                      ),
                                      custom_barcodes:
                                        prev.custom_barcodes.filter(
                                          (_, i) => i !== index
                                        ),
                                    }));
                                  }}
                                >
                                  ✕ Remove
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    {/* Single Barcode */}
                    <div>
                      <label className="label">
                        <span className="label-text">Barcode</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered w-full"
                        value={currentCombination.barcodes[0] || ""}
                        placeholder="Enter Barcode"
                        onChange={(e) =>
                          setCurrentCombination((prev) => ({
                            ...prev,
                            barcodes: [e.target.value],
                          }))
                        }
                      />
                    </div>

                    {/* Single Custom Barcode */}
                    {currentCombination.use_custom_code && (
                      <div>
                        <label className="label">
                          <span className="label-text">Custom Barcode</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            className="input input-bordered w-full"
                            value={currentCombination.custom_barcodes[0] || ""}
                            placeholder="Enter Custom Barcode"
                            onChange={(e) =>
                              setCurrentCombination((prev) => ({
                                ...prev,
                                custom_barcodes: [e.target.value],
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="btn btn-outline btn-md"
                            onClick={() =>
                              setCurrentCombination((prev) => ({
                                ...prev,
                                custom_barcodes: [generateCustomBarcode()],
                              }))
                            }
                          >
                            Generate
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="w-full mt-6">
                  <button
                    type="button"
                    className="btn btn-primary w-50 mt-4"
                    onClick={handleSaveCombination}
                  >
                    {editingCombinationIndex !== null ? "Update" : "Save"}{" "}
                    Combination
                  </button>
                </div>
            </div>
          </div>
        </div>
      </div>

      <div className="drawer drawer-end">
        <input id="invoice_drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content"></div>
        <div className="drawer-side">
          <label htmlFor="invoice_drawer" className="drawer-overlay"></label>
          <div className="menu bg-base-200 text-base-content min-h-full w-full sm:w-[48rem] p-4">
            {isSupplierAdd ? (
              <SupplierAddEditModal
                isDrawer={true}
                isEdit={false}
                onSubmit={handleSupplierAdd}
              />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label font-semibold">Invoice Number</label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="e.g., INV-2024-001"
                    value={invoiceNo}
                    required
                    onChange={(e) => setInvoiceNo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label font-semibold">Supplier Name</label>
                  <div className="flex gap-2 items-center">
                    <select
                      className="select select-bordered w-full"
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      required
                    >
                      <option value="">-- Select Supplier --</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                    <button
                      htmlFor="supplier_drawer"
                      className="btn btn-outline p-2 min-w-fit"
                      onClick={() => setSupplierAdd(true)}
                    >
                      <FiPlus size={18} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label font-semibold">Invoice Date</label>
                  <DatePicker
                    id="invoiceDate"
                    selected={invoiceDate ? new Date(invoiceDate) : null}
                    onChange={(date) =>
                      setInvoiceDate(
                        date ? date.toISOString().split("T")[0] : ""
                      )
                    }
                    className="input input-bordered w-full"
                    placeholderText="Select a date"
                    dateFormat="yyyy-MM-dd"
                    required
                    minDate={new Date()}
                  />
                  {invoiceDate && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700">
                        Selected Invoice Date:{" "}
                        <span className="font-bold">{invoiceDate}</span>
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="label font-semibold">Total Amount</label>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    onInput={(e) => {
                      const value = e.target.value;
                      if (parseFloat(value) < 0) {
                        toast.error("Total Amount cannot be negative");
                        setTotalAmount(1);
                        e.target.value = 1;
                      }
                      setTotalAmount(value);
                    }}
                    step="any"
                    placeholder="e.g., 250.00"
                    required
                    onChange={(e) => setTotalAmount(e.target.value)}
                  />
                </div>
                <div className="modal-action mt-6">
                  <button type="submit" className="btn btn-primary">
                    ✅ Save Invoice
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() =>
                      (document.getElementById(
                        "invoice_drawer"
                      ).checked = false)
                    }
                  >
                    ✖ Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="drawer drawer-end">
        <input id="product_drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content"></div>
        <div className="drawer-side">
          <label htmlFor="product_drawer" className="drawer-overlay"></label>
          <div className="menu bg-base-200 text-base-content min-h-full w-1/2 p-4">
            <ProductModal
              isEdit={false}
              editableData={false}
              setEditableData={null}
              fetchData={null}
              isDrawer={true}
              closeDrawer={() => {
                document.getElementById("product_drawer").checked = false;
              }}
            />
          </div>
        </div>
      </div>

      <div className="drawer drawer-end">
        <input id="category_drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content"></div>
        <div className="drawer-side">
          <label htmlFor="category_drawer" className="drawer-overlay"></label>
          <div className="menu bg-base-200 text-base-content min-h-full w-80 p-4">
            <CategoryAddEditModal
              isEdit={isEdit}
              parentCategories={categorylist}
              onSubmit={createCategory}
              isDrawer={true}
              closeDrawer={() => {
                document.getElementById("category_drawer").checked = false;
              }}
            />
          </div>
        </div>
      </div>

      <div className="drawer drawer-end">
        <input id="my-drawer-4" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content"></div>
        <div className="drawer-side">
          <label htmlFor="my-drawer-4" className="drawer-overlay"></label>
          <div className="menu bg-base-200 text-base-content min-h-full w-80 p-4">
            <BrandAddEditModal
              isEdit={isEdit}
              onSubmit={createBrand}
              isDrawer={true}
              closeDrawer={() => {
                document.getElementById("my-drawer-4").checked = false;
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
