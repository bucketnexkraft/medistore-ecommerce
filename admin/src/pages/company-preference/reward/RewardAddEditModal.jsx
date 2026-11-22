import { useForm, Controller } from "react-hook-form";
import { useState, useEffect } from "react";
import { closeModal } from "../../../hooks/modalConfig";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useSelector } from "react-redux";
import { storeRewards, updateRewards } from "../../../api/reward";
import { toast } from "react-toastify";
import { PiX } from "react-icons/pi";

export default function RewardAddEditModal({ reward, onClose }) {
    const accessToken = useSelector((state) => state.auth.accessToken);
    const {
        register,
        handleSubmit,
        formState: { errors },
        control,
        reset,
        setValue,
    } = useForm();
    const [redeemType, setRedeemType] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    // Populate form with existing reward data
    useEffect(() => {
        if (reward) {
            reset({
                dateRange: reward.form_date && reward.to_date
                    ? [new Date(reward.form_date), new Date(reward.to_date)]
                    : null,
                amount: reward.amount || "",
                rewardPoint: reward.reword_unit || "",
                rewardValue: reward.reword_value || "",
                redeemType: reward.redeem_type || "",
            });
            setRedeemType(reward.redeem_type || "");
        } else {
            reset({
                dateRange: null,
                amount: "",
                rewardPoint: "",
                rewardValue: "",
                redeemType: "",
            });
            setRedeemType("");
        }
        setErrorMessage("");
    }, [reward, reset]);

    const onSubmit = async (data) => {
        setLoading(true);
        setErrorMessage("");
        try {
            const toNumberOrNull = (value) =>
                value === "" || value === null || value === undefined
                    ? null
                    : Number(value);

            const formattedData = {
                form_date: data.dateRange && data.dateRange[0]
                    ? data.dateRange[0].toISOString().split("T")[0]
                    : null,
                to_date: data.dateRange && data.dateRange[1]
                    ? data.dateRange[1].toISOString().split("T")[0]
                    : null,
                amount: toNumberOrNull(data.amount),
                reword_unit: toNumberOrNull(data.rewardPoint),
                reword_value: toNumberOrNull(data.rewardValue),
                redeem_type: data.redeemType,
            };

            let response;
            if (reward) {
                response = await updateRewards(
                    accessToken,
                    formattedData,
                    reward.id
                );
                toast.success("Reward updated successfully");
            } else {
                response = await storeRewards(accessToken, formattedData);
                toast.success("Reward added successfully");
            }
            reset({
                dateRange: null,
                amount: "",
                rewardPoint: "",
                rewardValue: "",
                redeemType: "",
            });
            setRedeemType("");
            onClose();
            window.dispatchEvent(new Event("rewardUpdated"));
        } catch (error) {
            setErrorMessage(error.message || "Failed to save reward");
        } finally {
            setLoading(false);
        }
    };

    return (
        <dialog id="reward_add_edit_modal" className="modal">
            <div className="modal-box w-11/12 max-w-2xl flex flex-col p-0">
                {/* Fixed Header */}
                <div className="sticky top-0 bg-white z-10 border-b border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold">
                            {reward ? "Edit Reward" : "Add Reward"}
                        </h2>
                        <button
                            type="button"
                            className="btn btn-sm btn-circle"
                            onClick={() => closeModal("reward_add_edit_modal")}
                        >
                            <PiX size={20} />
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto py-4 px-6">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {/* Reward validity period */}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-semibold">Reward Validity Period</span>
                            </label>
                            <Controller
                                control={control}
                                name="dateRange"
                                rules={{
                                    required: "Date range is required",
                                    validate: (value) =>
                                        value && value[0] && value[1]
                                            ? true
                                            : "Both start and end dates are required",
                                }}
                                render={({ field }) => (
                                    <DatePicker
                                        selectsRange
                                        startDate={field.value ? field.value[0] : null}
                                        endDate={field.value ? field.value[1] : null}
                                        onChange={(dates) => field.onChange(dates)}
                                        className="input input-bordered w-full text-sm"
                                        dateFormat="yyyy-MM-dd"
                                        placeholderText="Select when rewards are active"
                                        disabled={loading}
                                        minDate={new Date()}
                                    />
                                )}
                            />
                            <span className="label-text-alt text-gray-500">
                                Customers can earn and use points only during this period.
                            </span>
                            {errors.dateRange && (
                                <span className="text-error text-xs mt-1">
                                    {errors.dateRange.message}
                                </span>
                            )}
                        </div>

                        {/* Spend threshold */}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-semibold">Spend Amount to Earn Points</span>
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                {...register("amount", {
                                    required: "Amount is required",
                                    min: { value: 0, message: "Amount must be positive" },
                                })}
                                className="input input-bordered w-full text-sm"
                                placeholder="e.g. 100"
                                disabled={loading}
                            />
                            <span className="label-text-alt text-gray-500">
                                The customer must spend this amount to receive points.
                            </span>
                            {errors.amount && (
                                <span className="text-error text-xs mt-1">
                                    {errors.amount.message}
                                </span>
                            )}
                        </div>

                        {/* Points earned */}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-semibold">Points Earned per Spend Amount</span>
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                {...register("rewardPoint", {
                                    required: "Points earned is required",
                                    min: { value: 0, message: "Points earned must be positive" },
                                })}
                                className="input input-bordered w-full text-sm"
                                placeholder="e.g. 10"
                                disabled={loading}
                            />
                            <span className="label-text-alt text-gray-500">
                                Number of points awarded when the spend amount above is reached.
                            </span>
                            {errors.rewardPoint && (
                                <span className="text-error text-xs mt-1">
                                    {errors.rewardPoint.message}
                                </span>
                            )}
                        </div>

                        {/* Point redemption value */}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-semibold">Value of 1 Reward Point</span>
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                {...register("rewardValue", {
                                    required: "Point value is required",
                                    min: { value: 0, message: "Point value must be positive" },
                                })}
                                className="input input-bordered w-full text-sm"
                                placeholder="e.g. 1.00"
                                disabled={loading}
                            />
                            <span className="label-text-alt text-gray-500">
                                Discount value of each point when it is redeemed.
                            </span>
                            {errors.rewardValue && (
                                <span className="text-error text-xs mt-1">
                                    {errors.rewardValue.message}
                                </span>
                            )}
                        </div>

                        {/* Point redemption options */}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-semibold">Where Customers Can Use Points</span>
                            </label>
                            <select
                                {...register("redeemType", {
                                    required: "Point usage option is required",
                                })}
                                className="select select-bordered w-full text-sm"
                                onChange={(e) => {
                                    setRedeemType(e.target.value);
                                    setValue("redeemType", e.target.value);
                                }}
                                disabled={loading}
                            >
                                <option value="">Select where points can be used</option>
                                <option value="cash">Cash redemption</option>
                                <option value="sale">Sales checkout</option>
                                <option value="both">Cash redemption and sales checkout</option>
                            </select>
                            <span className="label-text-alt text-gray-500">
                                Choose whether points can be used for cash, sales, or both.
                            </span>
                            {errors.redeemType && (
                                <span className="text-error text-xs mt-1">
                                    {errors.redeemType.message}
                                </span>
                            )}
                        </div>
                    </form>
                </div>

                {/* Fixed Footer */}
                <div className="sticky bottom-0 bg-white z-10 border-t border-gray-200 p-4 mt-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-error text-sm">{errorMessage}</span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => closeModal("reward_add_edit_modal")}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary !m-0"
                                onClick={handleSubmit(onSubmit)}
                                disabled={loading}
                            >
                                {loading
                                    ? "Saving..."
                                    : reward
                                        ? "Update"
                                        : "Add "}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </dialog>
    );
}
