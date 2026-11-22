import React, { useState } from 'react';
import { closeModal } from '../../../hooks/modalConfig';
import { useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { verifyCouponOrGiftCard } from '../../../api/sales';
import { toast } from 'react-toastify';

export default function DiscountOrRewardModal({ onCouponVerified, isReturn }) {
    const accessToken = useSelector((state) => state.auth.accessToken);
    const { register, handleSubmit, formState: { errors }, reset } = useForm({
        defaultValues: {
            coupon_code: '',
        },
    });
    const [formErrors, setFormErrors] = useState([]);
    const [loading, setLoading] = useState(false);

    const onSubmit = async (data) => {
        if (isReturn) {
            toast.error('Coupons and gift cards cannot be applied in return mode');
            return;
        }

        setFormErrors([]);
        setLoading(true);

        try {
            const result = await verifyCouponOrGiftCard(accessToken, data);

            // Success case
            if (result.status === 1 || result.status === true) {
                toast.success('Coupon or gift card verified!');
                onCouponVerified({
                    code: data.coupon_code,
                    discount: result.data.discount_amount,
                    discountType: result.data.type,
                });
                reset();
                closeModal('verify_coupon_or_gift_card_modal');
            } else {
                // API returned status: 0 with structured error
                const errorMessages = [];

                if (Array.isArray(result.errors)) {
                    errorMessages.push(...result.errors);
                } else if (result.message) {
                    errorMessages.push(result.message);
                } else if (result.error?.message) {
                    errorMessages.push(result.error.message);
                } else {
                    errorMessages.push('Invalid or expired code');
                }

                setFormErrors(errorMessages);
                // toast.error(errorMessages[0]);
            }
        } catch (error) {
            // Network error or unexpected exception
            let errorMessages = ['Something went wrong. Please try again.'];

            if (error.response?.data) {
                const resp = error.response.data;

                if (Array.isArray(resp.errors)) {
                    errorMessages = resp.errors;
                } else if (resp.message) {
                    errorMessages = [resp.message];
                } else if (resp.error?.message) {
                    errorMessages = [resp.error.message];
                }
            }

            setFormErrors(errorMessages);
            // toast.error(errorMessages[0]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <dialog id="verify_coupon_or_gift_card_modal" className="modal" aria-modal="true">
            <div className="modal-box w-11/12 max-w-lg flex flex-col p-0">
                {/* Fixed Header */}
                <div className="sticky top-0 bg-white z-10 border-b border-gray-200 p-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg">Verify Coupon / Gift Card</h3>
                        <button
                            type="button"
                            className="btn btn-sm btn-circle"
                            onClick={() => closeModal('verify_coupon_or_gift_card_modal')}
                            aria-label="Close modal"
                            disabled={loading}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto py-4 px-6">
                    {formErrors.length > 0 && (
                        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
                            <ul className="list-disc list-inside">
                                {formErrors.map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                        <div className="w-full">
                            <label htmlFor="coupon_code" className="block mb-1">
                                Enter Coupon Code / Gift Card Number
                            </label>
                            <input
                                id="coupon_code"
                                type="text"
                                {...register('coupon_code', { required: 'Coupon code or gift card number is required' })}
                                className="input input-bordered w-full"
                                aria-invalid={errors.coupon_code ? 'true' : 'false'}
                                disabled={loading}
                            />
                            {errors.coupon_code && (
                                <p className="text-red-500 text-sm mt-1">{errors.coupon_code.message}</p>
                            )}
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                className="btn btn-ghost h-10 min-h-10"
                                onClick={() => closeModal('verify_coupon_or_gift_card_modal')}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary h-10 min-h-10"
                                disabled={loading}
                            >
                                {loading ? (
                                    <span className="loading loading-spinner"></span>
                                ) : (
                                    'Verify & Save'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </dialog>
    );
}