import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSelector } from 'react-redux';
import { closeModal } from '../../../hooks/modalConfig';
import { toast } from 'react-toastify';
import { createPurchaseOrder } from '../../../api/purchase';
import { searchProduct } from '../../../api/products';

export default function AddPurchaseModal({ supplierList = [], setLoadData }) {
    const accessToken = useSelector((state) => state.auth.accessToken);

    const [formErrors, setFormErrors] = useState('');
    const [loading, setLoading] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [productResults, setProductResults] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm();

    const handleSearchChange = async (e) => {
        const value = e.target.value;
        setProductSearch(value);

        if (value.length >= 2) {
            try {
                const res = await searchProduct(accessToken, value);
                setProductResults(res.data);
            } catch (err) {
                console.error('Product search error:', err);
            }
        } else {
            setProductResults([]);
        }
    };

    const handleSelectProduct = (product) => {
        setSelectedProduct(product);
        setProductSearch(product.name);
        setProductResults([]);
    };

    const onSubmit = async (data) => {
        if (!selectedProduct) {
            toast.error('Please select a valid product');
            return;
        }

        setFormErrors('');
        setLoading(true);

        const payload = {
            supplier_id: data.supplier_id,
            payment_status: 1,
            status: 1,
            products: [
                {
                    product_id: selectedProduct.id,
                    qty: parseFloat(data.qty),
                    purchase_unit_id: selectedProduct.unit_id || 1,
                    net_unit_cost: selectedProduct.purchase_price || parseFloat(data.purchase_price),
                    discount: 0,
                    tax_rate: 0,
                    tax: 0,
                    total: (selectedProduct.purchase_price || parseFloat(data.purchase_price)) * parseFloat(data.qty),
                },
            ],
        };

        try {
            const response = await createPurchaseOrder(accessToken, payload);
            if (!response.status) {
                throw new Error(response.message || 'Failed to create purchase');
            }

            const successMessage = response.message || 'Stock in created successfully';
            setLoadData(true);
            closeModal('add_purchase_modal');
            reset();
            setSelectedProduct(null);
            setProductSearch('');
            setTimeout(() => toast.success(successMessage), 0);
        } catch (error) {
            setFormErrors(
                error?.response?.data?.errors
                    ? Object.values(error.response.data.errors).join('\n')
                    : error?.message || 'Something went wrong.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <dialog id="add_purchase_modal" className="modal">
            <div className="modal-box w-11/12 max-w-2xl">
                <h3 className="font-bold text-lg mb-4">Add Purchase</h3>

                {formErrors && (
                    <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
                        <ul>
                            {formErrors.split('\n').map((error, index) => (
                                <li key={index}>{error}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* Search and Select Product */}
                    <div>
                        <label className="block font-medium">Scan Barcode or Type Product Name *</label>
                        <input
                            type="text"
                            value={productSearch}
                            onChange={handleSearchChange}
                            className="input input-bordered w-full"
                            placeholder="Search product..."
                        />
                        {productResults.length > 0 && (
                            <ul className="bg-white shadow-md rounded mt-1 max-h-48 overflow-y-auto">
                                {productResults.map((product) => (
                                    <li
                                        key={product.id}
                                        className="p-2 hover:bg-gray-100 cursor-pointer"
                                        onClick={() => handleSelectProduct(product)}
                                    >
                                        {product.name}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {selectedProduct && (
                        <div className="space-y-4 border-t pt-4">
                            <div>
                                <label className="block font-medium">Product Name</label>
                                <input
                                    type="text"
                                    value={selectedProduct.name}
                                    readOnly
                                    className="input input-bordered w-full"
                                />
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="w-1/2">
                                    <label className="block font-medium">Purchase Price</label>
                                    <input
                                        type="number"
                                        {...register('purchase_price')}
                                        defaultValue={selectedProduct.purchase_price || ''}
                                        readOnly={!!selectedProduct.purchase_price}
                                        className="input input-bordered w-full"
                                    />
                                </div>
                                <div className="w-1/2">
                                    <label className="block font-medium">Selling Price</label>
                                    <input
                                        type="number"
                                        {...register('selling_price')}
                                        defaultValue={selectedProduct.price || ''}
                                        className="input input-bordered w-full"
                                    />
                                </div>
                            </div>

                            {selectedProduct.thumbnail && (
                                <div>
                                    <label className="block font-medium">Image</label>
                                    <img
                                        src={selectedProduct.thumbnail}
                                        alt="Product Thumbnail"
                                        className="w-32 h-32 object-contain border rounded"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block font-medium">Supplier *</label>
                                <select
                                    {...register('supplier_id', { required: 'Supplier is required' })}
                                    className="select select-bordered w-full"
                                >
                                    <option value="">Select Supplier</option>
                                    {supplierList.map((supplier) => (
                                        <option key={supplier.id} value={supplier.id}>
                                            {supplier.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.supplier_id && (
                                    <p className="text-red-500 text-sm">{errors.supplier_id.message}</p>
                                )}
                            </div>

                            <div>
                                <label className="block font-medium">Quantity *</label>
                                <input
                                    type="number"
                                    {...register('qty', { required: 'Quantity is required' })}
                                    className="input input-bordered w-full"
                                />
                                {errors.qty && (
                                    <p className="text-red-500 text-sm">{errors.qty.message}</p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 mt-6">
                        <button type="button" onClick={() => closeModal('add_purchase_modal')} className="btn">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={`btn btn-primary ${loading ? 'loading' : ''}`}
                            disabled={loading}
                        >
                            Submit
                        </button>
                    </div>
                </form>
            </div>
        </dialog>
    );
}
