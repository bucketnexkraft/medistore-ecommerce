import Image from "next/image";
import { Eye, Trash2 } from "lucide-react";
import { OrderData } from "@/data/seller-dashboard-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface OrdersTableProps {
	orders: OrderData[];
}

const statusConfig = {
	new: { bg: "bg-blue-100", text: "text-blue-700", label: "New" },
	processing: { bg: "bg-[#FEF2E5]", text: "text-[#CD6200]", label: "Process" },
	shipped: { bg: "bg-purple-100", text: "text-purple-700", label: "Shipped" },
	delivered: { bg: "bg-green-100", text: "text-green-700", label: "Delivered" },
	cancelled: { bg: "bg-red-100", text: "text-red-700", label: "Cancelled" },
	returned: { bg: "bg-orange-100", text: "text-orange-700", label: "Returned" },
};

const paymentStatusConfig = {
	pending: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
	paid: { bg: "bg-green-100", text: "text-green-700", label: "Paid" },
	failed: { bg: "bg-red-100", text: "text-red-700", label: "Failed" },
	refunded: { bg: "bg-slate-200", text: "text-slate-700", label: "Refunded" },
};

export function OrdersTable({ orders }: OrdersTableProps) {
	const handleView = (orderId: string) => {
		console.log("View order:", orderId);
	};

	const handleDelete = (orderId: string) => {
		console.log("Delete order:", orderId);
	};

	return (
		<div className="overflow-x-auto rounded-lg border border-gray-200">
			<Table>
				<TableHeader>
					<TableRow className="bg-primary-blue hover:bg-primary-blue">
						<TableHead className="text-white w-12">
							<input type="checkbox" className="w-4 h-4" />
						</TableHead>
						<TableHead className="text-white">Tracking ID</TableHead>
						<TableHead className="text-white">Product</TableHead>
						<TableHead className="text-white">Type</TableHead>
						<TableHead className="text-white">Added date</TableHead>
						<TableHead className="text-white">Price</TableHead>
						<TableHead className="text-white">Category</TableHead>
						<TableHead className="text-white">Brand</TableHead>
						<TableHead className="text-white">Payment</TableHead>
						<TableHead className="text-white">Coupon</TableHead>
						<TableHead className="text-white">Stock</TableHead>
						<TableHead className="text-white">Status</TableHead>
						<TableHead className="text-white">Action</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{orders.map((order) => {
						const status = statusConfig[order.status];
						const payment = paymentStatusConfig[order.paymentStatus];
						return (
							<TableRow key={order.id} className="border-b hover:bg-gray-50">
								<TableCell>
									<input type="checkbox" className="w-4 h-4" />
								</TableCell>
								<TableCell className="font-semibold text-gray-900">{order.trackingId}</TableCell>
								<TableCell>
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0">
											<Image src={order.productImage} alt={order.productName} width={40} height={40} className="w-full h-full object-cover" />
										</div>
										<span className="font-medium text-gray-900">{order.productName}</span>
									</div>
								</TableCell>
								<TableCell>
									<span className="px-3 py-1 border border-primary-blue rounded-full text-primary-blue text-sm font-medium">{order.type}</span>
								</TableCell>
								<TableCell className="font-medium">{order.addedDate}</TableCell>
								<TableCell className="font-semibold">${order.price.toFixed(2)}</TableCell>
								<TableCell className="font-medium">{order.category}</TableCell>
								<TableCell className="font-medium">{order.brand}</TableCell>
								<TableCell>
									<div className="space-y-1">
										<div className="font-medium text-gray-900">{order.paymentChannel === "cod" ? "COD" : "Gateway"}</div>
										<div className="text-xs text-gray-500">{order.paymentMethod}</div>
										<span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${payment.bg} ${payment.text}`}>{payment.label}</span>
									</div>
								</TableCell>
								<TableCell>
									{order.couponCode ? (
										<div className="space-y-1">
											<div className="font-medium text-primary-blue">{order.couponCode}</div>
											<div className="text-xs text-green-700">-{`$${order.couponDiscountAmount?.toFixed(2) ?? "0.00"}`}</div>
										</div>
									) : (
										<span className="text-sm text-gray-400">None</span>
									)}
								</TableCell>
								<TableCell className="font-medium">{order.stock}</TableCell>
								<TableCell>
									<span className={`px-3 py-1.5 rounded-full text-sm font-medium ${status.bg} ${status.text}`}>{status.label}</span>
								</TableCell>
								<TableCell>
									<div className="flex items-center gap-2">
										<button
											onClick={() => handleView(order.id)}
											className="text-purple-500 hover:text-purple-700  cursor-pointer transition-colors"
											title="View"
										>
											<Eye size={18} />
										</button>
										<button onClick={() => handleDelete(order.id)} className="text-red-600 hover:text-red-700 cursor-pointer transition-colors" title="Delete">
											<Trash2 size={18} />
										</button>
									</div>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
