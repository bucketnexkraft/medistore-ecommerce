import { useCallback, useEffect, useState, useRef } from "react";
import { closeModal, showModal } from "../../../hooks/modalConfig";
import { useForm, Controller } from "react-hook-form";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useSelector } from "react-redux";
import { deleteRewards, getRewardsList } from "../../../api/reward";
import { toast } from "react-toastify";
import TableLoading from "../../../components/loadings/TableLoading";
import {
  PiNotePencil,
  PiTrash,
  PiSliders,
  PiPlus,
} from "react-icons/pi";
import Swal from "sweetalert2";
import useSelectableList from "../../../hooks/useSelectableList";
import Pagination from "../../../components/common/Pagination";
import RewardAddEditModal from "./RewardAddEditModal";
import { formatPrice } from "../../../hooks/currency";
import { hasPermission } from "../../../utils/permissions";

export default function Rewards() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const currency = useSelector((state) => state.preferences.data?.currency);
  const [data, setData] = useState({ data: [], meta: {}, others_data: {} });
  const [selectedReward, setSelectedReward] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { control, watch, setValue, handleSubmit } = useForm({
    defaultValues: {
      search: "",
      dateRange: null,
      redeemType: "",
    },
  });
  const searchValue = watch("search") || "";

  const {
    selectedOptions,
    handleSelectAll,
    handleSelect,
    isAllSelectedOnCurrentPage,
    clearSelection,
  } = useSelectableList(data.data);

  const fetchRewards = useCallback(
    async (page = 1, params = {}) => {
      setLoading(true);
      try {
        const finalParams = {
          page,
          search: params.search?.trim() || undefined,
          redeemType: params.redeemType || undefined,
          dateRange: params.dateRange?.[0] && params.dateRange?.[1]
            ? `${params.dateRange[0].toISOString().split("T")[0]} to ${
                params.dateRange[1].toISOString().split("T")[0]
              }`
            : undefined,
        };

        const result = await getRewardsList(accessToken, finalParams);

        if (!result?.status) {
          throw new Error(result?.message || "Failed to fetch rewards");
        }

        setData({
          data: result.data || [],
          meta: result.meta || {},
          others_data: result.others_data || {},
        });
      } catch (error) {
        console.error("Fetching rewards error:", error);
        toast.error(error.message || "Failed to load rewards");
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  // Initial fetch and refresh on reward update
  useEffect(() => {
    const currentFilters = {
      search: watch().search,
      dateRange: watch().dateRange,
      redeemType: watch().redeemType,
    };

    fetchRewards(currentPage, currentFilters);

    const handleRewardUpdate = () => {
      fetchRewards(currentPage, currentFilters);
    };

    window.addEventListener("rewardUpdated", handleRewardUpdate);
    return () => {
      window.removeEventListener("rewardUpdated", handleRewardUpdate);
    };
  }, [fetchRewards, currentPage]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setCurrentPage(1);
      fetchRewards(1, {
        search: searchValue,
        dateRange: watch().dateRange,
        redeemType: watch().redeemType,
      });
    }, 500);

    return () => clearTimeout(handler);
  }, [searchValue, fetchRewards]);

  // Handle click outside filter dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilter(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const openModal = (reward = null) => {
    setSelectedReward(reward);
    showModal("reward_add_edit_modal");
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
        await deleteRewards(accessToken, [id]);
        toast.success("Reward deleted successfully");
        fetchRewards(currentPage, {
          search: watch().search,
          dateRange: watch().dateRange,
          redeemType: watch().redeemType,
        });
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
        await deleteRewards(accessToken, selectedOptions);
        toast.success("Rewards deleted successfully");
        clearSelection();
        fetchRewards(currentPage, {
          search: watch().search,
          dateRange: watch().dateRange,
          redeemType: watch().redeemType,
        });
      } catch (error) {
        console.error("Delete multiple rewards error:", error);
        toast.error(error.message || "Failed to delete rewards");
      } finally {
        setLoading(false);
      }
    }
  };

  const onFilterSubmit = () => {
    setShowFilter(false);
    setCurrentPage(1);
    fetchRewards(1, {
      search: watch().search,
      dateRange: watch().dateRange,
      redeemType: watch().redeemType,
    });
  };

  const handleNextPage = () => setCurrentPage((prev) => prev + 1);
  const handlePrevious = () => setCurrentPage((prev) => prev - 1);
  const handlePageChange = (page) => setCurrentPage(page);

  return (
    <div className="min-h-screen figtree-regular" data-currency-code={currency?.code || "USD"}>
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold">Reward Management</h2>
        <p className="text-sm text-gray-600">
          Manage your reward setups from this page. Use filters to narrow down
          results or add new rewards.
        </p>
        <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <Controller
                control={control}
                name="search"
                render={({ field }) => (
                  <input
                    type="text"
                    placeholder="Search rewards..."
                    className="input w-full pr-16 focus:outline-none focus:border-none"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <div className="absolute right-1 flex items-center gap-0.5">
                <button
                  className="text-gray-500 hover:text-primary px-1 py-2"
                  onClick={() => setShowFilter(!showFilter)}
                  title="Advanced Search"
                >
                  <PiSliders fontSize={20} />
                </button>
              </div>
            </div>
          </div>
          {showFilter && (
            <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 flex flex-wrap gap-4">
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label">
                  <span className="label-text">Reward Active Period</span>
                </label>
                <Controller
                  control={control}
                  name="dateRange"
                  render={({ field }) => (
                    <DatePicker
                      selectsRange
                      startDate={field.value ? field.value[0] : null}
                      endDate={field.value ? field.value[1] : null}
                      onChange={(dates) => setValue("dateRange", dates)}
                      className="input input-bordered h-10 focus:-outline-offset-2 w-full"
                      dateFormat="yyyy-MM-dd"
                      placeholderText="Select active period"
                    />
                  )}
                />
              </div>
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label">
                  <span className="label-text">Where Points Can Be Used</span>
                </label>
                <Controller
                  control={control}
                  name="redeemType"
                  render={({ field }) => (
                    <select
                      className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full"
                      value={field.value}
                      onChange={field.onChange}
                    >
                      <option value="">All usage options</option>
                      <option value="cash">Cash redemption</option>
                      <option value="sale">Sales checkout</option>
                      <option value="both">Cash redemption and sales checkout</option>
                    </select>
                  )}
                />
              </div>
              <div className="w-full flex justify-end gap-2">
                <button
                  className="btn btn-error btn-outline h-10 min-h-10"
                  onClick={() => {
                    setValue("dateRange", null);
                    setValue("redeemType", "");
                    setValue("search", "");
                    setCurrentPage(1);
                    fetchRewards(1);
                  }}
                >
                  Reset
                </button>
                <button
                  className="btn h-10 min-h-10"
                  onClick={handleSubmit(onFilterSubmit)}
                >
                  Search
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white figtree-regular rounded-lg shadow-sm py-4">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-2 px-4">
          <h5 className="font-semibold text-custom-gray-400">Reward List</h5>
          <div className="flex items-center gap-2">
            {hasPermission("rewards.delete") && selectedOptions.length > 0 && (
              <button
                onClick={handleDeleteMultiple}
                className="btn btn-outline btn-error"
                title="Delete Selected"
              >
                <PiTrash />
                Delete ({selectedOptions.length})
              </button>
            )}
            {hasPermission("rewards.create") && (
              <button
                className="btn btn-outline btn-primary"
                onClick={() => openModal()}
                title="Add Reward"
              >
                <PiPlus />
                Add Reward
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <TableLoading />
          ) : (
            <>
              <table className="table figtree-regular">
                <thead>
                  <tr className="bg-gray-100 font-semibold">
                    <th className="w-0.5/12">
                      <label>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          checked={isAllSelectedOnCurrentPage()}
                        />
                      </label>
                    </th>
                    <th className="w-2/12">Active From</th>
                    <th className="w-2/12">Active Until</th>
                    <th className="w-2/12">Spend Threshold</th>
                    <th className="w-2/12">Points Earned</th>
                    <th className="w-2/12">Value per Point</th>
                    <th className="w-2/12">Point Usage</th>
                    <th className="w-2/12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data?.length > 0 ? (
                    data.data.map((reward) => (
                      <tr
                        key={reward.id}
                        className={`hover ${
                          selectedOptions.includes(reward.id)
                            ? "bg-blue-100"
                            : ""
                        }`}
                      >
                        <th className="w-0.5/12">
                          <label>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              onChange={() => handleSelect(reward.id)}
                              checked={selectedOptions.includes(reward.id)}
                            />
                          </label>
                        </th>
                        <td className="w-2/12">{reward.form_date || "N/A"}</td>
                        <td className="w-2/12">{reward.to_date || "N/A"}</td>
                        <td className="w-2/12">
                          {reward.amount != null
                            ? `${formatPrice(reward.amount)}`
                            : "N/A"}
                        </td>
                        <td className="w-2/12">
                          {reward.reword_unit != null
                            ? reward.reword_unit
                            : "N/A"}
                        </td>
                        <td className="w-2/12">
                          {reward.reword_value != null
                            ? `${formatPrice(reward.reword_value)}`
                            : "N/A"}
                        </td>
                        <td className="w-2/12">
                          {reward.redeem_type === "cash"
                            ? "Cash redemption"
                            : reward.redeem_type === "sale"
                            ? "Sales checkout"
                            : reward.redeem_type === "both"
                            ? "Cash + sales checkout"
                            : "N/A"}
                        </td>
                        <th className="w-2/12">
                          <div className="flex items-center justify-center gap-2">
                            {hasPermission("rewards.edit") && (
                              <button
                                className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                                onClick={() => openModal(reward)}
                                title="Edit"
                              >
                                <PiNotePencil fontSize={16} />
                              </button>
                            )}
                            {hasPermission("rewards.delete") && (
                              <button
                                className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                                onClick={() => handleDelete(reward.id)}
                                title="Delete"
                              >
                                <PiTrash fontSize={16} />
                              </button>
                            )}
                          </div>
                        </th>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="text-center pt-4 pb-4">
                        No Data Found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {data?.data?.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  lastPage={data?.meta?.last_page || 1}
                  handlePrevious={handlePrevious}
                  handlePageChange={handlePageChange}
                  handleNextPage={handleNextPage}
                  showPrevious={currentPage > 1}
                  showNext={currentPage < (data?.meta?.last_page || 1)}
                />
              )}
            </>
          )}
        </div>
      </div>

      <RewardAddEditModal
        reward={selectedReward}
        onClose={() => closeModal("reward_add_edit_modal")}
      />
    </div>
  );
}
