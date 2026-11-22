"use client";

import { AuthBrand } from "@/components/auth/AuthBrand";
import { PhoneNumberInput } from "@/components/checkout/checkout-one/PhoneNumberInput";
import { useAuth } from "@/components/providers/AuthProvider";
import { extractApiError, getDashboardPath } from "@/lib/auth";
import { apiFetch } from "@/lib/api-client";
import { isValidPhoneNumber } from "libphonenumber-js";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";

export default function SignUp() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { isAuthenticated, isLoading: authLoading, setAuthSession, user } = useAuth();
	const [form, setForm] = useState({
		firstName: "",
		lastName: "",
		email: "",
		phone: "",
		password: "",
		confirmPassword: "",
	});
	const [referralCode, setReferralCode] = useState("");
	const [error, setError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	useEffect(() => {
		if (!authLoading && isAuthenticated) {
			router.replace(getDashboardPath(user));
		}
	}, [authLoading, isAuthenticated, router, user]);

	useEffect(() => {
		const nextReferralCode = searchParams.get("ref") || searchParams.get("referral_code") || "";
		setReferralCode(nextReferralCode.trim().toUpperCase());
	}, [searchParams]);

	const updateField = (field: keyof typeof form, value: string) => {
		setForm((current) => ({
			...current,
			[field]: value,
		}));
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError("");
		setSuccessMessage("");

		if (form.password !== form.confirmPassword) {
			setError("Password confirmation does not match.");
			return;
		}

		if (!isValidPhoneNumber(form.phone)) {
			setError("Enter a valid phone number with country code.");
			return;
		}

		setLoading(true);

		try {
			const response = await apiFetch("/register", {
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					first_name: form.firstName,
					last_name: form.lastName,
					company_name: `${form.firstName || "New"} ${form.lastName || "Store"}`.trim(),
					email: form.email,
					phone: form.phone,
					password: form.password,
					password_confirmation: form.confirmPassword,
					referral_code: referralCode || undefined,
				}),
				});

			const result = await response.json().catch(() => null);

			if (!response.ok || result?.status !== 1 || !result?.token || !result?.user) {
				setError(extractApiError(result, "Unable to create your account right now."));
				return;
			}

			setAuthSession({
				token: result.token,
				user: result.user,
				role_name: result.role_name,
			});
			setSuccessMessage("Your account is ready.");
			router.push(getDashboardPath(result.user));
		} catch {
			setError("Unable to create your account right now. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 relative">
			<div className="w-full h-full absolute inset-0">
				<Image src="/images/signin/signup_bg.png" alt="Sign in background" fill priority className="object-contain" />
			</div>
			<div className="w-full max-w-xl lg:p-10 p-4 bg-gray-50 rounded-20 relative border border-white/70 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
				<AuthBrand />

				<h1 className="text-3xl lg:text-4xl font-medium mt-6 mb-4">Create Your Account</h1>
				<p className="text-sm text-primary-body mb-8">Create your company account, then we will take you straight into your dashboard.</p>
				{referralCode ? (
					<div className="mb-6 rounded-2xl border border-primary-blue/20 bg-primary-blue/5 px-4 py-3 text-sm text-primary-black">
						Referral code <span className="font-semibold">{referralCode}</span> is applied to this signup.
					</div>
				) : null}

				<form onSubmit={handleSubmit} className="space-y-4">
					{error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
					{successMessage ? <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMessage}</div> : null}

					<div className="grid gap-4 sm:grid-cols-2">
						<input
							type="text"
							placeholder="First name"
							value={form.firstName}
							onChange={(event) => updateField("firstName", event.target.value)}
							className="w-full rounded-full border border-gray-300 bg-white px-4 py-3 outline-none focus:border-primary-blue"
							required
						/>
						<input
							type="text"
							placeholder="Last name"
							value={form.lastName}
							onChange={(event) => updateField("lastName", event.target.value)}
							className="w-full rounded-full border border-gray-300 bg-white px-4 py-3 outline-none focus:border-primary-blue"
						/>
					</div>

					<input
						type="email"
						placeholder="Email address"
						value={form.email}
						onChange={(event) => updateField("email", event.target.value)}
						className="w-full rounded-full border border-gray-300 bg-white px-4 py-3 outline-none focus:border-primary-blue"
						required
					/>

					<div className="space-y-2">
						<label className="block text-sm font-medium text-primary-black">Phone number</label>
						<PhoneNumberInput value={form.phone} onChange={(nextPhone) => updateField("phone", nextPhone)} />
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="relative">
							<input
								type={showPassword ? "text" : "password"}
								placeholder="Password"
								value={form.password}
								onChange={(event) => updateField("password", event.target.value)}
								className="w-full rounded-full border border-gray-300 bg-white px-4 py-3 pr-12 outline-none focus:border-primary-blue"
								required
							/>
							<button
								type="button"
								onClick={() => setShowPassword((current) => !current)}
								className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
								aria-label={showPassword ? "Hide password" : "Show password"}
							>
								{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
							</button>
						</div>
						<div className="relative">
							<input
								type={showConfirmPassword ? "text" : "password"}
								placeholder="Confirm password"
								value={form.confirmPassword}
								onChange={(event) => updateField("confirmPassword", event.target.value)}
								className="w-full rounded-full border border-gray-300 bg-white px-4 py-3 pr-12 outline-none focus:border-primary-blue"
								required
							/>
							<button
								type="button"
								onClick={() => setShowConfirmPassword((current) => !current)}
								className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
								aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
							>
								{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
							</button>
						</div>
					</div>

					<button
						type="submit"
						disabled={loading || authLoading}
						className="w-full rounded-full bg-primary-black px-4 py-3 font-bold text-white transition hover:bg-primary-black/90 disabled:opacity-60"
					>
						{loading ? "Creating account..." : "Create account"}
					</button>
				</form>

				<div className="text-sm space-y-4 mb-6 mt-8 text-primary-body">
					<p>Company accounts can manage their storefront, referrals, and dashboard access.</p>
					<p>Password diye account create korar por automatically login hoye jaben.</p>
				</div>

				<h6 className="text-sm font-medium text-center text-primary-black">
					Already have account?{" "}
					<Link href="/signin" className="text-primary-blue font-medium">
						Sign in
					</Link>
				</h6>
			</div>
		</div>
	);
}
