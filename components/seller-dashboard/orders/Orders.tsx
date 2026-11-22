"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Search, Copy, Plus, PlusIcon, Download } from "lucide-react";
import { ordersData, orderStatusTabs, resultsPerPageOptions, OrderStatus } from "@/data/seller-dashboard-data";
import { OrdersTable } from "./OrdersTable";
import { UserDashTitle } from "@/components/user-dashboard/common/UserDashTitle";
import { Button } from "@/components/ui/button";

export function Orders() {
	const [activeStatus, setActiveStatus] = useState<OrderStatus>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [resultsPerPage, setResultsPerPage] = useState(10);
	const [currentPage, setCurrentPage] = useState(1);

	// Filter orders by status and search
	const filteredOrders = useMemo(() => {
		let filtered = ordersData;

		// Filter by status
		if (activeStatus !== "all") {
			filtered = filtered.filter((order) => order.status === activeStatus);
		}

		// Filter by search query
		if (searchQuery.trim()) {
			filtered = filtered.filter(
				(order) => order.productName.toLowerCase().includes(searchQuery.toLowerCase()) || order.trackingId.toLowerCase().includes(searchQuery.toLowerCase()),
			);
		}

		return filtered;
	}, [activeStatus, searchQuery]);

	// Pagination logic
	const totalPages = Math.ceil(filteredOrders.length / resultsPerPage);
	const startIndex = (currentPage - 1) * resultsPerPage;
	const endIndex = Math.min(startIndex + resultsPerPage, filteredOrders.length);
	const displayedOrders = filteredOrders.slice(startIndex, endIndex);

	// Reset to page 1 when filters change
	const handleStatusChange = (status: OrderStatus) => {
		setActiveStatus(status);
		setCurrentPage(1);
	};

	const handleSearchChange = (query: string) => {
		setSearchQuery(query);
		setCurrentPage(1);
	};

	const handleResultsPerPageChange = (value: number) => {
		setResultsPerPage(value);
		setCurrentPage(1);
	};

	const handlePreviousPage = () => {
		if (currentPage > 1) setCurrentPage(currentPage - 1);
	};

	const handleNextPage = () => {
		if (currentPage < totalPages) setCurrentPage(currentPage + 1);
	};

	return (
		<main className="flex-1 overflow-y-auto">
			{/* Title area */}
			<div className="flex md:flex-row flex-col md:items-center items-start justify-between mb-10 md:mb-0">
				<UserDashTitle title="Orders" subtitle="Manage and track all your orders" />
				<Button variant="outline" className="bg-white hover:bg-purple-100 text-primary-blue hover:text-primary-blue font-semibold border-primary-blue p-5">
					<Download size={18} />
					Export Orders
				</Button>
			</div>

			{/* Status Tabs */}
			<div className="mb-6 flex gap-3 overflow-x-auto p-1 border rounded-lg">
				{orderStatusTabs.map((tab) => (
					<button
						key={tab.id}
						onClick={() => handleStatusChange(tab.id)}
						className={`px-4 py-2 cursor-pointer rounded-md whitespace-nowrap font-semibold transition-colors text-sm ${
							activeStatus === tab.id ? "bg-purple-100 text-primary-blue" : "text-gray-700 hover:bg-gray-100"
						}`}
					>
						{tab.label} ({tab.count})
					</button>
				))}
			</div>

			{/* Toolbar */}
			<div className="mb-6 bg-white rounded-lg py-3">
				<div className="flex flex-col lg:flex-row gap-4 items-start sm:items-center justify-between">
					{/* Left Section */}
					<div className="flex flex-col md:flex-row md:items-center gap-4 flex-1 w-full">
						{/* Results Per Page */}
						<div className="flex items-center gap-2">
							<span className="text-sm font-medium whitespace-nowrap">Results per page</span>
							<div className="px-2 py-1.5 border border-gray-300 rounded-lg">
								<select value={resultsPerPage} onChange={(e) => handleResultsPerPageChange(Number(e.target.value))} className="outline-0 text-sm">
									{resultsPerPageOptions.map((option) => (
										<option key={option} value={option}>
											{option}
										</option>
									))}
								</select>
							</div>
						</div>

						<div className="flex gap-3">
							{/* Search */}
							<div className="relative flex-1 md:w-sm w-full">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
								<input
									type="text"
									placeholder="Search product..."
									value={searchQuery}
									onChange={(e) => handleSearchChange(e.target.value)}
									className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
								/>
							</div>

							{/* candle icon */}
							<div className="w-12 h-12 bg-zinc-200 rounded-lg flex items-center justify-center">
								<Image src="/icons/seller-dashboard/orders/candle.svg" alt="candle" width={20} height={20} />
							</div>
						</div>
					</div>

					{/* Right Section */}
					<div className="flex gap-3 items-center w-full sm:w-auto justify-end">
						<button className="p-2 bg-green-100 rounded-lg cursor-pointer transition-colors text-gray-600" title="Excel">
							<Image src="/icons/seller-dashboard/orders/excel.svg" alt="Excel" width={28} height={28} />
						</button>
						<button className="p-2 bg-zinc-100 rounded-lg cursor-pointer transition-colors text-gray-600" title="Copy">
							<Image src="/icons/seller-dashboard/orders/copy.svg" alt="Excel" width={28} height={28} />
						</button>
						<button className="bg-primary-blue text-white px-4 py-3 cursor-pointer rounded-lg font-semibold text-sm flex items-center gap-2 whitespace-nowrap transition-colors">
							<Plus size={18} />
							<span className="hidden sm:inline">Add Product</span>
						</button>
					</div>
				</div>
			</div>

			{/* Table */}
			<div className="mb-6">
				<OrdersTable orders={displayedOrders} />
			</div>

			{/* Pagination */}
			<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
				<span className="text-gray-700 text-sm">
					{filteredOrders.length === 0 ? "0" : startIndex + 1}-{endIndex} of {filteredOrders.length}
				</span>

				<div className="flex items-center gap-2">
					<button
						onClick={handlePreviousPage}
						disabled={currentPage === 1}
						className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
					>
						Back
					</button>

					{/* Page Numbers */}
					<div className="flex items-center gap-1">
						{Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
							<button
								key={page}
								onClick={() => setCurrentPage(page)}
								className={`px-3 py-2 rounded-lg text-sm cursor-pointer font-semibold transition-colors ${
									currentPage === page ? "bg-primary-blue text-white" : "border border-gray-300 text-gray-700 hover:bg-gray-100"
								}`}
							>
								{page}
							</button>
						))}
					</div>

					<button
						onClick={handleNextPage}
						disabled={currentPage === totalPages}
						className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
					>
						Next
					</button>
				</div>
			</div>
		</main>
	);
}
