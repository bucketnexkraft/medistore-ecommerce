import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchingUser } from '../../slice/userSlice';
import { fetchingProducts } from '../../api/products';
import { toast } from 'react-toastify';
import axiosInstance from '../../config/axiosInstance';
import axios from 'axios';
import { API_URL } from '../../config/constants';
import { useNavigate } from 'react-router-dom';

export default function NewSale() {
    const dispatch = useDispatch();
    const [perPage, setPerPage] = useState(2000);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [products, setProducts] = useState([]);
    const [invoiceItems, setInvoiceItems] = useState([]);
    const [vatPercentage, setVatPercentage] = useState(20);
    const [searchQuery, setSearchQuery] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [loadData, setLoadData] = useState(true);
    const [companyId, setCompanyId] = useState('1'); // Hardcoded or from context
    const [warehouseId, setWarehouseId] = useState('1'); // Hardcoded or from context
    const [invoiceType, setInvoiceType] = useState('sale'); // Default to 'sale'

    const accessToken = useSelector((state) => state.auth.accessToken);
    const { data: usersData } = useSelector((state) => state.users || {});
    const { data: productsData } = useSelector((state) => state.products || {});
    const navigate = useNavigate()

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = { perPage };
            const result = await fetchingProducts(accessToken, params);
            if (!result?.status) {
                throw new Error(result?.message || "Failed to fetch products");
            }
            setProducts(result.data);
        } catch (error) {
            console.error("Fetch products error:", error);
        } finally {
            setLoading(false);
            setLoadData(false);
        }
    }, [accessToken, perPage]);

    const searchProducts = async () => {
        setLoading(true);
        try {
            const params = { perPage, search: searchQuery };
            const result = await fetchingProducts(accessToken, params);
            if (!result?.status) {
                throw new Error(result?.message || "Failed to search products");
            }
            setProducts(result.data);
        } catch (error) {
            console.error("Search products error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        dispatch(fetchingUser({ accessToken, payload: { perPage, page: currentPage, role: 2 } }));
        fetchData();
    }, [dispatch, accessToken, perPage, currentPage]);

    const addItem = (product) => {
        setInvoiceItems([...invoiceItems, { ...product, quantity: 1, discount: 0, tax_rate: 0, variant_id: null }]);
    };

    const updateQuantity = (index, quantity) => {
        const newItems = [...invoiceItems];
        newItems[index].quantity = quantity;
        setInvoiceItems(newItems);
    };

    const updateDiscount = (index, discount) => {
        const newItems = [...invoiceItems];
        newItems[index].discount = discount;
        setInvoiceItems(newItems);
    };

    const updateTaxRate = (index, taxRate) => {
        const newItems = [...invoiceItems];
        newItems[index].tax_rate = taxRate;
        setInvoiceItems(newItems);
    };

    const removeItem = (index) => {
        const newItems = invoiceItems.filter((_, i) => i !== index);
        setInvoiceItems(newItems);
    };

    const calculateTotal = () => {
        const subtotal = invoiceItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const vat = subtotal * (vatPercentage / 100);
        const discount = invoiceItems.reduce((sum, item) => sum + (item.discount || 0), 0);
        const tax = invoiceItems.reduce((sum, item) => sum + ((item.price * item.quantity - (item.discount || 0)) * (item.tax_rate / 100)), 0);
        return {
            subtotal,
            vat,
            tax,
            total: subtotal + tax + vat - discount,
            net: subtotal + tax + vat - discount
        };
    };

    const confirmAndSave = async () => {
        if (!selectedCustomer) {
            toast.error("Please select a customer.");
            return;
        }
        if (invoiceItems.length === 0) {
            toast.error("Please add at least one product to the invoice.");
            return;
        }
        const selectedUser = usersData?.find(user => user.id === selectedCustomer);
        const { subtotal, vat, tax, total, net } = calculateTotal();
        const saleData = {
            type: invoiceType,
            company_id: companyId,
            warehouse_id: warehouseId,
            customer_id: selectedUser?.id || null,
            invoice_no: `INV-${Date.now()}`, // Generate a unique invoice number
            date: invoiceDate,
            items: invoiceItems.map(item => ({
                product_id: item.id,
                variant_id: item.variant_id,
                qty: item.quantity,
                unit_price: item.price,
                discount: item.discount || 0,
                tax_rate: item.tax_rate || 0
            }))
        };
        try {
            const response = await axios.post(`${API_URL}/sale/store`, saleData, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
          if (response.data.status) {
                toast.success("Sale created successfully!");
                navigate('/sales'); // Redirect to sales page
            }
          
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to create sale");
        }
    };

    const { subtotal, vat, tax, total, net } = calculateTotal();
    const selectedUser = usersData?.find(user => user.id === selectedCustomer);

    return (
        <div className="p-6 bg-gray-100 min-h-screen">
            <div className="flex space-x-6">
                <div className="w-1/2 bg-white p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-semibold text-gray-700 mb-4">Billed To:</h3>
                    <select
                        value={selectedCustomer}
                        onChange={(e) => setSelectedCustomer(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Select Customer</option>
                        {usersData?.map((user) => (
                            <option key={user.id} value={user.id}>
                                {`${user.first_name} ${user.last_name}`}
                            </option>
                        ))}
                    </select>
                    {selectedUser && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            <p className="text-gray-600"><strong>Name:</strong> {selectedUser.first_name} {selectedUser.last_name}</p>
                            <p className="text-gray-600"><strong>Email:</strong> {selectedUser.email}</p>
                            <p className="text-gray-600"><strong>Phone:</strong> {selectedUser.phone}</p>
                        </div>
                    )}
                    <div className="mt-4">
                        <label className="block text-gray-700">Invoice Date:</label>
                        <input
                            type="date"
                            value={invoiceDate}
                            onChange={(e) => setInvoiceDate(e.target.value)}
                            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <table className="w-full mt-6 bg-white border-collapse">
                        <thead>
                            <tr className="bg-gray-200 text-gray-700">
                                <th className="p-3 text-left">Product</th>
                                <th className="p-3 text-left">Price</th>
                                <th className="p-3 text-left">Qty</th>
                                <th className="p-3 text-left">Discount</th>
                                <th className="p-3 text-left">Tax Rate (%)</th>
                                <th className="p-3 text-left">Total</th>
                                <th className="p-3 text-left">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoiceItems.map((item, index) => (
                                <tr key={index} className="border-t">
                                    <td className="p-3">{item.name}</td>
                                    <td className="p-3">{item.price}</td>
                                    <td className="p-3">
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => updateQuantity(index, e.target.value)}
                                            className="w-20 p-1 border rounded-lg"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <input
                                            type="number"
                                            min="0"
                                            value={item.discount}
                                            onChange={(e) => updateDiscount(index, e.target.value)}
                                            className="w-20 p-1 border rounded-lg"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <input
                                            type="number"
                                            min="0"
                                            value={item.tax_rate}
                                            onChange={(e) => updateTaxRate(index, e.target.value)}
                                            className="w-20 p-1 border rounded-lg"
                                        />
                                    </td>
                                    <td className="p-3">{((item.price * item.quantity) - (item.discount || 0) + ((item.price * item.quantity - (item.discount || 0)) * (item.tax_rate / 100))).toFixed(2)} €</td>
                                    <td className="p-3">
                                        <button
                                            onClick={() => removeItem(index)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            ✕
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-6">
                        <label className="block text-gray-700">VAT (%):</label>
                        <input
                            type="number"
                            value={vatPercentage}
                            onChange={(e) => setVatPercentage(e.target.value)}
                            className="w-20 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="mt-2 text-gray-700">
                            <p>Subtotal: {subtotal.toFixed(2)} €</p>
                            <p>VAT: {vat.toFixed(2)} €</p>
                            <p>Tax: {tax.toFixed(2)} €</p>
                            <p>Total: {total.toFixed(2)} €</p>
                            <p>Net A Payer: {net.toFixed(2)} €</p>
                        </div>
                    </div>
                    <button
                        onClick={confirmAndSave}
                        className="mt-6 w-full bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 transition"
                    >
                        Confirm & Save
                    </button>
                </div>
                <div className="w-1/2 bg-white p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-semibold text-gray-700 mb-4">Search/Add Products</h3>
                    <div className="flex space-x-2 mb-4">
                        <input
                            type="text"
                            placeholder="Scan barcode or search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            onClick={searchProducts}
                            className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition"
                        >
                            Search
                        </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {products.map((product) => (
                            <div key={product.id} className="flex justify-between items-center p-3 border-b hover:bg-gray-50">
                                <span className="text-gray-700">{product.name}</span>
                                <span className="text-gray-500">{product.barcode}</span>
                                <button
                                    onClick={() => addItem(product)}
                                    className="bg-blue-600 text-white px-4 py-1 rounded-lg hover:bg-blue-700 transition"
                                >
                                    Add
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
