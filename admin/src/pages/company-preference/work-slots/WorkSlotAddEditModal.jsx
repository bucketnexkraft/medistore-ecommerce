// src/pages/work-slots/WorkSlotAddEditModal.jsx
import { useForm, Controller } from "react-hook-form";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { closeModal } from "../../../hooks/modalConfig";
import { toast } from "react-toastify";
import { PiX } from "react-icons/pi";
import { storeWorkSlot, updateWorkSlot, getCashiers } from "../../../api/workSlot";

export default function WorkSlotAddEditModal({ slot, onSuccess }) {
    const accessToken = useSelector(s => s.auth.accessToken);
    const [cashiers, setCashiers] = useState([]);
    const [loading, setLoading] = useState(false);

    const { register, handleSubmit, control, reset, formState: { errors } } = useForm();

    useEffect(() => {
        const loadCashiers = async () => {
            try {
                const res = await getCashiers(accessToken);
                setCashiers(res.data || []);
            } catch (error) {
                toast.error(error?.message || "Failed to load cashiers");
            }
        };
        loadCashiers();

        if (slot) {
            reset({
                user_id: slot.user_id,
                start_time: Date(slot.start_time, "HH:mm"),
                end_time: Date(slot.end_time, "HH:mm"),
                overtime: slot.overtime ? "1" : "0",
                handover_instructions: slot.handover_instructions || "",
            });
        } else {
            reset({
                user_id: "",
                start_time: "09:00",
                end_time: "17:00",
                overtime: "0",
                handover_instructions: "",
            });
        }
    }, [slot, reset, accessToken]);

    const onSubmit = async (data) => {
        setLoading(true);
        try {
            if (slot) {
                await updateWorkSlot(accessToken, slot.id, data);
                toast.success("Work slot updated");
            } else {
                await storeWorkSlot(accessToken, data);
                toast.success("Work slot created");
            }
            onSuccess();
        } catch (error) {
            toast.error(error.message || "Failed to save");
        } finally {
            setLoading(false);
        }
    };

    return (
        <dialog id="work_slot_modal" className="modal">
            <div className="modal-box w-11/12 max-w-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold">{slot ? "Edit" : "Add"} Work Slot</h3>
                    <button className="btn btn-circle btn-ghost" onClick={() => closeModal("work_slot_modal")}>
                        <PiX size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    <div>
                        <label className="label"><span className="label-text font-semibold">Cashier</span></label>
                        <select {...register("user_id", { required: "Cashier is required" })} className="select select-bordered w-full">
                            <option value="">Select Cashier</option>
                            {cashiers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                        </select>
                        {errors.user_id && <p className="text-error text-sm mt-1">{errors.user_id.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label"><span className="label-text font-semibold">Start Time</span></label>
                            <input type="time" {...register("start_time", { required: true })} className="input input-bordered w-full" />
                        </div>
                        <div>
                            <label className="label"><span className="label-text font-semibold">End Time</span></label>
                            <input type="time" {...register("end_time", { required: true })} className="input input-bordered w-full" />
                        </div>
                    </div>

                    <div>
                        <label className="label"><span className="label-text font-semibold">Overtime Allowed?</span></label>
                        <select {...register("overtime")} className="select select-bordered w-full">
                            <option value="0">No</option>
                            <option value="1">Yes</option>
                        </select>
                    </div>

                    <div>
                        <label className="label"><span className="label-text font-semibold">Handover Instructions</span></label>
                        <textarea
                            {...register("handover_instructions")}
                            className="textarea textarea-bordered w-full h-32"
                            placeholder="e.g. Count cash, check safe, lock drawer..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" className="btn btn-ghost" onClick={() => closeModal("work_slot_modal")}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? "Saving..." : slot ? "Update" : "Create"}
                        </button>
                    </div>
                </form>
            </div>
        </dialog>
    );
}
