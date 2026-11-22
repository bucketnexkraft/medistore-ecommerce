import { SignIn } from "@/components/SignIn";
import { Suspense } from "react";

export default function page() {
	return (
		<div>
			<Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-primary-body">Loading sign in...</div>}>
				<SignIn />
			</Suspense>
		</div>
	);
}
