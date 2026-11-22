"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { orderTrendData, timeframeOptions } from "@/data/seller-dashboard-data";
import { ChevronDown } from "lucide-react";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export function OrderTrendChart() {
	const [timeframe, setTimeframe] = useState<"last-1-day" | "last-3-days" | "last-7-days">("last-7-days");
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);

	const data = orderTrendData[timeframe];

	const chartOptions: ApexCharts.ApexOptions = {
		chart: {
			type: "bar",
			toolbar: {
				show: false,
			},
		},
		plotOptions: {
			bar: {
				horizontal: false,
				columnWidth: "55%",
				borderRadius: 4,
				dataLabels: {
					position: "top",
				},
			},
		},
		dataLabels: {
			enabled: false,
		},
		stroke: {
			show: true,
			width: 0,
			colors: ["transparent"],
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
		fill: {
			opacity: 1,
		},
		colors: ["#30D158"],
		grid: {
			borderColor: "#E5E7EB",
			strokeDashArray: 0,
		},
		tooltip: {
			theme: "light",
			y: {
				formatter: function (val) {
					return val + " orders";
				},
			},
		},
	};

	const series = [
		{
			name: "Orders",
			data: data.series,
		},
	];

	return (
		<div className="bg-white rounded-lg border border-gray-200 p-6">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-xl font-bold">Order Trend</h2>
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
										timeframe === option.value ? "bg-green-50 text-green-600 font-semibold" : "text-gray-700 hover:bg-gray-50"
									}`}
								>
									{option.label}
								</button>
							))}
						</div>
					)}
				</div>
			</div>

			<Chart options={chartOptions} series={series} type="bar" height={300} />
		</div>
	);
}
