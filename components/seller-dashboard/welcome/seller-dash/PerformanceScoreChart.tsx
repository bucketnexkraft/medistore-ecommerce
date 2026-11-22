"use client";

import dynamic from "next/dynamic";
import { performanceMetrics } from "@/data/seller-dashboard-data";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export function PerformanceScoreChart() {
	const chartOptions: ApexCharts.ApexOptions = {
		chart: {
			type: "radialBar",
			toolbar: {
				show: false,
			},
		},
		plotOptions: {
			radialBar: {
				startAngle: -90,
				endAngle: 90,
				hollow: {
					margin: 0,
					size: "70%",
					background: "transparent",
					image: undefined,
					imageWidth: 150,
					imageHeight: 150,
					imageOffsetX: 0,
					imageOffsetY: 0,
				},
				dataLabels: {
					name: {
						show: false,
					},
					value: {
						show: true,
						fontSize: "36px",
						fontWeight: "700",
						offsetY: 10,
						color: "#1F2937",
					},
				},
				track: {
					background: "#E5E7EB",
					strokeWidth: "97%",
					margin: 5,
					dropShadow: {
						enabled: false,
					},
				},
			},
		},
		stroke: {
			lineCap: "round",
		},
		labels: ["Score"],
		colors: ["#16A34A"],
		responsive: [
			{
				breakpoint: 768,
				options: {
					chart: {
						height: 280,
					},
				},
			},
		],
	};

	const series = [92];

	return (
		<div className="bg-white rounded-lg border border-gray-200 p-6">
			<h2 className="text-xl font-bold mb-6">Performance Score</h2>

			<Chart options={chartOptions} series={series} type="radialBar" height={220} />

			{/* Metrics */}
			<div className="mt-4 space-y-2">
				{performanceMetrics.map((metric, index) => (
					<div key={index} className="flex items-center justify-between py-2 border-t border-gray-100 first:border-t-0 first:pt-0">
						<span className="text-gray-700 text-sm">{metric.label}</span>
						<span className="font-semibold text-green-600">{metric.value}</span>
					</div>
				))}
			</div>
		</div>
	);
}
