"use client";

import { useState } from "react";
import { filterOptions } from "@/data/deals-data";

interface DealsFiltersProps {
	onFiltersChange: (filters: string[]) => void;
}

export function DealsFilters({ onFiltersChange }: DealsFiltersProps) {
	const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

	const handleFilterChange = (filterId: string, checked: boolean) => {
		const updated = checked ? [...selectedFilters, filterId] : selectedFilters.filter((f) => f !== filterId);

		setSelectedFilters(updated);
		onFiltersChange(updated);
	};

	const conditionFilters = filterOptions.filter((f) => f.category === "conditionType");
	const expiryFilters = filterOptions.filter((f) => f.category === "expiryWindow");
	const discountFilters = filterOptions.filter((f) => f.category === "discountRange");
	const categoryFilters = filterOptions.filter((f) => f.category === "category");

	return (
		<div className="bg-white rounded-lg p-6 border">
			<h2 className="text-lg font-bold text-gray-900 mb-6">Filters</h2>

			{/* Condition Type */}
			<div className="mb-8 pb-8 border-b border-gray-200">
				<h3 className="font-semibold text-gray-900 mb-4 text-sm">Condition Type</h3>
				<div className="space-y-3">
					{conditionFilters.map((filter) => (
						<label key={filter.id} className="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={selectedFilters.includes(filter.id)}
								onChange={(e) => handleFilterChange(filter.id, e.target.checked)}
								className="w-4 h-4"
							/>
							<span className="text-sm text-gray-700">{filter.label}</span>
						</label>
					))}
				</div>
			</div>

			{/* Expiry Window */}
			<div className="mb-8 pb-8 border-b border-gray-200">
				<h3 className="font-semibold text-gray-900 mb-4 text-sm">Expiry Window</h3>
				<div className="space-y-3">
					{expiryFilters.map((filter) => (
						<label key={filter.id} className="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={selectedFilters.includes(filter.id)}
								onChange={(e) => handleFilterChange(filter.id, e.target.checked)}
								className="w-4 h-4"
							/>
							<span className="text-sm text-gray-700">{filter.label}</span>
						</label>
					))}
				</div>
			</div>

			{/* Discount Range */}
			<div className="mb-8 pb-8 border-b border-gray-200">
				<h3 className="font-semibold text-gray-900 mb-4 text-sm">Discount Range</h3>
				<div className="space-y-3">
					{discountFilters.map((filter) => (
						<label key={filter.id} className="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={selectedFilters.includes(filter.id)}
								onChange={(e) => handleFilterChange(filter.id, e.target.checked)}
								className="w-4 h-4"
							/>
							<span className="text-sm text-gray-700">{filter.label}</span>
						</label>
					))}
				</div>
			</div>

			{/* Category */}
			<div>
				<h3 className="font-semibold text-gray-900 mb-4 text-sm">Category</h3>
				<div className="space-y-3">
					{categoryFilters.map((filter) => (
						<label key={filter.id} className="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={selectedFilters.includes(filter.id)}
								onChange={(e) => handleFilterChange(filter.id, e.target.checked)}
								className="w-4 h-4"
							/>
							<span className="text-sm text-gray-700">{filter.label}</span>
						</label>
					))}
				</div>
			</div>
		</div>
	);
}
