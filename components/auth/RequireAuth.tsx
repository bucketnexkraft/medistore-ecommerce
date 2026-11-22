"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { getDashboardPath } from "@/lib/auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";

type RequireAuthProps = {
	children: ReactNode;
	allowedRoles?: number[];
};

export function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
	const pathname = usePathname();
	const router = useRouter();
	const { isAuthenticated, isLoading, user } = useAuth();
	const isRoleBlocked = Boolean(allowedRoles?.length && !allowedRoles.includes(Number(user?.role)));

	useEffect(() => {
		if (isLoading) {
			return;
		}

		if (!isAuthenticated) {
			router.replace(`/signin?redirect=${encodeURIComponent(pathname || "/user-dashboard")}`);
			return;
		}

		if (isRoleBlocked) {
			router.replace(getDashboardPath(user));
		}
	}, [isAuthenticated, isLoading, isRoleBlocked, pathname, router, user]);

	if (isLoading || !isAuthenticated || isRoleBlocked) {
		return (
			<div className="fixed inset-0 z-[120] flex items-center justify-center bg-white">
				<div className="rounded-3xl border border-border bg-background px-8 py-6 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
					<div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-primary-black/15 border-t-primary-black" />
					<p className="text-base font-semibold text-foreground">
						{isLoading
							? "Checking your account..."
							: isRoleBlocked
								? "Redirecting to your dashboard..."
								: "Redirecting to sign in..."}
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						{isRoleBlocked
							? "This page is for a different account type. Taking you to the correct dashboard."
							: "Please wait a moment."}
					</p>
				</div>
			</div>
		);
	}

	return <>{children}</>;
}
