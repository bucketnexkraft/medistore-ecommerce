"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { revenueTrendData, timeframeOptions } from "@/data/seller-dashboard-data";
import { ChevronDown } from "lucide-react";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export function RevenueTrendChart() {
	const [timeframe, setTimeframe] = useState<"last-1-day" | "last-3-days" | "last-7-days">("last-7-days");
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);

	const data = revenueTrendData[timeframe];

	const chartOptions: ApexCharts.ApexOptions = {
		chart: {
			type: "area",
			toolbar: {
				show: false,
			},
			sparkline: {
				enabled: false,
			},
		},
		fill: {
			type: "gradient",
			gradient: {
				shadeIntensity: 1,
				opacityFrom: 0.45,
				opacityTo: 0.05,
				stops: [20, 100, 100, 100],
			},
		},
		stroke: {
			curve: "smooth",
			width: 2,
			colors: ["#3B82F6"],
		},
		xaxis: {
			categories: data.categories,
			labels: {
				style: {
					colors: "#6B7280",
					fontSize: "12px",
				},
			},
			axisBorder: {
				show: false,
			},
		},
		yaxis: {
			labels: {
				style: {
					colors: "#6B7280",
				},
			},
		},
		colors: ["#3B82F6"],
		grid: {
			borderColor: "#E5E7EB",
			strokeDashArray: 0,
		},
		tooltip: {
			theme: "light",
			x: {
				show: true,
			},
		},
	};

	const series = [
		{
			name: "Revenue",
			data: data.series,
		},
	];

	return (
		<div className="bg-white rounded-lg border border-gray-200 p-6">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-xl font-bold">Revenue Trend</h2>
				<div className="relative">
					<button
						onClick={() => setIsDropdownOpen(!isDropdownOpen)}
						className="flex items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-100 border rounded-md cursor-pointer transition-colors"
					>
						<span className="text-sm">{timeframeOptions.find((opt) => opt.value === timeframe)?.label}</span>
						<ChevronDown size={16} />
					</button>
					{isDropdownOpen && (
						<div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
							{timeframeOptions.map((option) => (
								<button
									key={option.value}
									onClick={() => {
										setTimeframe(option.value as "last-1-day" | "last-3-days" | "last-7-days");
										setIsDropdownOpen(false);
									}}
									className={`w-full text-left px-4 py-2 text-sm transition-colors ${
										timeframe === option.value ? "bg-blue-50 text-blue-600 font-semibold" : "text-gray-700 hover:bg-gray-50"
									}`}
								>
									{option.label}
								</button>
							))}
						</div>
					)}
				</div>
			</div>

			<Chart options={chartOptions} series={series} type="area" height={300} />
		</div>
	);
}
