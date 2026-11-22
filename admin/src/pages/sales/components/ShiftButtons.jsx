import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
    cashHandover,
    getCurrentShift,
    getShiftCloseSummary,
    getUsers,
    handoverShift,
    startShift,
} from "../../../api/timesheet";
import { PiArrowRight, PiNotepad, PiUsers, PiX } from "react-icons/pi";
import { BsCash, BsCashStack } from "react-icons/bs";

const ShiftButtons = ({ setShiftData, hideTrigger = false }) => {
    const accessToken = useSelector((state) => state.auth.accessToken);
    const user = useSelector((state) => state.auth.user);

    const [hasActiveShift, setHasActiveShift] = useState(false);
    const [loadingShift, setLoadingShift] = useState(true);
    const [users, setUsers] = useState([]);
    
    // Drawer states
    const [showStartShiftDrawer, setShowStartShiftDrawer] = useState(false);
    const [showHandoverDrawer, setShowHandoverDrawer] = useState(false);
    const [showCashHandoverDrawer, setShowCashHandoverDrawer] = useState(false);
    
    // Form states for Start Shift
    const [startShiftData, setStartShiftData] = useState({
        cash_in_hand: "",
        comments: ""
    });
    
    // Form states for Handover
    const [handoverData, setHandoverData] = useState({
        subject_user_id: "",
        cash_out_hand: "",
        cash_in_hand: "",
        comments: ""
    });
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [closeSummary, setCloseSummary] = useState(null);
    const [cashDropData, setCashDropData] = useState({
        amount: "",
        received_by_user_id: "",
        notes: ""
    });
    
    // Refs for focus management
    const cashInHandRef = useRef(null);
    const nextUserRef = useRef(null);

    const syncShiftState = async () => {
        try {
            setLoadingShift(true);
            const res = await getCurrentShift(accessToken);
            const shift = res?.data?.id ? res.data : res;
            const isActive = !!shift?.id;
            setHasActiveShift(isActive);
            setShiftData(isActive);
            return isActive;
        } catch (err) {
            if (err?.response?.status === 404) {
                setHasActiveShift(false);
                setShiftData(false);
                return false;
            }
            return hasActiveShift;
        } finally {
            setLoadingShift(false);
        }
    };

    // Load all active cashiers for handover dropdown
    useEffect(() => {
        (async () => {
            try {
                const res = await getUsers(accessToken);
                setUsers(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error("Failed to load users:", err);
            }
        })();
    }, [accessToken]);

    // Check current user's active shift
    useEffect(() => {
        syncShiftState();
    }, [accessToken, setShiftData]);

    // Focus management for drawers
    useEffect(() => {
        if (showStartShiftDrawer) {
            setTimeout(() => cashInHandRef.current?.focus(), 100);
        }
    }, [showStartShiftDrawer]);

    useEffect(() => {
        if (showHandoverDrawer) {
            setTimeout(() => nextUserRef.current?.focus(), 100);
            (async () => {
                try {
                    const summary = await getShiftCloseSummary(accessToken);
                    setCloseSummary(summary);
                    const expected = Number(summary?.expected_closing_cash || 0);
                    setHandoverData((prev) => ({
                        ...prev,
                        cash_out_hand: expected ? expected.toFixed(2) : prev.cash_out_hand,
                        cash_in_hand: expected ? expected.toFixed(2) : prev.cash_in_hand,
                    }));
                } catch (e) {
                    setCloseSummary(null);
                }
            })();
        } else {
            setCloseSummary(null);
        }
    }, [showHandoverDrawer, accessToken]);

    useEffect(() => {
        if (showCashHandoverDrawer) {
            (async () => {
                try {
                    const summary = await getShiftCloseSummary(accessToken);
                    setCloseSummary(summary);
                } catch (e) {
                    setCloseSummary(null);
                }
            })();
        }
    }, [showCashHandoverDrawer, accessToken]);

    useEffect(() => {
        const handleOpenShiftDrawer = () => {
            if (hasActiveShift) {
                setShowHandoverDrawer(true);
            } else {
                setShowStartShiftDrawer(true);
            }
        };
        const handleOpenCashHandoverDrawer = () => {
            setShowCashHandoverDrawer(true);
        };

        window.addEventListener("pos-shift:open", handleOpenShiftDrawer);
        window.addEventListener("pos-cash-handover:open", handleOpenCashHandoverDrawer);
        return () => {
            window.removeEventListener("pos-shift:open", handleOpenShiftDrawer);
            window.removeEventListener("pos-cash-handover:open", handleOpenCashHandoverDrawer);
        };
    }, [hasActiveShift]);

    // Handle Start Shift
    const handleStartShiftSubmit = async () => {
        if (!startShiftData.cash_in_hand || parseFloat(startShiftData.cash_in_hand) < 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        setIsSubmitting(true);
        try {
            await startShift(accessToken, {
                cash_in_hand: parseFloat(startShiftData.cash_in_hand),
                comments: startShiftData.comments.trim()
            });
            toast.success("Shift started successfully!");
            setHasActiveShift(true);
            setShiftData(true);
            setShowStartShiftDrawer(false);
            setStartShiftData({ cash_in_hand: "", comments: "" });
        } catch (err) {
            console.error("Failed to start shift:", err);
            const message = err?.message || err?.response?.data?.message || "Failed to start shift";
            if (String(message).toLowerCase().includes("already have an active shift")) {
                await syncShiftState();
                setShowStartShiftDrawer(false);
                toast.success("Active shift found. Sales are now enabled.");
                return;
            }
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Handover Shift
    const handleHandoverSubmit = async () => {
        if (!handoverData.subject_user_id) {
            toast.error("Please select next cashier");
            return;
        }
        if (!handoverData.cash_out_hand || parseFloat(handoverData.cash_out_hand) < 0) {
            toast.error("Enter valid cash out amount");
            return;
        }
        if (!handoverData.cash_in_hand || parseFloat(handoverData.cash_in_hand) < 0) {
            toast.error("Enter valid cash in amount");
            return;
        }
        if (parseFloat(handoverData.cash_in_hand) > parseFloat(handoverData.cash_out_hand)) {
            toast.error("Handover cash cannot be greater than actual closing cash");
            return;
        }

        setIsSubmitting(true);
        try {
            await handoverShift(accessToken, {
                subject_user_id: handoverData.subject_user_id,
                cash_out_hand: parseFloat(handoverData.cash_out_hand),
                cash_in_hand: parseFloat(handoverData.cash_in_hand),
                comments: handoverData.comments.trim()
            });
            toast.success("Shift handed over successfully!");
            setHasActiveShift(false);
            setShiftData(false);
            setShowHandoverDrawer(false);
            setHandoverData({
                subject_user_id: "",
                cash_out_hand: "",
                cash_in_hand: "",
                comments: ""
            });
        } catch (err) {
            toast.error(err.response?.data?.message || "Handover failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCashDropSubmit = async () => {
        if (!cashDropData.amount || parseFloat(cashDropData.amount) <= 0) {
            toast.error("Enter a valid cash handover amount");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await cashHandover(accessToken, {
                amount: parseFloat(cashDropData.amount),
                received_by_user_id: cashDropData.received_by_user_id || null,
                notes: cashDropData.notes?.trim() || null,
            });

            if (response?.cashflow_summary) {
                setCloseSummary(response.cashflow_summary);
            }
            setCashDropData({ amount: "", received_by_user_id: "", notes: "" });
            setShowCashHandoverDrawer(false);
            toast.success("Cash handover recorded");
        } catch (err) {
            toast.error(err?.message || "Failed to record cash handover");
        } finally {
            setIsSubmitting(false);
        }
    };

    const currentCashInHand = Number(closeSummary?.expected_closing_cash || 0);
    const handoverAmount = Number(cashDropData.amount || 0);
    const cashAfterHandover = Math.max(currentCashInHand - handoverAmount, 0);

    if (loadingShift) {
        return (
            <div className="flex justify-center py-6">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    return (
        <>
            {!hideTrigger && (
                <div className="flex gap-3 mt-5">
                    {!hasActiveShift ? (
                        <button
                            onClick={() => setShowStartShiftDrawer(true)}
                            className="btn btn-success btn-lg flex-1"
                        >
                            Start Shift
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowCashHandoverDrawer(true)}
                                className="btn btn-info btn-lg flex-1"
                            >
                                Cash Handover
                            </button>
                            <button
                                onClick={() => setShowHandoverDrawer(true)}
                                className="btn btn-warning btn-lg flex-1"
                            >
                                Handover Shift
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Start Shift Drawer */}
            {showStartShiftDrawer && (
                <div className="fixed inset-0 z-50 overflow-hidden">
                    <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowStartShiftDrawer(false)} />
                    <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl">
                        <div className="flex flex-col h-full">
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                                <h2 className="text-xl font-semibold text-gray-800">Start Shift</h2>
                                <button
                                    onClick={() => setShowStartShiftDrawer(false)}
                                    className="btn btn-ghost btn-sm btn-circle"
                                    disabled={isSubmitting}
                                >
                                    <PiX size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex flex-col flex-1 overflow-hidden">
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {/* Cash in Hand */}
                                    <div>
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <BsCash size={18} className="text-gray-500" />
                                                Starting Cash in Hand
                                                <span className="text-red-500">*</span>
                                            </span>
                                        </label>
                                        <input
                                            ref={cashInHandRef}
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={startShiftData.cash_in_hand}
                                            onChange={(e) => setStartShiftData({
                                                ...startShiftData,
                                                cash_in_hand: e.target.value
                                            })}
                                            className="input input-bordered w-full focus:border-blue-500 focus:outline-none transition-colors"
                                            disabled={isSubmitting}
                                            required
                                        />
                                    </div>

                                    {/* Comments */}
                                    <div>
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <PiNotepad size={18} className="text-gray-500" />
                                                Comments (Optional)
                                            </span>
                                        </label>
                                        <textarea
                                            placeholder="e.g. Received from previous shift"
                                            value={startShiftData.comments}
                                            onChange={(e) => setStartShiftData({
                                                ...startShiftData,
                                                comments: e.target.value
                                            })}
                                            className="textarea textarea-bordered w-full h-24 focus:border-blue-500 focus:outline-none transition-colors resize-none"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="border-t border-gray-200 p-4 bg-gray-50">
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowStartShiftDrawer(false)}
                                            className="btn btn-outline flex-1"
                                            disabled={isSubmitting}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleStartShiftSubmit}
                                            className="btn btn-success flex-1"
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? (
                                                <span className="loading loading-spinner loading-sm" />
                                            ) : (
                                                "Start Shift"
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Handover Shift Drawer */}
            {showHandoverDrawer && (
                <div className="fixed inset-0 z-50 overflow-hidden">
                    <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowHandoverDrawer(false)} />
                    <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl">
                        <div className="flex flex-col h-full">
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                                <h2 className="text-xl font-semibold text-gray-800">Handover Shift</h2>
                                <button
                                    onClick={() => setShowHandoverDrawer(false)}
                                    className="btn btn-ghost btn-sm btn-circle"
                                    disabled={isSubmitting}
                                >
                                    <PiX size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex flex-col flex-1 overflow-hidden">
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {/* Next Cashier */}
                                    <div>
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <PiUsers size={18} className="text-gray-500" />
                                                Next Cashier
                                                <span className="text-red-500">*</span>
                                            </span>
                                        </label>
                                        <select
                                            ref={nextUserRef}
                                            value={handoverData.subject_user_id}
                                            onChange={(e) => setHandoverData({
                                                ...handoverData,
                                                subject_user_id: e.target.value
                                            })}
                                            className="select select-bordered w-full focus:border-blue-500 focus:outline-none transition-colors"
                                            disabled={isSubmitting}
                                            required
                                        >
                                            <option value="">-- Select cashier --</option>
                                            {users
                                                .filter((u) => u.id !== user?.id)
                                                .map((u) => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.first_name} {u?.last_name}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>

                                    {/* Cash Out Hand */}
                                    {closeSummary && (
                                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1 text-sm">
                                            <div className="font-semibold text-blue-900">Shift Cash Flow Summary</div>
                                            <div>Opening Cash: {Number(closeSummary.opening_cash || 0).toFixed(2)}</div>
                                            <div>Cash Sales: {Number(closeSummary.total_sales_cash || 0).toFixed(2)}</div>
                                            <div>Cash Refunds: {Number(closeSummary.total_refund_cash || 0).toFixed(2)}</div>
                                            <div className="font-medium">Expected Closing: {Number(closeSummary.expected_closing_cash || 0).toFixed(2)}</div>
                                            <div>Total Transactions: {Number(closeSummary.total_transactions || 0)}</div>
                                        </div>
                                    )}

                                    {/* Cash Out Hand */}
                                    <div>
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <BsCash size={18} className="text-gray-500" />
                                                Actual Cash Count at Shift End
                                                <span className="text-red-500">*</span>
                                            </span>
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={handoverData.cash_out_hand}
                                            onChange={(e) => setHandoverData({
                                                ...handoverData,
                                                cash_out_hand: e.target.value
                                            })}
                                            className="input input-bordered w-full focus:border-blue-500 focus:outline-none transition-colors"
                                            disabled={isSubmitting}
                                            required
                                        />
                                    </div>

                                    {/* Cash In Hand */}
                                    <div>
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <PiArrowRight size={18} className="text-gray-500" />
                                                Cash Given to Next Cashier
                                                <span className="text-red-500">*</span>
                                            </span>
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={handoverData.cash_in_hand}
                                            onChange={(e) => setHandoverData({
                                                ...handoverData,
                                                cash_in_hand: e.target.value
                                            })}
                                            className="input input-bordered w-full focus:border-blue-500 focus:outline-none transition-colors"
                                            disabled={isSubmitting}
                                            required
                                        />
                                        <label className="label">
                                            <span className="label-text-alt text-gray-500">Normally this is the same as your actual cash count</span>
                                        </label>
                                        {closeSummary && handoverData.cash_out_hand !== "" && (
                                            <label className="label">
                                                <span className="label-text-alt text-gray-500">
                                                    Variance: {(parseFloat(handoverData.cash_out_hand || 0) - parseFloat(closeSummary.expected_closing_cash || 0)).toFixed(2)}
                                                </span>
                                            </label>
                                        )}
                                    </div>

                                    {/* Comments */}
                                    <div>
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <PiNotepad size={18} className="text-gray-500" />
                                                Handover Notes
                                            </span>
                                        </label>
                                        <textarea
                                            placeholder="Any issues, missing items, etc."
                                            value={handoverData.comments}
                                            onChange={(e) => setHandoverData({
                                                ...handoverData,
                                                comments: e.target.value
                                            })}
                                            className="textarea textarea-bordered w-full h-24 focus:border-blue-500 focus:outline-none transition-colors resize-none"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="border-t border-gray-200 p-4 bg-gray-50">
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowHandoverDrawer(false)}
                                            className="btn btn-outline flex-1"
                                            disabled={isSubmitting}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleHandoverSubmit}
                                            className="btn btn-warning flex-1"
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? (
                                                <span className="loading loading-spinner loading-sm" />
                                            ) : (
                                                "Handover Shift"
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Cash Handover Drawer */}
            {showCashHandoverDrawer && (
                <div className="fixed inset-0 z-50 overflow-hidden">
                    <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowCashHandoverDrawer(false)} />
                    <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl">
                        <div className="flex flex-col h-full">
                            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                                <h2 className="text-xl font-semibold text-gray-800">Cash Handover</h2>
                                <button
                                    onClick={() => setShowCashHandoverDrawer(false)}
                                    className="btn btn-ghost btn-sm btn-circle"
                                    disabled={isSubmitting}
                                >
                                    <PiX size={20} />
                                </button>
                            </div>

                            <div className="flex flex-col flex-1 overflow-hidden">
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {closeSummary && (
                                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1 text-sm">
                                            <div className="font-semibold text-blue-900">Current Cash Status</div>
                                            <div>Expected Cash Now: {Number(closeSummary.expected_closing_cash || 0).toFixed(2)}</div>
                                            <div>Total Cash Handed Over: {Number(closeSummary.total_cash_handed_over || 0).toFixed(2)}</div>
                                        </div>
                                    )}

                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-sm">
                                        <div className="font-semibold text-slate-800">Cash In Hand Preview</div>
                                        <div>Total Cash in Hand (Before): {currentCashInHand.toFixed(2)}</div>
                                        <div>Cash After This Handover: {cashAfterHandover.toFixed(2)}</div>
                                    </div>

                                    <div>
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <BsCashStack size={18} className="text-gray-500" />
                                                Cash Amount to Handover
                                                <span className="text-red-500">*</span>
                                            </span>
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={cashDropData.amount}
                                            onChange={(e) => setCashDropData((prev) => ({ ...prev, amount: e.target.value }))}
                                            className="input input-bordered w-full focus:border-blue-500 focus:outline-none transition-colors"
                                            disabled={isSubmitting}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <PiUsers size={18} className="text-gray-500" />
                                                Received By (Optional)
                                            </span>
                                        </label>
                                        <select
                                            value={cashDropData.received_by_user_id}
                                            onChange={(e) => setCashDropData((prev) => ({ ...prev, received_by_user_id: e.target.value }))}
                                            className="select select-bordered w-full focus:border-blue-500 focus:outline-none transition-colors"
                                            disabled={isSubmitting}
                                        >
                                            <option value="">-- Select manager/cash receiver --</option>
                                            {users
                                                .filter((u) => u.id !== user?.id)
                                                .map((u) => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.first_name} {u?.last_name}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="label">
                                            <span className="label-text font-medium flex items-center gap-2">
                                                <PiNotepad size={18} className="text-gray-500" />
                                                Cash Handover Note (Optional)
                                            </span>
                                        </label>
                                        <textarea
                                            placeholder="e.g. Manager collected cash from counter"
                                            value={cashDropData.notes}
                                            onChange={(e) => setCashDropData((prev) => ({ ...prev, notes: e.target.value }))}
                                            className="textarea textarea-bordered w-full h-24 focus:border-blue-500 focus:outline-none transition-colors resize-none"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-gray-200 p-4 bg-gray-50">
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowCashHandoverDrawer(false)}
                                            className="btn btn-outline flex-1"
                                            disabled={isSubmitting}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCashDropSubmit}
                                            className="btn btn-info flex-1"
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? (
                                                <span className="loading loading-spinner loading-sm" />
                                            ) : (
                                                "Confirm Cash Handover"
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ShiftButtons;
