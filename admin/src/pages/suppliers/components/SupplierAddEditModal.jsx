import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { closeModal } from '../../../hooks/modalConfig';

const SupplierAddEditModal = ({
    isEdit,
    editableData,
    onSubmit,
    isDrawer = false,
    errorMessage = ''
}) => {
    const {
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors, isSubmitting },
    } = useForm({
        defaultValues: {
            name: '',
            email: '',
            phone_number: '',
            address: '',
            status: 1,
        }
    });

    const status = watch('status');

    useEffect(() => {
        if (isEdit && editableData) {
            reset({
                name: editableData.name || '',
                email: editableData.email || '',
                phone_number: editableData.phone || '',
                address: editableData.address || '',
                status: editableData.status ?? 1,
            });
        } else {
            reset({
                name: '',
                email: '',
                phone_number: '',
                address: '',
                status: 1,
            });
        }
    }, [isEdit, editableData, reset]);

    const handleStatusChange = (e) => {
        setValue('status', e.target.checked ? 1 : 0);
    };

    const onFormSubmit = async (data) => {
        try {
            await onSubmit(data);
            // Only reset the form on successful submission
            reset({
                name: '',
                email: '',
                phone_number: '',
                address: '',
                status: 1,
            });
        } catch (error) {
            // Optionally, you can handle the error here (e.g., show a toast notification)
            console.error('API error:', error);
            // Do not reset the form, so the current values are preserved
        }
    };

    return (
        <>
        {isDrawer ? (
            <form onSubmit={handleSubmit(onFormSubmit)}>
                    <div className="grid gap-4">
                        {/* Name Field */}
                        <div className="form-control">
                            <label className="label" htmlFor="name">
                                <span className="label-text">Supplier Name*</span>
                            </label>
                            <input
                                type="text"
                                id="name"
                                {...register("name", { required: "Supplier name is required" })}
                                className={`input input-bordered ${errors.name ? 'input-error' : ''}`}
                                placeholder="Enter supplier name"
                            />
                            {errors.name && (
                                <label className="label">
                                    <span className="label-text-alt text-error">
                                        {errors.name.message}
                                    </span>
                                </label>
                            )}
                        </div>

                        {/* Email Field */}
                        <div className="form-control">
                            <label className="label" htmlFor="email">
                                <span className="label-text">Email*</span>
                            </label>
                            <input
                                type="email"
                                id="email"
                                {...register("email", {
                                    required: "Email is required",
                                    pattern: {
                                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                        message: "Enter a valid email address",
                                    },
                                })}
                                className={`input input-bordered ${errors.email ? 'input-error' : ''}`}
                                placeholder="example@gmail.com"
                            />
                            {errors.email && (
                                <label className="label">
                                    <span className="label-text-alt text-error">
                                        {errors.email.message}
                                    </span>
                                </label>
                            )}
                        </div>

                        {/* Phone Number Field */}
                        <div className="form-control">
                            <label className="label" htmlFor="phone_number">
                                <span className="label-text">Phone Number*</span>
                            </label>
                            <input
                                type="text"
                                id="phone_number"
                                {...register("phone_number", {
                                    required: "Phone number is required",
                                })}
                                className={`input input-bordered ${errors.phone_number ? 'input-error' : ''}`}
                                placeholder="e.g. 01987899273"
                            />
                            {errors.phone_number && (
                                <label className="label">
                                    <span className="label-text-alt text-error">
                                        {errors.phone_number.message}
                                    </span>
                                </label>
                            )}
                        </div>

                        {/* Address Field */}
                        <div className="form-control">
                            <label className="label" htmlFor="address">
                                <span className="label-text">Address</span>
                            </label>
                            <textarea
                                id="address"
                                {...register("address")}
                                className="textarea textarea-bordered"
                                placeholder="e.g. Dhaka, Bangladesh"
                            />
                        </div>

                        {/* Status Field */}
                        <div className="form-control">
                            <label className="label cursor-pointer justify-start gap-4">
                                <input
                                    type="checkbox"
                                    checked={status === 1}
                                    onChange={handleStatusChange}
                                    className="toggle toggle-primary"
                                />
                                <span className="label-text">Active</span>
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => {
                                    closeModal('add_edit_supplier_modal');
                                    reset({
                                        name: '',
                                        email: '',
                                        phone_number: '',
                                        address: '',
                                        status: 1,
                                    });
                                }}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className={`btn btn-primary ${isSubmitting ? 'loading' : ''}`}
                                onClick={handleSubmit(onFormSubmit)}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Processing...' : isEdit ? 'Update' : 'Save'}
                            </button>
                        </div>
                        {errorMessage && (
                            <div className="alert alert-error text-sm">
                                <span className="whitespace-pre-line">{errorMessage}</span>
                            </div>
                        )}
                    </div>
                </form>
        ) : (
            <dialog id="add_edit_supplier_modal" className="modal">
                <div className="modal-box w-11/12 max-w-3xl flex flex-col p-0">
                    {/* Fixed Header */}
                    <div className="sticky top-0 bg-white z-10 border-b border-gray-200 p-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-lg">
                                {isEdit ? 'Edit Supplier' : 'Add New Supplier'}
                            </h3>
                            <button
                                type="button"
                                className="btn btn-sm btn-circle"
                                onClick={() => {
                                    closeModal('add_edit_supplier_modal');
                                    reset({
                                        name: '',
                                        email: '',
                                        phone_number: '',
                                        address: '',
                                        status: 1,
                                    });
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto py-4 px-6">
                        <form onSubmit={handleSubmit(onFormSubmit)}>
                            <div className="grid gap-4">
                                {/* Name Field */}
                                <div className="form-control">
                                    <label className="label" htmlFor="name">
                                        <span className="label-text">Supplier Name*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="name"
                                        {...register("name", { required: "Supplier name is required" })}
                                        className={`input input-bordered ${errors.name ? 'input-error' : ''}`}
                                        placeholder="Enter supplier name"
                                    />
                                    {errors.name && (
                                        <label className="label">
                                            <span className="label-text-alt text-error">
                                                {errors.name.message}
                                            </span>
                                        </label>
                                    )}
                                </div>

                                {/* Email Field */}
                                <div className="form-control">
                                    <label className="label" htmlFor="email">
                                        <span className="label-text">Email*</span>
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        {...register("email", {
                                            required: "Email is required",
                                            pattern: {
                                                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                                message: "Enter a valid email address",
                                            },
                                        })}
                                        className={`input input-bordered ${errors.email ? 'input-error' : ''}`}
                                        placeholder="example@gmail.com"
                                    />
                                    {errors.email && (
                                        <label className="label">
                                            <span className="label-text-alt text-error">
                                                {errors.email.message}
                                            </span>
                                        </label>
                                    )}
                                </div>

                                {/* Phone Number Field */}
                                <div className="form-control">
                                    <label className="label" htmlFor="phone_number">
                                        <span className="label-text">Phone Number*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="phone_number"
                                        {...register("phone_number", {
                                            required: "Phone number is required",
                                        })}
                                        className={`input input-bordered ${errors.phone_number ? 'input-error' : ''}`}
                                        placeholder="e.g. 01987899273"
                                    />
                                    {errors.phone_number && (
                                        <label className="label">
                                            <span className="label-text-alt text-error">
                                                {errors.phone_number.message}
                                            </span>
                                        </label>
                                    )}
                                </div>

                                {/* Address Field */}
                                <div className="form-control">
                                    <label className="label" htmlFor="address">
                                        <span className="label-text">Address</span>
                                    </label>
                                    <textarea
                                        id="address"
                                        {...register("address")}
                                        className="textarea textarea-bordered"
                                        placeholder="e.g. Dhaka, Bangladesh"
                                    />
                                </div>

                                {/* Status Field */}
                                <div className="form-control">
                                    <label className="label cursor-pointer justify-start gap-4">
                                        <input
                                            type="checkbox"
                                            checked={status === 1}
                                            onChange={handleStatusChange}
                                            className="toggle toggle-primary"
                                        />
                                        <span className="label-text">Active</span>
                                    </label>
                                </div>
                                {errorMessage && (
                                    <div className="alert alert-error text-sm">
                                        <span className="whitespace-pre-line">{errorMessage}</span>
                                    </div>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Fixed Footer */}
                    <div className="sticky bottom-0 bg-white z-10 border-t border-gray-200 p-4">
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                className="btn btn-ghost h-10 min-h-10"
                                onClick={() => {
                                    closeModal('add_edit_supplier_modal');
                                    reset({
                                        name: '',
                                        email: '',
                                        phone_number: '',
                                        address: '',
                                        status: 1,
                                    });
                                }}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className={`btn btn-primary h-10 min-h-10 ${isSubmitting ? 'loading' : ''}`}
                                onClick={handleSubmit(onFormSubmit)}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Processing...' : isEdit ? 'Update' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>

                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>
        )}
        </>
    );
};

export default SupplierAddEditModal;
