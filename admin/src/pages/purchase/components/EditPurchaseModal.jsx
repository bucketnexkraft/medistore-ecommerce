import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useSelector } from 'react-redux';
import { updatePurchaseOrder } from '../../../api/purchase';
import { closeModal } from '../../../hooks/modalConfig';
import { toast } from 'react-toastify';
import { searchProduct } from '../../../api/products';

export default function EditPurchaseModal({ purchase, isEdit, supplierList = [], setLoadData }) {
    const accessToken = useSelector((state) => state.auth.accessToken);
    const [formErrors, setFormErrors] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchResults, setSearchResults] = useState([]);

    const {
        register,
        handleSubmit,
        control,
        setValue,
        getValues,
        reset,
        watch,
        formState: { errors },
    } = useForm({
        defaultValues: {
            supplier_id: '',
            payment_status: 'paid',
            date: '',
            products: [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'products',
    });

    // Populate form when editing
    useEffect(() => {
        if (isEdit && purchase) {
            reset({
                supplier_id: purchase?.supplier_id || '',
                payment_status: purchase.payment_status || 'paid',
                date: purchase.created_at || '',
                products: purchase.items?.map(p => ({
                    product_id: p.product_id,
                    name: p.name,
                    thumbnail: p.thumbnail,
                    net_unit_cost: p.net_unit_cost,
                    qty: p.qty,
                    total: p.total,
                })) || [],
            });
        }
    }, [purchase, isEdit, reset]);

    const handleProductSearch = async (searchValue) => {
        if (!searchValue) return;
        try {
            const res = await searchProduct(accessToken, searchValue);
            setSearchResults(res.data || []);
        } catch (err) {
            toast.error('Search failed:' + err);
            // console.error('Search failed:', err);
        }
    };

    const selectProduct = (product) => {
        append({
            product_id: product.id,
            name: product.name,
            thumbnail: product.thumbnail,
            net_unit_cost: product.purchase_price || 0,
            qty: 1,
            total: product.purchase_price || 0,
        });
        setSearchResults([]);
        setValue('search', '');
    };

    const handleQtyChange = (index, qty) => {
        const product = getValues(`products.${index}`);
        const total = parseFloat(product.net_unit_cost) * parseFloat(qty || 0);
        setValue(`products.${index}.qty`, qty);
        setValue(`products.${index}.total`, total.toFixed(2));
    };

    const handleSubmitUpdate = async (data) => {
        setFormErrors('');
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('supplier_id', data.supplier_id);
            formData.append('payment_status', data.payment_status);
            formData.append('date', data.date);
            formData.append('products', JSON.stringify(data.products));

            const response = await updatePurchaseOrder(accessToken, purchase.id, formData);

            if (!response.status) throw new Error(response.message || 'Failed to update purchase');

            toast.success('Purchase updated successfully!');
            setLoadData(true);
            closeModal('edit_purchase_modal');
        } catch (error) {
            setFormErrors(
                error?.response?.data?.errors
                    ? Object.values(error.response.data.errors).join('\n')
                    : error.message || 'Something went wrong.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <dialog id="edit_purchase_modal" className="modal">
            <div className="modal-box w-11/12 max-w-4xl">
                <h3 className="font-bold text-lg mb-4">Edit Purchase</h3>

                {formErrors && (
                    <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
                        <ul>
                            {formErrors.split('\n').map((error, i) => (
                                <li key={i}>{error}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <form onSubmit={handleSubmit(handleSubmitUpdate)} className="space-y-4">
                    <div>
                        <label className="block font-medium">Supplier</label>
                        <select {...register('supplier_id', { required: 'Supplier is required' })} className="select select-bordered w-full">
                            <option value="">Select Supplier</option>
                            {supplierList.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        {errors.supplier_id && <p className="text-red-500 text-sm">{errors.supplier_id.message}</p>}
                    </div>

                    <div>
                        <label className="block font-medium">Date</label>
                        <input type="date" {...register('date', { required: 'Date is required' })} className="input input-bordered w-full" />
                        {errors.date && <p className="text-red-500 text-sm">{errors.date.message}</p>}
                    </div>

                    <div>
                        <label className="block font-medium">Scan Barcode or Search Product</label>
                        <input
                            type="text"
                            className="input input-bordered w-full"
                            {...register('search')}
                            onChange={(e) => handleProductSearch(e.target.value)}
                        />
                        {searchResults.length > 0 && (
                            <div className="border p-2 mt-2 bg-white max-h-64 overflow-y-auto shadow-md rounded">
                                {searchResults.map(p => (
                                    <div key={p.id} className="cursor-pointer hover:bg-gray-100 p-2" onClick={() => selectProduct(p)}>
                                        <p className="font-medium">{p.name}</p>
                                        <p className="text-sm text-gray-500">Code: {p.code}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        {fields.map((item, index) => (
                            <div key={item.id} className="border p-4 rounded bg-gray-50">
                                <div className="flex gap-4 items-center">
                                    {item.thumbnail && (
                                        <img src={item.thumbnail} alt="thumbnail" className="h-16 w-16 object-contain rounded border" />
                                    )}
                                    <div className="flex-1">
                                        <p className="font-medium">{item.name}</p>
                                        <div className="grid grid-cols-2 gap-4 mt-2">
                                            <div>
                                                <label>Purchase Price</label>
                                                <input
                                                    type="number"
                                                    {...register(`products.${index}.net_unit_cost`, { required: true })}
                                                    className="input input-bordered w-full"
                                                    readOnly
                                                />
                                            </div>
                                            <div>
                                                <label>Qty</label>
                                                <input
                                                    type="number"
                                                    className="input input-bordered w-full"
                                                    {...register(`products.${index}.qty`, { required: true })}
                                                    onChange={(e) => handleQtyChange(index, e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label>Total</label>
                                                <input
                                                    type="number"
                                                    {...register(`products.${index}.total`, { required: true })}
                                                    className="input input-bordered w-full"
                                                    readOnly
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <button type="button" className="btn btn-error btn-sm" onClick={() => remove(index)}>
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button type="button" onClick={() => closeModal('edit_purchase_modal')} className="btn">
                            Cancel
                        </button>
                        <button type="submit" className={`btn btn-primary ${loading ? 'loading' : ''}`} disabled={loading}>
                            Update
                        </button>
                    </div>
                </form>
            </div>
        </dialog>
    );
}
