import { UserDashTitle } from "@/components/user-dashboard/common/UserDashTitle";
import { Orders } from "@/components/user-dashboard/orders/Orders";
import React from "react";

export default function page() {
	return (
		<div>
			<UserDashTitle title="My Orders" subtitle="View and manage orders" />
			<Orders />
		</div>
	);
}
