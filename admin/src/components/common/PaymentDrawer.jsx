import React, { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { PiX, PiCreditCard, PiMoney, PiQrCode, PiArrowLeft } from "react-icons/pi";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Swal from "sweetalert2";
import { formatPrice } from "../../hooks/currency";
import { makeInvoicePayment, makePayment } from "../../api/invoice";
import { getPosSettings } from "../../api/companyPreferances";

const getLocalDateString = (date = new Date()) =>
    new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .split("T")[0];

const getScheduleRemaining = (schedule) => {
    const total = Number(schedule?.amount || 0);
    const paid = Number(schedule?.paid_amount || 0);
    return Number(Math.max(0, total - paid).toFixed(2));
};

const PaymentDrawer = ({
    isOpen,
    onClose,
    invoice,
    onPaymentSuccess,
    accessToken
}) => {
    const [currentView, setCurrentView] = useState('schedules'); // 'schedules' or 'payment'
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [paymentMethodsSettings, setPaymentMethodsSettings] = useState([]);

    const { control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
        defaultValues: {
            payment_date: new Date(),
            amount: 0,
            payment_method: 'Cash',
            card_type: '',
            card_digits: '',
            qr_provider: '',
            transaction_no: ''
        }
    });

    const watchedPaymentMethod = watch('payment_method');
    const invoiceDueAmount = Number(invoice?.due_amount || 0);
    const savedSchedules = Array.isArray(invoice?.payment_schedules)
        ? invoice.payment_schedules
        : [];
    const paymentSchedules = savedSchedules.length > 0
        ? savedSchedules
        : invoiceDueAmount > 0
            ? [{
                id: invoice?.id,
                amount: invoiceDueAmount,
                paid_amount: 0,
                due_date: invoice?.date || getLocalDateString(),
                status: 'DUE',
                is_direct_payment: true,
            }]
            : [];

    // Reset form and view when drawer opens/closes
    useEffect(() => {
        if (isOpen) {
            setCurrentView('schedules');
            setSelectedSchedule(null);
            reset();
        }
    }, [isOpen, reset]);

    // Update amount when schedule is selected
    useEffect(() => {
        if (selectedSchedule) {
            setValue('amount', getScheduleRemaining(selectedSchedule));
        }
    }, [selectedSchedule, setValue]);

    useEffect(() => {
        const fetchPaymentMethods = async () => {
            try {
                setProcessing(true);
                const response = await getPosSettings(accessToken);
                const settings = response.data || [];
                // Filter out return-specific methods and Reward Points
                setPaymentMethodsSettings(settings.filter(method =>
                    method.enabled &&
                    !['Cash Refund', 'Refund to Card', 'Refund to MF', 'Reward Points'].includes(method.name)
                ));
            } catch (error) {
                Swal.fire({
                    icon: "error",
                    title: "Error",
                    text: "Failed to fetch payment methods.",
                });
                console.error("Error fetching payment methods:", error);
                setPaymentMethodsSettings([]);
            } finally {
                setProcessing(false);
            }
        };
        if (isOpen) {
            fetchPaymentMethods();
        }
    }, [isOpen, accessToken]);

    const handlePaySchedule = (schedule) => {
        setSelectedSchedule(schedule);
        setCurrentView('payment');
    };

    const handleBackToSchedules = () => {
        setCurrentView('schedules');
        setSelectedSchedule(null);
        reset({
            payment_date: new Date(),
            amount: 0,
            payment_method: 'Cash',
            card_type: '',
            card_digits: '',
            qr_provider: '',
            transaction_no: ''
        });
    };

    const onSubmit = async (data) => {
        setProcessing(true);

        try {
            const remainingAmount = getScheduleRemaining(selectedSchedule);
            const enteredAmount = Number(data.amount || 0);

            if (enteredAmount <= 0) {
                throw new Error("Payment amount must be greater than 0.");
            }
            if (enteredAmount > remainingAmount) {
                throw new Error(`Payment amount cannot exceed ${formatPrice(remainingAmount)}.`);
            }

            // Validate payment method settings
            if (data.payment_method === "Card") {
                const cardSettings = paymentMethodsSettings.find(m => m.name === "Card");
                if (cardSettings?.config?.require_last_digits && !data.card_last_digits) {
                    throw new Error("Card last digits are required.");
                }
                if (data.card_last_digits) {
                    const allowedLengths = cardSettings?.config?.last_digit_length || [5, 6];
                    if (!allowedLengths.includes(data.card_last_digits.length)) {
                        throw new Error(`Card last digits must be ${allowedLengths.join(' or ')} digits.`);
                    }
                }
            }

            if (["QR Payment", "MF Payment"].includes(data.payment_method)) {
                const methodSettings = paymentMethodsSettings.find(m => m.name === data.payment_method);
                if (!data.qr_provider) {
                    throw new Error("QR provider is required.");
                }
                const allowedProviders = methodSettings?.config?.providers || [];
                if (!allowedProviders.includes(data.qr_provider)) {
                    throw new Error("Invalid QR provider.");
                }
                if (!data.qr_transaction_id) {
                    throw new Error("Transaction ID is required.");
                }
            }

            // Ensure date is in YYYY-MM-DD format
            let transactionDate = data.payment_date;
            if (transactionDate instanceof Date) {
                transactionDate = getLocalDateString(transactionDate);
            }

            const paymentData = {
                amount: data.amount,
                payment_method: data.payment_method,
                transaction_date: transactionDate,
                ...(data.payment_method === "Card" && {
                    card_last_digits: data.card_last_digits,
                }),
                ...(["QR Payment", "MF Payment"].includes(data.payment_method) && {
                    qr_provider: data.qr_provider,
                    qr_transaction_id: data.qr_transaction_id,
                }),
            };

            const response = selectedSchedule?.is_direct_payment
                ? await makeInvoicePayment(accessToken, invoice?.id, paymentData)
                : await makePayment(accessToken, selectedSchedule?.id, paymentData);

            Swal.fire({
                icon: "success",
                title: "Payment Successful!",
                text: `Payment of ${formatPrice(data.amount)} has been processed successfully.`,
                showConfirmButton: false,
                timer: 2000,
            });

            if (onPaymentSuccess) {
                onPaymentSuccess(response);
            }

            if (onClose) {
                onClose();
            }
        } catch (error) {
            console.error("Payment error:", error);
            Swal.fire({
                icon: "error",
                title: "Payment Failed",
                text: error.message || error?.response?.data?.message || "Failed to process payment. Please try again.",
            });
        } finally {
            setProcessing(false);
        }
    };

    const getScheduleStatus = (schedule) => {
        const today = new Date();
        const dueDate = new Date(schedule.due_date);
        const remainingAmount = getScheduleRemaining(schedule);

        if (remainingAmount <= 0 || schedule.status === 'PAID') {
            return { status: 'PAID', className: 'badge-success', text: 'Paid' };
        } else if (Number(schedule?.paid_amount || 0) > 0) {
            return { status: 'PARTIAL', className: 'badge-info', text: 'Partial' };
        } else if (dueDate < today) {
            return { status: 'OVERDUE', className: 'badge-error', text: 'Overdue' };
        } else {
            return { status: 'DUE', className: 'badge-warning', text: 'Due' };
        }
    };

    const cardTypes = [
        { value: 'Visa', label: 'Visa' },
        { value: 'Master', label: 'Master' },
        { value: 'Amex', label: 'American Express' },
        { value: 'Discover', label: 'Discover' }
    ];

    const qrProviders = [
        { value: 'bKash', label: 'bKash' },
        { value: 'Nagad', label: 'Nagad' },
        { value: 'Rocket', label: 'Rocket' },
        { value: 'Upay', label: 'Upay' }
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />

            <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl">
                <div className="flex h-full flex-col">
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-gray-100 bg-slate-50 px-6 py-5">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                {currentView === 'schedules' ? 'Payment Schedules' : 'Make Payment'}
                            </h2>
                            <p className="mt-1 text-sm text-gray-600">
                                {invoice?.type === 'purchase' ? 'Purchase invoice' : 'Invoice'} {invoice?.invoice_no}
                            </p>
                        </div>
                        {currentView === 'schedules' ? (
                            <button
                                type="button"
                                onClick={onClose}
                                className="btn btn-circle btn-sm bg-white"
                                title="Close"
                            >
                                <PiX className="w-5 h-5" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleBackToSchedules}
                                className="btn btn-circle btn-sm bg-white"
                                title="Back"
                            >
                                <PiArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {currentView === 'schedules' ? (
                            // Payment Schedules View
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                                        <span className="text-xs font-medium uppercase text-gray-500">Total</span>
                                        <div className="mt-1 text-lg font-semibold text-gray-900">{formatPrice(invoice?.total || 0)}</div>
                                    </div>
                                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                                        <span className="text-xs font-medium uppercase text-emerald-700">Paid</span>
                                        <div className="mt-1 text-lg font-semibold text-emerald-700">
                                            {formatPrice(invoice?.paid_amount || 0)}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-rose-100 bg-rose-50 p-4">
                                        <span className="text-xs font-medium uppercase text-rose-700">Due</span>
                                        <div className="mt-1 text-lg font-semibold text-rose-700">
                                            {formatPrice(invoiceDueAmount)}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                                        <span className="text-xs font-medium uppercase text-gray-500">Status</span>
                                        <div className={`mt-2 badge badge-sm ${invoice?.payment_status === 1 ? 'badge-success' :
                                            invoice?.payment_status === 0 ? 'badge-error' : 'badge-warning'
                                            } text-white`}>
                                            {invoice?.payment_status === 1 ? 'Paid' :
                                                invoice?.payment_status === 0 ? 'Unpaid' : 'Partial'}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="font-medium text-gray-900">Payment Schedule</h3>

                                    {paymentSchedules.length === 0 && (
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
                                            This invoice has no payable due amount.
                                        </div>
                                    )}

                                    {paymentSchedules.map((schedule, index) => {
                                        const scheduleStatus = getScheduleStatus(schedule);
                                        const remainingAmount = getScheduleRemaining(schedule);
                                        const paidAmount = Number(schedule?.paid_amount || 0);

                                        return (
                                            <div key={`${schedule.id}-${index}`} className="rounded-lg border border-gray-200 p-4 transition hover:border-primary/40 hover:shadow-sm">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium">
                                                                {schedule.is_direct_payment ? 'Invoice Due' : `Installment #${index + 1}`}
                                                            </span>
                                                            <span className={`badge badge-sm ${scheduleStatus.className} text-white`}>
                                                                {scheduleStatus.text}
                                                            </span>
                                                        </div>

                                                        <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-600">
                                                            <div>
                                                                <span>Scheduled: </span>
                                                                <span className="font-medium text-gray-900">
                                                                    {formatPrice(schedule.amount)}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span>Paid: </span>
                                                                <span className="font-medium text-green-700">
                                                                    {formatPrice(paidAmount)}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span>Remaining: </span>
                                                                <span className="font-medium text-red-600">
                                                                    {formatPrice(remainingAmount)}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span>Due Date: </span>
                                                                <span className="font-medium text-gray-900">
                                                                    {new Date(schedule.due_date).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {schedule.paid_date && (
                                                            <div className="mt-1 text-sm text-gray-600">
                                                                <span>Paid on: </span>
                                                                <span className="font-medium text-green-600">
                                                                    {new Date(schedule.paid_date).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {scheduleStatus.status !== 'PAID' && (
                                                        <button
                                                            onClick={() => handlePaySchedule(schedule)}
                                                            className="btn btn-sm btn-primary"
                                                        >
                                                            Pay now
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            // Payment Form View
                            (() => {
                                const scheduleRemaining = getScheduleRemaining(selectedSchedule);
                                const schedulePaid = Number(selectedSchedule?.paid_amount || 0);
                                return (
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                <div className="rounded-lg bg-blue-50 p-4">
                                    <h4 className="font-medium text-blue-900">Payment Details</h4>
                                    <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-blue-700">Scheduled:</span>
                                            <div className="font-semibold text-blue-900">
                                                {formatPrice(selectedSchedule?.amount || 0)}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-blue-700">Paid:</span>
                                            <div className="font-semibold text-green-700">
                                                {formatPrice(schedulePaid)}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-blue-700">Remaining:</span>
                                            <div className="font-semibold text-red-700">
                                                {formatPrice(scheduleRemaining)}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-blue-700">Due Date:</span>
                                            <div className="font-semibold text-blue-900">
                                                {selectedSchedule?.due_date ?
                                                    new Date(selectedSchedule.due_date).toLocaleDateString() : 'N/A'
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Payment Date *
                                        </label>
                                        <Controller
                                            control={control}
                                            name="payment_date"
                                            rules={{ required: 'Payment date is required' }}
                                            render={({ field }) => (
                                                <DatePicker
                                                    selected={field.value}
                                                    onChange={field.onChange}
                                                    className="input input-bordered w-full"
                                                    dateFormat="yyyy-MM-dd"
                                                />
                                            )}
                                        />
                                        {errors.payment_date && (
                                            <p className="mt-1 text-sm text-red-600">{errors.payment_date.message}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Amount *
                                        </label>
                                        <Controller
                                            control={control}
                                            name="amount"
                                            rules={{
                                                required: "Amount is required",
                                                min: { value: 0.01, message: "Amount must be greater than 0" },
                                                validate: (value) => Number(value) <= scheduleRemaining || `Amount cannot be greater than ${formatPrice(scheduleRemaining)}`
                                            }}
                                            render={({ field }) => (
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    max={scheduleRemaining}
                                                    className="input input-bordered w-full"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                />
                                            )}
                                        />
                                        {errors.amount && (
                                            <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Payment Method *
                                        </label>
                                        <Controller
                                            control={control}
                                            name="payment_method"
                                            rules={{ required: 'Payment method is required' }}
                                            render={({ field }) => (
                                                <select
                                                    className="select select-bordered w-full"
                                                    value={field.value}
                                                    onChange={(e) => {
                                                        field.onChange(e);
                                                        setValue('card_last_digits', '');
                                                        setValue('qr_provider', '');
                                                        setValue('qr_transaction_id', '');
                                                    }}
                                                >
                                                    <option value="">Select Method</option>
                                                    {paymentMethodsSettings.map((method) => (
                                                        <option key={method.name} value={method.name}>
                                                            {method.name === 'Cash' && '💵 '}
                                                            {method.name === 'Card' && '💳 '}
                                                            {method.name === 'MF Payment' && '📲 '}
                                                            {method.name === 'QR Payment' && '📱 '}
                                                            {method.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        />
                                        {errors.payment_method && (
                                            <p className="mt-1 text-sm text-red-600">{errors.payment_method.message}</p>
                                        )}
                                    </div>

                                    {watchedPaymentMethod === 'Card' && (
                                        <div>
                                            {paymentMethodsSettings.find(m => m.name === 'Card')?.config?.require_last_digits && (
                                                <>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Last 5-6 Digits *
                                                    </label>
                                                    <Controller
                                                        control={control}
                                                        name="card_last_digits"
                                                        rules={{
                                                            required: 'Card digits are required',
                                                            pattern: {
                                                                value: /^\d{5,6}$/,
                                                                message: 'Enter 5-6 digits only'
                                                            }
                                                        }}
                                                        render={({ field }) => (
                                                            <input
                                                                type="text"
                                                                className="input input-bordered w-full"
                                                                placeholder="Enter last 5-6 digits"
                                                                maxLength="6"
                                                                value={field.value}
                                                                onChange={(e) => {
                                                                    const value = e.target.value.replace(/\D/g, '');
                                                                    field.onChange(value);
                                                                }}
                                                            />
                                                        )}
                                                    />
                                                    {errors.card_last_digits && (
                                                        <p className="mt-1 text-sm text-red-600">{errors.card_last_digits.message}</p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {(watchedPaymentMethod === 'QR Payment' || watchedPaymentMethod === 'MF Payment') && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    {watchedPaymentMethod === 'QR Payment' ? 'QR Provider *' : 'MF Provider *'}
                                                </label>
                                                <Controller
                                                    control={control}
                                                    name="qr_provider"
                                                    rules={{ required: `${watchedPaymentMethod} provider is required` }}
                                                    render={({ field }) => (
                                                        <select
                                                            className="select select-bordered w-full"
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                        >
                                                            <option value="">Select Provider</option>
                                                            {paymentMethodsSettings.find(m => m.name === watchedPaymentMethod)?.config?.providers?.map((provider) => (
                                                                <option key={provider} value={provider}>
                                                                    {provider}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}
                                                />
                                                {errors.qr_provider && (
                                                    <p className="mt-1 text-sm text-red-600">{errors.qr_provider.message}</p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Transaction No *
                                                </label>
                                                <Controller
                                                    control={control}
                                                    name="qr_transaction_id"
                                                    rules={{ required: 'Transaction number is required' }}
                                                    render={({ field }) => (
                                                        <input
                                                            type="text"
                                                            className="input input-bordered w-full"
                                                            placeholder="Enter transaction number"
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                        />
                                                    )}
                                                />
                                                {errors.qr_transaction_id && (
                                                    <p className="mt-1 text-sm text-red-600">{errors.qr_transaction_id.message}</p>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={handleBackToSchedules}
                                        className="btn btn-outline flex-1"
                                        disabled={processing}
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        className={`btn btn-primary flex-1 `}
                                        disabled={processing}
                                    >
                                        {processing ? 'Processing...' : 'Pay Now'}
                                    </button>
                                </div>
                            </form>
                                );
                            })()
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentDrawer;
