import React, { useEffect, useState } from "react";
import axios from "axios";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_URL } from "../../config/constants";
import { fetchingUser } from "../../slice/userSlice";
import { fetchingProducts } from "../../api/products";

export default function UpdateSale({ selectedSale, setSelectedSale }) {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const { data: usersData } = useSelector((state) => state.users || {});
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [vatPercentage, setVatPercentage] = useState(20);

  useEffect(() => {
    dispatch(
      fetchingUser({
        accessToken,
        payload: { perPage: 2000, page: 1, role: 2 },
      })
    );
    fetchProducts();
  }, [dispatch, accessToken]);

  useEffect(() => {
    if (selectedSale) {
      setInvoiceDate(selectedSale.date || "");
      setSelectedCustomer(selectedSale.user_id || "");
      const initialItems = selectedSale.items.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: Number(item.qty),
        price: Number(item.unit_price),
        discount: Number(item.discount),
        tax_rate: Number(item.tax_rate),
        name: item.product.name || "Unknown Product", // Fallback if product_name is not provided
      }));
      setInvoiceItems(initialItems);
    }
  }, [selectedSale]);

  // Fetch products
  const fetchProducts = async () => {
    try {
      const res = await fetchingProducts(accessToken, { perPage: 2000 });
      if (res.status) {
        setProducts(res.data);
      } else {
        toast.error("Failed to fetch products");
      }
    } catch (err) {
      toast.error("Error fetching products");
    }
  };

  // Update invoice item fields
  const updateItem = (index, field, value) => {
    const updated = [...invoiceItems];
    updated[index][field] = field === "name" ? value : Number(value);
    setInvoiceItems(updated);
  };

  // Remove an item from the invoice
  const removeItem = (index) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  // Add a new product to the invoice
  const addItem = (product) => {
    setInvoiceItems([
      ...invoiceItems,
      {
        product_id: product.id,
        quantity: 1,
        price: Number(product.unit_price || product.price || 0),
        discount: 0,
        tax_rate: 0,
        name: product.name,
      },
    ]);
  };

  // Calculate totals
  const calculateTotal = () => {
    const subtotal = invoiceItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const vat = subtotal * (vatPercentage / 100);
    const discount = invoiceItems.reduce(
      (sum, item) => sum + (item.discount || 0),
      0
    );
    const tax = invoiceItems.reduce(
      (sum, item) =>
        sum +
        (item.price * item.quantity - (item.discount || 0)) *
          (item.tax_rate / 100),
      0
    );
    return {
      subtotal,
      vat,
      tax,
      total: subtotal + vat + tax - discount,
      net: subtotal + vat + tax - discount,
    };
  };

  // Handle sale update
  const handleUpdate = async () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer");
      return;
    }
    if (!invoiceDate) {
      toast.error("Please select an invoice date");
      return;
    }
    if (invoiceItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    const { subtotal, vat, tax, total } = calculateTotal();
    const payload = {
      type: selectedSale.type,
      company_id: selectedSale.company_id,
      warehouse_id: selectedSale.warehouse_id,
      user_id: selectedCustomer,
      invoice_no: selectedSale.invoice_no,
      date: invoiceDate,
      items: invoiceItems.map((item) => ({
        id: item.id || undefined, // Include item ID if updating existing item
        product_id: item.product_id,
        qty: item.quantity,
        unit_price: item.price,
        discount: item.discount,
        tax_rate: item.tax_rate,
      })),
    };


    try {
      const res = await axios.post(
        `${API_URL}/sale/update/${selectedSale.id}`,
        payload,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (res.data.status) {
        toast.success("Sale updated successfully");
        navigate("/sales");
      } else {
        toast.error(res.data.message || "Update failed");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Error updating sale");
    }
  };

  // Filter products based on search query
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { subtotal, vat, tax, total } = calculateTotal();
  useEffect(() => {
    if (selectedSale && selectedSale.customer) {
      setSelectedCustomer(selectedSale.customer.id);
    }
  }, [selectedSale]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex gap-4">
        {/* Left Section: Edit Sale */}
        <div className="w-1/2 bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-3">
            Edit Sale: {selectedSale.invoice_no}
          </h2>

          {/* Customer Dropdown */}
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="w-full border p-2 rounded mb-4"
          >
            <option value="">Select Customer</option>
            {usersData?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.first_name} {user.last_name}
              </option>
            ))}
          </select>
          {selectedSale && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-600">
                <strong>Name:</strong> {selectedSale.customer.name}
              </p>
              <p className="text-gray-600">
                <strong>Email:</strong> {selectedSale.customer.email}
              </p>
              <p className="text-gray-600">
                <strong>Phone:</strong> {selectedSale.customer.phone}
              </p>
            </div>
          )}

          {/* Invoice Date */}
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className="w-full border p-2 rounded mb-4"
          />

          {/* Invoice Items Table */}
          <table className="w-full text-sm border">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Product</th>
                <th className="p-2">Qty</th>
                <th className="p-2">Price (€)</th>
                <th className="p-2">Discount (€)</th>
                <th className="p-2">Tax (%)</th>
                <th className="p-2">Total (€)</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {invoiceItems.map((item, index) => (
                <tr key={index} className="border-t">
                  <td className="p-2">{item.name}</td>
                  <td className="p-2">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, "quantity", e.target.value)
                      }
                      className="w-14 p-1 border rounded"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(e) =>
                        updateItem(index, "price", e.target.value)
                      }
                      className="w-20 p-1 border rounded"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.discount}
                      onChange={(e) =>
                        updateItem(index, "discount", e.target.value)
                      }
                      className="w-20 p-1 border rounded"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.tax_rate}
                      onChange={(e) =>
                        updateItem(index, "tax_rate", e.target.value)
                      }
                      className="w-14 p-1 border rounded"
                    />
                  </td>
                  <td className="p-2">
                    {(
                      (item.price * item.quantity - (item.discount || 0)) *
                      (1 + item.tax_rate / 100)
                    ).toFixed(2)}
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-4 space-y-1 text-sm">
            <p>Subtotal: {subtotal.toFixed(2)} €</p>
            <p>
              VAT ({vatPercentage}%): {vat.toFixed(2)} €
            </p>
            <p>Tax: {tax.toFixed(2)} €</p>
            <p className="font-semibold">Total: {total.toFixed(2)} €</p>
          </div>

          {/* Update Button */}
          <button
            onClick={handleUpdate}
            className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
          >
            Update Sale
          </button>
        </div>

        {/* Right Section: Search Products */}
        <div className="w-1/2 bg-white p-4 rounded shadow">
          <h3 className="text-lg font-semibold mb-2">Search Products</h3>
          <div className="flex mb-3">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border p-2 rounded-l"
            />
            <button
              onClick={fetchProducts}
              className="bg-blue-500 text-white px-4 rounded-r hover:bg-blue-600"
            >
              🔍
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex justify-between items-center p-2 border-b text-sm"
                >
                  <span>
                    {product.name} ({product.unit_price} €)
                  </span>
                  <button
                    onClick={() => addItem(product)}
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                  >
                    Add
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No products found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
