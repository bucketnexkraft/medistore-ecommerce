import { useCallback, useEffect, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaFileExcel } from "react-icons/fa";
import { PiMagnifyingGlass, PiSliders } from "react-icons/pi";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { getAccountsReport } from "../../../api/report";
import Pagination from "../../../components/common/Pagination";
import TableLoading from "../../../components/loadings/TableLoading";
import { formatPrice } from "../../../hooks/currency";

const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const quickRangeToDates = (range) => {
    const today = new Date();
    const start = new Date(today);
    const end = new Date(today);

    if (range === "today") {
        return [start, end];
    }

    if (range === "yesterday") {
        start.setDate(today.getDate() - 1);
        end.setDate(today.getDate() - 1);
        return [start, end];
    }

    if (range === "this_week") {
        const day = today.getDay() || 7;
        start.setDate(today.getDate() - day + 1);
        end.setDate(start.getDate() + 6);
        return [start, end];
    }

    if (range === "last_month") {
        start.setMonth(today.getMonth() - 1, 1);
        end.setMonth(today.getMonth(), 0);
        return [start, end];
    }

    if (range === "this_year") {
        start.setMonth(0, 1);
        end.setMonth(11, 31);
        return [start, end];
    }

    start.setDate(1);
    end.setMonth(today.getMonth() + 1, 0);
    return [start, end];
};

const initialDateRange = quickRangeToDates("this_month");

const initialFilters = {
    quickRange: "this_month",
    dateRange: initialDateRange,
    direction: "",
    invoice_type: "",
    payment_status: "",
    payment_type: "",
    payment_method: "",
    warehouse_id: "",
    cashier_id: "",
    customer_id: "",
    supplier_id: "",
    amount_min: "",
    amount_max: "",
    groupBy: "day",
    include_deleted: false,
};

const paymentStatusLabel = (status) => {
    if (Number(status) === 1) return "Paid";
    if (Number(status) === 2) return "Partial";
    if (Number(status) === 0) return "Unpaid";
    return "N/A";
};

const partyName = (transaction) => {
    if (transaction.invoice_type === "purchase") {
        return transaction.supplier?.name || "N/A";
    }

    return transaction.customer?.name || "N/A";
};

const actionUserName = (transaction) =>
    transaction.action_user?.name || transaction.cashier?.name || "N/A";

const paymentTypeLabel = (transaction) =>
    transaction.payment_type_label || transaction.payment_type || "Other Payment";

const formatPercent = (value) => {
    if (value === null || value === undefined) return "N/A";
    return `${Number(value).toFixed(2)}%`;
};

export default function AccountsReport() {
    const accessToken = useSelector((state) => state.auth.accessToken);
    const [filters, setFilters] = useState(initialFilters);
    const [searchQuery, setSearchQuery] = useState("");
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadData, setLoadData] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [sortField, setSortField] = useState("transaction_date");
    const [sortOrder, setSortOrder] = useState("desc");
    const [report, setReport] = useState({
        data: [],
        meta: {},
        summary: {},
        payment_types: [],
        payment_methods: [],
        groups: [],
        options: {
            warehouses: [],
            cashiers: [],
            customers: [],
            suppliers: [],
            payment_types: [],
            payment_methods: [],
        },
    });
    const filterRef = useRef(null);

    const fetchData = useCallback(async () => {
        setLoading(true);

        try {
            const [dateFrom, dateTo] = filters.dateRange || [null, null];
            const params = {
                perPage,
                page: currentPage,
                search: searchQuery.trim(),
                quick_range: filters.quickRange,
                date_from: formatDate(dateFrom),
                date_to: formatDate(dateTo),
                direction: filters.direction,
                invoice_type: filters.invoice_type,
                payment_status: filters.payment_status,
                payment_type: filters.payment_type,
                payment_method: filters.payment_method,
                warehouse_id: filters.warehouse_id,
                cashier_id: filters.cashier_id,
                customer_id: filters.customer_id,
                supplier_id: filters.supplier_id,
                amount_min: filters.amount_min,
                amount_max: filters.amount_max,
                groupBy: filters.groupBy,
                include_deleted: filters.include_deleted ? 1 : 0,
                sortField,
                sortOrder,
            };

            const result = await getAccountsReport(accessToken, params);

            setReport({
                data: Array.isArray(result.data) ? result.data : [],
                meta: result.meta || {},
                summary: result.summary || {},
                payment_types: result.payment_types || [],
                payment_methods: result.payment_methods || [],
                groups: result.groups || [],
                options: result.filters?.options || {
                    warehouses: [],
                    cashiers: [],
                    customers: [],
                    suppliers: [],
                    payment_types: [],
                    payment_methods: [],
                },
            });
        } catch (error) {
            toast.error(error.message || "Error loading accounts report", {
                className: "alert alert-error",
                bodyClassName: "text-sm",
                progressClassName: "bg-error",
            });
        } finally {
            setLoading(false);
            setLoadData(false);
        }
    }, [accessToken, currentPage, filters, perPage, searchQuery, sortField, sortOrder]);

    useEffect(() => {
        if (loadData) {
            fetchData();
        }
    }, [fetchData, loadData]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterRef.current && !filterRef.current.contains(event.target)) {
                setIsAdvancedOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const handleQuickRangeChange = (value) => {
        if (value === "custom") {
            setFilters((prev) => ({ ...prev, quickRange: value }));
            return;
        }

        setFilters((prev) => ({
            ...prev,
            quickRange: value,
            dateRange: quickRangeToDates(value),
        }));
    };

    const handleDateRangeChange = (dates) => {
        setFilters((prev) => ({
            ...prev,
            quickRange: "custom",
            dateRange: dates,
        }));
    };

    const applyFilters = () => {
        setCurrentPage(1);
        setIsAdvancedOpen(false);
        setLoadData(true);
    };

    const resetFilters = () => {
        setFilters(initialFilters);
        setSearchQuery("");
        setCurrentPage(1);
        setSortField("transaction_date");
        setSortOrder("desc");
        setLoadData(true);
    };

    const handleSearch = () => {
        setCurrentPage(1);
        setLoadData(true);
    };

    const handleSort = (field) => {
        setSortField(field);
        setSortOrder((prev) => (sortField === field && prev === "asc" ? "desc" : "asc"));
        setCurrentPage(1);
        setLoadData(true);
    };

    const handleNextPage = () => {
        setCurrentPage((prev) => prev + 1);
        setLoadData(true);
    };

    const handlePrevious = () => {
        setCurrentPage((prev) => prev - 1);
        setLoadData(true);
    };

    const handlePageChange = (page) => {
        setCurrentPage(page);
        setLoadData(true);
    };

    const exportToCsv = () => {
        if (!report.data.length) {
            toast.warning("No data to export", {
                className: "alert alert-warning",
                bodyClassName: "text-sm",
                progressClassName: "bg-warning",
            });
            return;
        }

        const headers = [
            "Date",
            "Transaction ID",
            "Invoice No",
            "Type",
            "Payment Type",
            "Direction",
            "Party",
            "Action User",
            "Warehouse",
            "Payment Method",
            "Reference",
            "Cash In",
            "Cash Out",
            "Net",
            "Status",
        ];

        const rows = report.data.map((item) => [
            item.transaction_date || "",
            item.transaction_id || "",
            item.invoice_no || "",
            item.invoice_type || "",
            paymentTypeLabel(item),
            item.direction || "",
            partyName(item),
            actionUserName(item),
            item.warehouse?.name || "",
            item.payment_method || "",
            item.payment_reference || "",
            item.cash_in || 0,
            item.cash_out || 0,
            item.signed_amount || 0,
            paymentStatusLabel(item.payment_status),
        ]);

        const csvContent = [headers, ...rows]
            .map((row) =>
                row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
            )
            .join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `accounts_report_${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
    };

    const summary = report.summary || {};
    const netCashFlow = Number(summary.net_cash_flow || 0);
    const netChange = Number(summary.net_change || 0);
    const isPositiveResult = netCashFlow >= 0;
    const purchasePaid =
        Number(summary.direct_purchase_payments || 0) +
        Number(summary.purchase_advance_payments || 0) +
        Number(summary.due_purchase_payments || 0);
    const summaryCards = [
        { label: "Cash In", value: summary.cash_in || 0, className: "text-green-600" },
        { label: "Cash Out", value: summary.cash_out || 0, className: "text-red-600" },
        {
            label: "Cash Result",
            value: summary.net_cash_flow || 0,
            className: isPositiveResult ? "text-green-600" : "text-red-600",
        },
        { label: "Direct Sales", value: summary.direct_sale_payments || 0, className: "text-green-600" },
        { label: "Due Collected", value: summary.due_sale_payments || 0, className: "text-emerald-600" },
        { label: "Purchase Paid", value: purchasePaid, className: "text-red-600" },
        { label: "Transactions", value: summary.transaction_count || 0, isCount: true },
    ];

    return (
        <div className="min-h-screen figtree-regular">
            <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
                <div className="flex flex-wrap justify-between items-center gap-3">
                    <h2 className="text-xl font-semibold">Accounts Report</h2>
                    <div className="flex items-center gap-2">
                        <select
                            className="select select-bordered h-10 min-h-10"
                            value={perPage}
                            onChange={(e) => {
                                setPerPage(Number(e.target.value));
                                setCurrentPage(1);
                                setLoadData(true);
                            }}
                        >
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={250}>250</option>
                        </select>
                        <button className="btn btn-outline btn-success h-10 min-h-10" onClick={exportToCsv}>
                            <FaFileExcel />
                        </button>
                    </div>
                </div>

                <div className="w-full max-w-3xl mt-4 relative" ref={filterRef}>
                    <div className="rounded-lg border">
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                placeholder="Search invoice, reference, action user, customer, supplier..."
                                className="input w-full pr-16 focus:outline-none focus:border-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleSearch();
                                    }
                                }}
                            />
                            <div className="absolute right-1 flex items-center gap-0.5">
                                <button
                                    className="text-gray-500 hover:text-primary px-1 py-2"
                                    onClick={handleSearch}
                                >
                                    <PiMagnifyingGlass fontSize={20} />
                                </button>
                                <button
                                    className="text-gray-500 hover:text-primary px-1 py-2"
                                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                                >
                                    <PiSliders fontSize={20} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {isAdvancedOpen && (
                        <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 flex flex-wrap gap-4">
                            <div className="w-full sm:w-auto flex-1 min-w-[190px]">
                                <label className="label">
                                    <span className="label-text">Quick Range</span>
                                </label>
                                <select
                                    className="select select-bordered h-10 min-h-10 w-full"
                                    value={filters.quickRange}
                                    onChange={(e) => handleQuickRangeChange(e.target.value)}
                                >
                                    <option value="today">Today</option>
                                    <option value="yesterday">Yesterday</option>
                                    <option value="this_week">This Week</option>
                                    <option value="this_month">This Month</option>
                                    <option value="last_month">Last Month</option>
                                    <option value="this_year">This Year</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>

                            <div className="w-full sm:w-auto flex-1 min-w-[220px]">
                                <label className="label">
                                    <span className="label-text">Date Range</span>
                                </label>
                                <DatePicker
                                    selectsRange
                                    startDate={filters.dateRange?.[0]}
                                    endDate={filters.dateRange?.[1]}
                                    onChange={handleDateRangeChange}
                                    placeholderText="Select date range"
                                    className="input input-bordered h-10 min-h-10 w-full"
                                    isClearable
                                />
                            </div>

                            <div className="w-full sm:w-auto flex-1 min-w-[170px]">
                                <label className="label">
                                    <span className="label-text">Direction</span>
                                </label>
                                <select
                                    className="select select-bordered h-10 min-h-10 w-full"
                                    value={filters.direction}
                                    onChange={(e) => handleFilterChange("direction", e.target.value)}
                                >
                                    <option value="">All</option>
                                    <option value="in">Cash In</option>
                                    <option value="out">Cash Out</option>
                                </select>
                            </div>

                            <div className="w-full sm:w-auto flex-1 min-w-[170px]">
                                <label className="label">
                                    <span className="label-text">Invoice Type</span>
                                </label>
                                <select
                                    className="select select-bordered h-10 min-h-10 w-full"
                                    value={filters.invoice_type}
                                    onChange={(e) => handleFilterChange("invoice_type", e.target.value)}
                                >
                                    <option value="">All</option>
                                    <option value="sale">Sale</option>
                                    <option value="purchase">Purchase</option>
                                    <option value="expense">Expense</option>
                                    <option value="return">Return</option>
                                </select>
                            </div>

                            <div className="w-full sm:w-auto flex-1 min-w-[170px]">
                                <label className="label">
                                    <span className="label-text">Payment Status</span>
                                </label>
                                <select
                                    className="select select-bordered h-10 min-h-10 w-full"
                                    value={filters.payment_status}
                                    onChange={(e) => handleFilterChange("payment_status", e.target.value)}
                                >
                                    <option value="">All</option>
                                    <option value="paid">Paid</option>
                                    <option value="partial">Partial</option>
                                    <option value="unpaid">Unpaid</option>
                                </select>
                            </div>

                            <div className="w-full sm:w-auto flex-1 min-w-[210px]">
                                <label className="label">
                                    <span className="label-text">Payment Type</span>
                                </label>
                                <select
                                    className="select select-bordered h-10 min-h-10 w-full"
                                    value={filters.payment_type}
                                    onChange={(e) => handleFilterChange("payment_type", e.target.value)}
                                >
                                    <option value="">All</option>
                                    {report.options.payment_types?.map((type) => (
                                        <option key={type.value} value={type.value}>
                                            {type.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="w-full sm:w-auto flex-1 min-w-[190px]">
                                <label className="label">
                                    <span className="label-text">Payment Method</span>
                                </label>
                                <select
                                    className="select select-bordered h-10 min-h-10 w-full"
                                    value={filters.payment_method}
                                    onChange={(e) => handleFilterChange("payment_method", e.target.value)}
                                >
                                    <option value="">All</option>
                                    {report.options.payment_methods?.map((method) => (
                                        <option key={method} value={method}>
                                            {method}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="w-full sm:w-auto flex-1 min-w-[190px]">
                                <label className="label">
                                    <span className="label-text">Warehouse</span>
                                </label>
                                <select
                                    className="select select-bordered h-10 min-h-10 w-full"
                                    value={filters.warehouse_id}
                                    onChange={(e) => handleFilterChange("warehouse_id", e.target.value)}
                                >
                                    <option value="">All</option>
                                    {report.options.warehouses?.map((warehouse) => (
                                        <option key={warehouse.id} value={warehouse.id}>
                                            {warehouse.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="w-full sm:w-auto flex-1 min-w-[190px]">
                                <label className="label">
                                    <span className="label-text">Action User</span>
                                </label>
                                <select
                                    className="select select-bordered h-10 min-h-10 w-full"
                                    value={filters.cashier_id}
                                    onChange={(e) => handleFilterChange("cashier_id", e.target.value)}
                                >
                                    <option value="">All</option>
                                    {report.options.cashiers?.map((cashier) => (
                                        <option key={cashier.id} value={cashier.id}>
                                            {cashier.name || cashier.email}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="w-full sm:w-auto flex-1 min-w-[190px]">
                                <label className="label">
                                    <span className="label-text">Customer</span>
                                </label>
                                <select
                                    className="select select-bordered h-10 min-h-10 w-full"
                                    value={filters.customer_id}
                                    onChange={(e) => handleFilterChange("customer_id", e.target.value)}
                                >
                                    <option value="">All</option>
                                    {report.options.customers?.map((customer) => (
                                        <option key={customer.id} value={customer.id}>
                                            {customer.name || customer.phone}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="w-full sm:w-auto flex-1 min-w-[190px]">
                                <label className="label">
                                    <span className="label-text">Supplier</span>
                                </label>
                                <select
                                    className="select select-bordered h-10 min-h-10 w-full"
                                    value={filters.supplier_id}
                                    onChange={(e) => handleFilterChange("supplier_id", e.target.value)}
                                >
                                    <option value="">All</option>
                                    {report.options.suppliers?.map((supplier) => (
                                        <option key={supplier.id} value={supplier.id}>
                                            {supplier.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="w-full sm:w-auto flex-1 min-w-[150px]">
                                <label className="label">
                                    <span className="label-text">Min Amount</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    className="input input-bordered h-10 min-h-10 w-full"
                                    value={filters.amount_min}
                                    onChange={(e) => handleFilterChange("amount_min", e.target.value)}
                                />
                            </div>

                            <div className="w-full sm:w-auto flex-1 min-w-[150px]">
                                <label className="label">
                                    <span className="label-text">Max Amount</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    className="input input-bordered h-10 min-h-10 w-full"
                                    value={filters.amount_max}
                                    onChange={(e) => handleFilterChange("amount_max", e.target.value)}
                                />
                            </div>

                            <div className="w-full sm:w-auto flex-1 min-w-[170px]">
                                <label className="label">
                                    <span className="label-text">Group By</span>
                                </label>
                                <select
                                    className="select select-bordered h-10 min-h-10 w-full"
                                    value={filters.groupBy}
                                    onChange={(e) => handleFilterChange("groupBy", e.target.value)}
                                >
                                    <option value="day">Day</option>
                                    <option value="week">Week</option>
                                    <option value="month">Month</option>
                                    <option value="payment_method">Payment Method</option>
                                    <option value="payment_type">Payment Type</option>
                                    <option value="cashier">Cashier</option>
                                    <option value="invoice_type">Invoice Type</option>
                                    <option value="warehouse">Warehouse</option>
                                    <option value="none">None</option>
                                </select>
                            </div>

                            <div className="w-full sm:w-auto flex items-end min-w-[160px]">
                                <label className="label cursor-pointer gap-3">
                                    <span className="label-text">Include Deleted</span>
                                    <input
                                        type="checkbox"
                                        className="toggle toggle-primary"
                                        checked={filters.include_deleted}
                                        onChange={(e) => handleFilterChange("include_deleted", e.target.checked)}
                                    />
                                </label>
                            </div>

                            <div className="w-full flex justify-end gap-2">
                                <button className="btn btn-error btn-outline h-10 min-h-10" onClick={resetFilters}>
                                    Reset
                                </button>
                                <button className="btn h-10 min-h-10" onClick={applyFilters}>
                                    Search
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div
                className={`mb-6 rounded-lg border p-4 shadow-sm ${
                    isPositiveResult
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                }`}
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3
                            className={`text-lg font-semibold ${
                                isPositiveResult ? "text-green-700" : "text-red-700"
                            }`}
                        >
                            {summary.result_label || (isPositiveResult ? "Cash surplus" : "Cash shortfall")}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                            Net cash flow is {formatPrice(netCashFlow)} for this period.
                            Previous period was {formatPrice(summary.previous_net_cash_flow || 0)}.
                        </p>
                    </div>
                    <div className="text-right">
                        <div
                            className={`text-2xl font-semibold ${
                                netChange >= 0 ? "text-green-700" : "text-red-700"
                            }`}
                        >
                            {formatPrice(netChange)}
                        </div>
                        <div className="text-xs uppercase text-gray-500">
                            Change vs previous period ({formatPercent(summary.net_change_percent)})
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-3 mb-6">
                {summaryCards.map((card) => (
                    <div key={card.label} className="bg-white shadow-sm rounded-lg p-4">
                        <div className="text-xs uppercase text-gray-500">{card.label}</div>
                        <div className={`mt-2 text-xl font-semibold ${card.className || "text-gray-800"}`}>
                            {card.isCount ? card.value : formatPrice(card.value)}
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                <div className="bg-white figtree-regular rounded-lg shadow-sm py-4">
                    <div className="px-4 mb-2">
                        <h5 className="font-semibold text-custom-gray-400">Grouped Cash Flow</h5>
                    </div>
                    <div className="overflow-x-auto">
                        {loading ? (
                            <TableLoading />
                        ) : (
                            <table className="table figtree-regular">
                                <thead>
                                    <tr className="bg-gray-100 font-semibold">
                                        <th>Group</th>
                                        <th className="text-right">Transactions</th>
                                        <th className="text-right">Cash In</th>
                                        <th className="text-right">Cash Out</th>
                                        <th className="text-right">Net</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.groups?.length > 0 ? (
                                        report.groups.map((item) => (
                                            <tr key={`${item.key}-${item.label}`}>
                                                <td>{item.label}</td>
                                                <td className="text-right">{item.transaction_count}</td>
                                                <td className="text-right text-green-600">{formatPrice(item.cash_in)}</td>
                                                <td className="text-right text-red-600">{formatPrice(item.cash_out)}</td>
                                                <td
                                                    className={`text-right font-semibold ${
                                                        Number(item.net_amount) >= 0 ? "text-green-600" : "text-red-600"
                                                    }`}
                                                >
                                                    {formatPrice(item.net_amount)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="5" className="text-center pt-4 pb-4">
                                                No grouped data found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                <div className="bg-white figtree-regular rounded-lg shadow-sm py-4">
                    <div className="px-4 mb-2">
                        <h5 className="font-semibold text-custom-gray-400">Payment Type Breakdown</h5>
                    </div>
                    <div className="overflow-x-auto">
                        {loading ? (
                            <TableLoading />
                        ) : (
                            <table className="table figtree-regular">
                                <thead>
                                    <tr className="bg-gray-100 font-semibold">
                                        <th>Type</th>
                                        <th className="text-right">Transactions</th>
                                        <th className="text-right">Net</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.payment_types?.length > 0 ? (
                                        report.payment_types.map((item) => (
                                            <tr key={item.payment_type}>
                                                <td>{item.label}</td>
                                                <td className="text-right">{item.transaction_count}</td>
                                                <td
                                                    className={`text-right font-semibold ${
                                                        Number(item.net_amount) >= 0 ? "text-green-600" : "text-red-600"
                                                    }`}
                                                >
                                                    {formatPrice(item.net_amount)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="3" className="text-center pt-4 pb-4">
                                                No payment type data found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                <div className="bg-white figtree-regular rounded-lg shadow-sm py-4">
                    <div className="px-4 mb-2">
                        <h5 className="font-semibold text-custom-gray-400">Payment Method Breakdown</h5>
                    </div>
                    <div className="overflow-x-auto">
                        {loading ? (
                            <TableLoading />
                        ) : (
                            <table className="table figtree-regular">
                                <thead>
                                    <tr className="bg-gray-100 font-semibold">
                                        <th>Method</th>
                                        <th className="text-right">Transactions</th>
                                        <th className="text-right">Cash In</th>
                                        <th className="text-right">Cash Out</th>
                                        <th className="text-right">Net</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.payment_methods?.length > 0 ? (
                                        report.payment_methods.map((item) => (
                                            <tr key={item.payment_method}>
                                                <td>{item.payment_method}</td>
                                                <td className="text-right">{item.transaction_count}</td>
                                                <td className="text-right text-green-600">{formatPrice(item.cash_in)}</td>
                                                <td className="text-right text-red-600">{formatPrice(item.cash_out)}</td>
                                                <td
                                                    className={`text-right font-semibold ${
                                                        Number(item.net_amount) >= 0 ? "text-green-600" : "text-red-600"
                                                    }`}
                                                >
                                                    {formatPrice(item.net_amount)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="5" className="text-center pt-4 pb-4">
                                                No payment method data found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white figtree-regular rounded-lg shadow-sm py-4">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-2 px-4">
                    <h5 className="font-semibold text-custom-gray-400">Transaction Ledger</h5>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <TableLoading />
                    ) : (
                        <>
                            <table className="table figtree-regular">
                                <thead>
                                    <tr className="bg-gray-100 font-semibold">
                                        <th className="cursor-pointer" onClick={() => handleSort("transaction_date")}>
                                            Date {sortField === "transaction_date" ? (sortOrder === "asc" ? "A-Z" : "Z-A") : ""}
                                        </th>
                                        <th>Transaction</th>
                                        <th className="cursor-pointer" onClick={() => handleSort("invoice_no")}>
                                            Invoice
                                        </th>
                                        <th className="cursor-pointer" onClick={() => handleSort("invoice_type")}>
                                            Type
                                        </th>
                                        <th className="cursor-pointer" onClick={() => handleSort("payment_type")}>
                                            Payment Type
                                        </th>
                                        <th>Party</th>
                                        <th className="cursor-pointer" onClick={() => handleSort("cashier")}>
                                            Action User
                                        </th>
                                        <th>Warehouse</th>
                                        <th className="cursor-pointer" onClick={() => handleSort("payment_method")}>
                                            Method
                                        </th>
                                        <th>Reference</th>
                                        <th className="text-right">Cash In</th>
                                        <th className="text-right">Cash Out</th>
                                        <th className="text-right cursor-pointer" onClick={() => handleSort("amount")}>
                                            Net
                                        </th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.data.length > 0 ? (
                                        report.data.map((transaction) => (
                                            <tr key={transaction.transaction_id} className="hover">
                                                <td>{transaction.transaction_date || "N/A"}</td>
                                                <td>#{transaction.transaction_id}</td>
                                                <td>{transaction.invoice_no || "N/A"}</td>
                                                <td>
                                                    <span
                                                        className={`badge badge-sm ${
                                                            transaction.direction === "in"
                                                                ? "badge-success text-white"
                                                                : "badge-error text-white"
                                                        }`}
                                                    >
                                                        {transaction.invoice_type || "N/A"}
                                                    </span>
                                                </td>
                                                <td>{paymentTypeLabel(transaction)}</td>
                                                <td>{partyName(transaction)}</td>
                                                <td>{actionUserName(transaction)}</td>
                                                <td>{transaction.warehouse?.name || "N/A"}</td>
                                                <td>{transaction.payment_method || "N/A"}</td>
                                                <td>{transaction.payment_reference || "N/A"}</td>
                                                <td className="text-right text-green-600">
                                                    {Number(transaction.cash_in) > 0 ? formatPrice(transaction.cash_in) : "-"}
                                                </td>
                                                <td className="text-right text-red-600">
                                                    {Number(transaction.cash_out) > 0 ? formatPrice(transaction.cash_out) : "-"}
                                                </td>
                                                <td
                                                    className={`text-right font-semibold ${
                                                        Number(transaction.signed_amount) >= 0 ? "text-green-600" : "text-red-600"
                                                    }`}
                                                >
                                                    {formatPrice(transaction.signed_amount)}
                                                </td>
                                                <td>
                                                    <span className="badge badge-outline badge-sm">
                                                        {paymentStatusLabel(transaction.payment_status)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="14" className="text-center pt-4 pb-4">
                                                No transactions found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {report.data.length > 0 && (
                                <Pagination
                                    currentPage={report.meta.current_page || 1}
                                    lastPage={report.meta.last_page || 1}
                                    handlePrevious={handlePrevious}
                                    handlePageChange={handlePageChange}
                                    handleNextPage={handleNextPage}
                                    showPrevious={currentPage > 1}
                                    showNext={currentPage < (report.meta.last_page || 1)}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
