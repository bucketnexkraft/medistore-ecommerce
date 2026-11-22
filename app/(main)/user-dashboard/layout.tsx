import { RequireAuth } from "@/components/auth/RequireAuth";
import { Sidebar } from "@/components/user-dashboard/common/Sidebar";
import type { ReactNode } from "react";

export default function UserDashLayout({ children }: { children: ReactNode }) {
	return (
		<RequireAuth>
			<div className="section flex xl:flex-row flex-col gap-6 py-10">
				<div className="xl:w-1/5 w-full">
					<Sidebar />
				</div>
				<main className="xl:w-4/5 w-full ">{children}</main>
			</div>
		</RequireAuth>
	);
}
