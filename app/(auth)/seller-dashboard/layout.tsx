import type { ReactNode } from "react";
import { redirect } from "next/navigation";

type AuthLayoutProps = {
	children: ReactNode;
};

export default function SellerDashboardLayout({ children }: AuthLayoutProps) {
	void children;

	redirect("/user-dashboard");
}
