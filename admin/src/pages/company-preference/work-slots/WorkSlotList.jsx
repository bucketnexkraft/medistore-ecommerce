// src/pages/work-slots/WorkSlotList.jsx
import { useCallback, useEffect, useState, useRef } from "react";
import { closeModal, showModal } from "../../../hooks/modalConfig";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import TableLoading from "../../../components/loadings/TableLoading";
import Pagination from "../../../components/common/Pagination";
import {
    PiNotePencil,
    PiTrash,
    PiSliders,
    PiPlus,
} from "react-icons/pi";
import useSelectableList from "../../../hooks/useSelectableList";
import { hasPermission } from "../../../utils/permissions";
import WorkSlotAddEditModal from "./WorkSlotAddEditModal";
import {
    getWorkSlots,
    deleteWorkSlots,
    getCashiers,
} from "../../../api/workSlot";
import Swal from "sweetalert2";

export default function WorkSlotList() {
    const accessToken = useSelector((state) => state.auth.accessToken);
    const [data, setData] = useState({ data: [], meta: {} });
    const [cashiers, setCashiers] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showFilter, setShowFilter] = useState(false);
    const filterRef = useRef(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [filters, setFilters] = useState({
        cashier_id: "",
        overtime: "",
    });

    const { selectedOptions, handleSelectAll, handleSelect, isAllSelectedOnCurrentPage, clearSelection } =
        useSelectableList(data.data);

    const fetchData = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = {
                page,
                cashier_id: filters.cashier_id || undefined,
                overtime: filters.overtime || undefined,
            };

            const [slotsRes, cashiersRes] = await Promise.all([
                getWorkSlots(accessToken, params),
                getCashiers(accessToken),
            ]);

            setData({
                data: slotsRes.data || [],
                meta: slotsRes.meta || {},
            });
            setCashiers(cashiersRes.data || []);
        } catch (error) {
            toast.error("Failed to load work slots");
        } finally {
            setLoading(false);
        }
    }, [accessToken, filters]);

    useEffect(() => {
        fetchData(currentPage);
    }, [fetchData, currentPage]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (filterRef.current && !filterRef.current.contains(e.target)) {
                setShowFilter(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const openModal = (slot = null) => {
        setSelectedSlot(slot);
        showModal("work_slot_modal");
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: "Are you sure?",
            text: "You won't be able to revert this!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Yes, delete it!",
        });

        if (result.isConfirmed) {
            setLoading(true);
            try {
                await deleteWorkSlots(accessToken, [id]);
                toast.success("Reward deleted successfully");
                fetchData(currentPage);
            } catch (error) {
                toast.error(error.message || "Failed to delete reward");
            } finally {
                setLoading(false);
            }
        }
    };

    const handleDeleteMultiple = async () => {
        const result = await Swal.fire({
            title: "Are you sure?",
            text: `You are about to delete ${selectedOptions.length} rewards. This action cannot be undone.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Yes, delete them!",
            cancelButtonText: "Cancel",
        });

        if (result.isConfirmed) {
            setLoading(true);
            try {
                await deleteWorkSlots(
                    accessToken,
                    selectedOptions.map((r) => r.id)
                );
                toast.success("Rewards deleted successfully");
                clearSelection();
                fetchData(currentPage);
            } catch (error) {
                console.error("Delete multiple rewards error:", error);
                toast.error(error.message || "Failed to delete rewards");
            } finally {
                setLoading(false);
            }
        }
    };

    const onSuccess = () => {
        fetchData(currentPage);
        closeModal("work_slot_modal");
    };

    return (
        <div className="min-h-screen figtree-regular">
            <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
                <h2 className="text-xl font-semibold">Work Slot Management</h2>
                <p className="text-sm text-gray-600">
                    Define cashier work schedules and handover instructions.
                </p>

                <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
                    <div className="rounded-lg border">
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                placeholder="Search instructions..."
                                className="input w-full pr-16 focus:outline-none"
                                onChange={(e) => {
                                    // Add search later if needed
                                }}
                            />
                            <button
                                className="absolute right-3 text-gray-500 hover:text-primary"
                                onClick={() => setShowFilter(!showFilter)}
                            >
                                <PiSliders size={20} />
                            </button>
                        </div>
                    </div>

                    {showFilter && (
                        <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label"><span className="label-text">Cashier</span></label>
                                    <select
                                        className="select select-bordered w-full"
                                        value={filters.cashier_id}
                                        onChange={(e) => setFilters(p => ({ ...p, cashier_id: e.target.value }))}
                                    >
                                        <option value="">All Cashiers</option>
                                        {cashiers.map(c => (
                                            <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label"><span className="label-text">Overtime</span></label>
                                    <select
                                        className="select select-bordered w-full"
                                        value={filters.overtime}
                                        onChange={(e) => setFilters(p => ({ ...p, overtime: e.target.value }))}
                                    >
                                        <option value="">All</option>
                                        <option value="1">Allowed</option>
                                        <option value="0">Not Allowed</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button className="btn btn-error btn-outline" onClick={() => {
                                    setFilters({ cashier_id: "", overtime: "" });
                                    setCurrentPage(1);
                                    fetchData(1);
                                }}>
                                    Reset
                                </button>
                                <button className="btn btn-primary" onClick={() => {
                                    setShowFilter(false);
                                    setCurrentPage(1);
                                    fetchData(1);
                                }}>
                                    Apply
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm py-4">
                <div className="flex justify-between items-center px-4 mb-4">
                    <h5 className="font-semibold text-custom-gray-400">Work Slots</h5>
                    <div className="flex gap-2">
                        {hasPermission("work-slots.delete") && selectedOptions.length > 0 && (
                            <button onClick={handleDeleteMultiple} className="btn btn-outline btn-error">
                                <PiTrash /> Delete ({selectedOptions.length})
                            </button>
                        )}
                        {hasPermission("work-slots.create") && (
                            <button onClick={() => openModal()} className="btn btn-primary">
                                <PiPlus /> Add Slot
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? <TableLoading /> : (
                        <>
                            <table className="table figtree-regular">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th><input type="checkbox" className="checkbox checkbox-sm" onChange={(e) => handleSelectAll(e.target.checked)} checked={isAllSelectedOnCurrentPage()} /></th>
                                        <th>Cashier</th>
                                        <th>Start Time</th>
                                        <th>End Time</th>
                                        <th>Overtime</th>
                                        <th>Instructions</th>
                                        <th className="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.data.length > 0 ? data.data.map(slot => (
                                        <tr key={slot.id} className={`hover ${selectedOptions.includes(slot.id)
                                                ? "bg-blue-100"
                                                : ""
                                            }`}>
                                            <td><input type="checkbox" className="checkbox checkbox-sm" checked={selectedOptions.includes(slot.id)} onChange={() => handleSelect(slot.id)} /></td>
                                            <td className="font-medium">{slot.user?.first_name + " " + slot.user?.last_name || "—"}</td>
                                            <td>{slot.start_time}</td>
                                            <td>{slot.end_time}</td>
                                            <td>
                                                <span className={`badge ${slot.overtime ? "badge-success" : "badge-ghost"} badge-sm`}>
                                                    {slot.overtime ? "Allowed" : "Not Allowed"}
                                                </span>
                                            </td>
                                            <td className="max-w-xs truncate">{slot.handover_instructions || "—"}</td>
                                            <td>
                                                <div className="flex items-center justify-center gap-2">
                                                    {hasPermission("rewards.edit") && (
                                                        <button
                                                            className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                                                            onClick={() => openModal(slot)}
                                                            title="Edit"
                                                        >
                                                            <PiNotePencil fontSize={16} />
                                                        </button>
                                                    )}
                                                    {hasPermission("rewards.delete") && (
                                                        <button
                                                            className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                                                            onClick={() => handleDelete(slot.id)}
                                                            title="Delete"
                                                        >
                                                            <PiTrash fontSize={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan="7" className="text-center py-8">No work slots found</td></tr>
                                    )}
                                </tbody>
                            </table>

                            {data.meta.last_page > 1 && (
                                <Pagination
                                    currentPage={currentPage}
                                    lastPage={data.meta.last_page}
                                    handlePrevious={() => setCurrentPage(p => p - 1)}
                                    handleNextPage={() => setCurrentPage(p => p + 1)}
                                    handlePageChange={setCurrentPage}
                                    showPrevious={currentPage > 1}
                                    showNext={currentPage < data.meta.last_page}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>

            <WorkSlotAddEditModal slot={selectedSlot} onSuccess={onSuccess} />
        </div>
    );
}
