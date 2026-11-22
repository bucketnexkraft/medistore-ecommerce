import { useCallback, useEffect, useState, useRef } from "react";
import { closeModal, showModal } from "../../../hooks/modalConfig";
import DiscountAddEditModal from "./components/DiscountAddEditModal";
import { useForm, Controller } from "react-hook-form";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useSelector } from "react-redux";
import { deleteDiscounts, getDiscounts, updateDiscountStatus } from "../../../api/discount";
import { toast } from "react-toastify";
import TableLoading from "../../../components/loadings/TableLoading";
import {
  PiNotePencil,
  PiTrash,
  PiMagnifyingGlass,
  PiSliders,
  PiPlus,
} from "react-icons/pi";
import Swal from "sweetalert2";
import useSelectableList from "../../../hooks/useSelectableList";
import Pagination from "../../../components/common/Pagination";
import { formatPrice } from "../../../hooks/currency";

export default function Discount() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [data, setData] = useState({ data: [], meta: {}, others_data: {} });
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { control, watch, setValue, handleSubmit } = useForm({
    defaultValues: {
      search: "",
      dateRange: null,
      discountType: "",
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

  const fetchDiscounts = useCallback(
    async (page = 1, params = {}) => {
      setLoading(true);
      try {
        const finalParams = {
          page,
          search: params.search?.trim() || undefined,
          discountType: params.discountType || undefined,
          dateRange: params.dateRange
            ? `${params.dateRange[0].toISOString().split("T")[0]} to ${params.dateRange[1].toISOString().split("T")[0]}`
            : undefined,
        };

        const result = await getDiscounts(accessToken, finalParams);

        if (!result?.status) {
          throw new Error(result?.message || "Failed to fetch discounts");
        }

        setData({
          data: result.data || [],
          meta: result.meta || {},
          others_data: result.others_data || {},
        });
      } catch (error) {
        console.error("Fetching discounts error:", error);
        toast.error(error.message || "Failed to load discounts");
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  // Initial fetch and refresh on discount update
  useEffect(() => {
    fetchDiscounts(currentPage);

    const handleDiscountUpdate = () => {
      fetchDiscounts(currentPage);
    };

    window.addEventListener("discountUpdated", handleDiscountUpdate);
    return () => {
      window.removeEventListener("discountUpdated", handleDiscountUpdate);
    };
  }, [fetchDiscounts, currentPage]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchValue.trim() !== "") {
        setCurrentPage(1);
        fetchDiscounts(1, { search: searchValue });
      }
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(handler);
    };
  }, [searchValue, fetchDiscounts]);

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

  const openModal = (discount = null) => {
    setSelectedDiscount(discount);
    showModal("discount_add_edit_modal");
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
        await deleteDiscounts(accessToken, id);
        toast.success("Discount deleted successfully");
        fetchDiscounts(currentPage);
      } catch (error) {
        toast.error(error.message || "Failed to delete discount");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteMultiple = async () => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete ${selectedOptions.length} discounts. This action cannot be undone.`,
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
        await deleteDiscounts(accessToken, selectedOptions);
        toast.success("Discounts deleted successfully");
        clearSelection();
        fetchDiscounts(currentPage);
      } catch (error) {
        console.error("Delete multiple discounts error:", error);
        toast.error(error.message || "Failed to delete discounts");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleStatusToggle = async (category) => {
      const newStatus = category.is_active === 1 ? 0 : 1;
      const result = await Swal.fire({
        title: "Are you sure?",
        text: `Change status to ${
          newStatus === 1 ? "Active" : "Inactive"
        } for discount "${category.name}"?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, change it!",
      });
  
      if (!result.isConfirmed) {
        return;
      }
  
      try {
        const response = await updateDiscountStatus(accessToken, category.id, {
          status: newStatus,
        });
        if (!response.status) {
          throw new Error(response?.message || "Failed to update status");
        }
        toast.success(
          `Discount status updated to ${newStatus === 1 ? "Active" : "Inactive"}`,
          {
            className: "alert alert-success",
            bodyClassName: "text-sm",
            progressClassName: "bg-success",
          }
        );
        // setLoading(true);
        fetchDiscounts(currentPage);
      } catch (error) {
        console.error("Status update error:", error);
        toast.error(error.message || "Failed to update status", {
          className: "alert alert-error",
          bodyClassName: "text-sm",
          progressClassName: "bg-error",
        });
      }
    };

    const handleBulkStatusUpdate = async (status) => {
        if (selectedOptions.length === 0) {
          toast.warning("Please select at least one discount to update", {
            className: "alert alert-warning",
            bodyClassName: "text-sm",
            progressClassName: "bg-warning",
          });
          return;
        }
    
        const result = await Swal.fire({
          title: "Are you sure?",
          text: `Change status to ${status === 1 ? "Active" : "Inactive"} for ${
            selectedOptions.length
          } selected discounts?`,
          icon: "question",
          showCancelButton: true,
          confirmButtonColor: "#3085d6",
          cancelButtonColor: "#d33",
          confirmButtonText: "Yes, change them!",
        });
    
        if (!result.isConfirmed) {
          return;
        }
    
        try {
          const response = await updateDiscountStatus(
            accessToken,
            selectedOptions,
            { status }
          );
          if (!response.status) {
            throw new Error(response?.message || "Failed to update statuses");
          }
          toast.success(
            `Selected discounts updated to ${
              status === 1 ? "Active" : "Inactive"
            }`,
            {
              className: "alert alert-success",
              bodyClassName: "text-sm",
              progressClassName: "bg-success",
            }
          );
          setLoading(true);
          fetchDiscounts(currentPage);
        } catch (error) {
          console.error("Bulk status update error:", error);
          toast.error(error.message || "Failed to update statuses", {
            className: "alert alert-error",
            bodyClassName: "text-sm",
            progressClassName: "bg-error",
          });
        }
      };

  const onFilterSubmit = () => {
    setShowFilter(false);
    setCurrentPage(1);
    fetchDiscounts(1, {
      search: watch().search,
      dateRange: watch().dateRange,
      discountType: watch().discountType,
    });
  };

  const handleNextPage = () => setCurrentPage((prev) => prev + 1);
  const handlePrevious = () => setCurrentPage((prev) => prev - 1);
  const handlePageChange = (page) => setCurrentPage(page);

  return (
    <div className="min-h-screen figtree-regular">
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold">Discount Management</h2>
        <p className="text-sm text-gray-600">
          Manage your discounts from this page. Use filters to narrow down
          results or add new discounts.
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
                    placeholder="Search discounts..."
                    className="input w-full pr-16 focus:outline-none focus:border-none"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <div className="absolute right-1 flex items-center gap-0.5">
                <button
                  className="px-1 py-2 text-gray-500 hover:text-primary cursor-pointer"
                  onClick={() => {
                    setCurrentPage(1);
                    fetchDiscounts(1, { search: watch().search });
                  }}
                  disabled={watch().search.trim() === ""}
                  title="Search"
                >
                  <PiMagnifyingGlass fontSize={20} />
                </button>
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
                  <span className="label-text">Date Range</span>
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
                      placeholderText="Select date range"
                    />
                  )}
                />
              </div>
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <label className="label">
                  <span className="label-text">Discount Type</span>
                </label>
                <Controller
                  control={control}
                  name="discountType"
                  render={({ field }) => (
                    <select
                      className="select select-bordered h-10 min-h-10 focus:-outline-offset-2 w-full"
                      value={field.value}
                      onChange={field.onChange}
                    >
                      <option value="">All Types</option>
                      <option value="percent">Percentage</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                  )}
                />
              </div>
              <div className="w-full flex justify-end gap-2">
                <button
                  className="btn btn-error btn-outline h-10 min-h-10"
                  onClick={() => {
                    setValue("search", "");
                    setValue("dateRange", null);
                    setValue("discountType", "");
                    setCurrentPage(1);
                    fetchDiscounts(1);
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
          <h5 className="font-semibold text-custom-gray-400">Discount List</h5>
          <div className="flex items-center gap-2">
            {selectedOptions.length > 0 && (
              <>
              <button
                  onClick={() => handleBulkStatusUpdate(1)}
                  className="btn btn-outline btn-success"
                >
                  Set Active
                </button>
                <button
                  onClick={() => handleBulkStatusUpdate(0)}
                  className="btn btn-outline btn-warning"
                >
                  Set Inactive
                </button>
              <button
                onClick={handleDeleteMultiple}
                className="btn btn-outline btn-error"
                title="Delete Selected"
              >
                <PiTrash />
                Delete ({selectedOptions.length})
              </button>
              </>
            )}
            <button
              className="btn btn-outline btn-primary"
              onClick={() => openModal()}
              title="Add Discount"
            >
              <PiPlus />
              Add Discount
            </button>
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
                    <th className="w-1.5/12">Title</th>
                    <th className="w-1.5/12">Type</th>
                    <th className="w-1.5/12">Code</th>
                    <th className="w-1.5/12">From Date</th>
                    <th className="w-1.5/12">To Date</th>
                    <th className="w-2.5/12">Product Name</th>
                    <th className="w-2/12">Category</th>
                    <th className="w-2/12">Brand</th>
                    <th className="w-2/12">Warehouse</th>
                    <th className="w-1/12">Amount</th>
                    <th className="w-1/12">Discount Type</th>
                    <th className="w-1/12">VAT Applicable</th>
                    <th className="w-1/12">VAT Calculate For</th>
                    <th className="w-1/12">Status</th>
                    <th className="w-2/12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data?.length > 0 ? (
                    data.data.map((discount) => (
                      <tr
                        key={discount.id}
                        className={`hover ${selectedOptions.includes(discount.id)
                            ? "bg-blue-100"
                            : ""
                          }`}
                      >
                        <th className="w-0.5/12">
                          <label>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              onChange={() => handleSelect(discount.id)}
                              checked={selectedOptions.includes(discount.id)}
                            />
                          </label>
                        </th>
                        <td className="w-1.5/12">
                          {discount.name || "N/A"}
                        </td>
                        <td className="w-1.5/12">
                          <div className="badge badge-outline badge-primary badge-sm capitalize">{discount.type}</div>
                        </td>
                        <td className="w-1.5/12">
                          {discount.code || "N/A"}
                        </td>
                        <td className="w-1.5/12">
                          {discount.form_date || "N/A"}
                        </td>
                        <td className="w-1.5/12">{discount.to_date || "N/A"}</td>
                        <td className="w-2.5/12">
                          {discount.products?.length > 0
                            ? discount.products
                              .map((product) => product.name)
                              .join(", ")
                            : "N/A"}
                        </td>
                        <td className="w-2/12">
                          {discount.categories?.length > 0
                            ? discount.categories
                              .map((category) => category.title)
                              .join(", ")
                            : "N/A"}
                        </td>
                        <td className="w-2/12">
                          {discount.brands?.length > 0
                            ? discount.brands
                              .map((brand) => brand.title)
                              .join(", ")
                            : "N/A"}
                        </td>
                        <td className="w-2/12">
                          {discount.warehouses?.length > 0
                            ? discount.warehouses
                              .map((warehouse) => warehouse.name)
                              .join(", ")
                            : "All Warehouses"}
                        </td>
                        <td className="w-1/12">
                         {discount.amount != null
                          ? discount.discount_type === "fixed"
                            ? formatPrice(discount.amount) // use your function
                            : `${discount.amount.toFixed(2)}%`
                          : "N/A"}
                        </td>
                        <td className="w-1/12">
                          {discount.discount_type === "percent"
                            ? "Percentage"
                            : discount.discount_type === "fixed"
                              ? "Fixed Amount"
                              : "N/A"}
                        </td>
                        <td className="w-1/12">
                          {discount.vat_applicable ? "Yes" : "No"}
                        </td>
                        <td className="w-1/12">
                          {discount.vat_applicable
                            ? discount.vat_calculate_for === "after_discount"
                              ? "After Discount"
                              : "Before Discount"
                            : "N/A"}
                        </td>
                        <td className="w-1/12">
                            <input
                              type="checkbox"
                              className="toggle toggle-sm toggle-primary"
                              checked={discount.is_active === 1}
                              onChange={() => handleStatusToggle(discount)}
                            />
                        </td>
                        <th className="w-2/12">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20"
                              onClick={() => openModal(discount)}
                              title="Edit"
                            >
                              <PiNotePencil fontSize={16} />
                            </button>
                            <button
                              className="btn btn-sm border-none bg-error/10 text-error hover:bg-error/20"
                              onClick={() => handleDelete(discount.id)}
                              title="Delete"
                            >
                              <PiTrash fontSize={16} />
                            </button>
                          </div>
                        </th>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="16" className="text-center pt-4 pb-4">
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

      <DiscountAddEditModal
        discount={selectedDiscount}
        onClose={() => closeModal("discount_add_edit_modal")}
      />
    </div>
  );
}
