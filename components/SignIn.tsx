"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { extractApiError, getDashboardPath, normalizeAuthRedirectPath } from "@/lib/auth";
import { apiFetch } from "@/lib/api-client";
import { buildApiUrl } from "@/lib/config";
import { fetchStorefrontJson } from "@/lib/storefront-api-cache";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn, Mail } from "lucide-react";
import { useEffect, useState } from "react";

export function SignIn() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { isAuthenticated, isLoading: authLoading, setAuthSession, user } = useAuth();
	const [identifier, setIdentifier] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [rememberMe, setRememberMe] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [socialAuthEnabled, setSocialAuthEnabled] = useState(false);
	const redirectPath = normalizeAuthRedirectPath(searchParams.get("redirect"));

	useEffect(() => {
		if (!authLoading && isAuthenticated) {
			router.replace(redirectPath || getDashboardPath(user));
		}
	}, [authLoading, isAuthenticated, redirectPath, router, user]);

	useEffect(() => {
		const authToken = searchParams.get("auth_token");
		if (!authToken) {
			const authError = searchParams.get("auth_error");
			if (authError) {
				setError(authError);
			}
			return;
		}

		const bootstrapGoogleSession = async () => {
			setError("");
			setLoading(true);

			try {
				const response = await apiFetch("/verify-token", {
					method: "POST",
					headers: {
						Accept: "application/json",
						"Content-Type": "application/json",
						Authorization: `Bearer ${authToken}`,
					},
				});

				const result = await response.json().catch(() => null);

				if (!response.ok || result?.status !== 1 || !result?.user) {
					setError(extractApiError(result, "Unable to complete social sign in."));
					return;
				}

				setAuthSession({
					token: authToken,
					user: result.user,
					role_name: result.role_name,
				});

				router.replace(redirectPath || getDashboardPath(result.user));
			} catch {
				setError("Unable to complete social sign in right now.");
			} finally {
				setLoading(false);
			}
		};

		void bootstrapGoogleSession();
	}, [redirectPath, router, searchParams, setAuthSession]);

	useEffect(() => {
		let isMounted = true;

		const loadSocialAuthPreference = async () => {
			try {
				const preferences = await fetchStorefrontJson<{
					data?: {
						social_auth_enabled?: boolean;
						social_auth_available?: boolean;
					};
				}>("/landing/social-auth");
				const enabled = Boolean(
					preferences?.data?.social_auth_available ?? preferences?.data?.social_auth_enabled
				);

				if (isMounted) {
					setSocialAuthEnabled(enabled);
				}
			} catch {
				if (isMounted) {
					setSocialAuthEnabled(false);
				}
			}
		};

		void loadSocialAuthPreference();

		return () => {
			isMounted = false;
		};
	}, []);

	const handleSignIn = async (event: React.FormEvent) => {
		event.preventDefault();
		setError("");
		setLoading(true);

		try {
			const response = await apiFetch("/login", {
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					identifier,
					password,
					remember_me: rememberMe,
				}),
			});

			const result = await response.json().catch(() => null);

			if (!response.ok || result?.status !== 1 || !result?.token || !result?.user) {
				setError(extractApiError(result, "Unable to sign in with those credentials."));
				return;
			}

			setAuthSession({
				token: result.token,
				user: result.user,
				role_name: result.role_name,
			});

			router.push(redirectPath || getDashboardPath(result.user));
		} catch {
			setError("Unable to sign in right now. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleGoogleSignIn = () => {
		if (!socialAuthEnabled) {
			return;
		}

		const currentUrl = new URL(window.location.href);
		currentUrl.searchParams.delete("auth_token");
		currentUrl.searchParams.delete("auth_source");
		currentUrl.searchParams.delete("auth_error");

		const googleRedirectUrl = `${buildApiUrl("/auth/google/redirect")}?return_url=${encodeURIComponent(currentUrl.toString())}&storefront_host=${encodeURIComponent(window.location.host)}`;
		window.location.href = googleRedirectUrl;
	};

	return (
		<div className="min-h-screen bg-[url('/images/signin/signin_bg.webp')] bg-cover bg-center flex">
			<div className="hidden lg:flex lg:w-3/5 relative"></div>

			<div className="w-full lg:w-2/5 bg-white rounded-20 max-lg:mx-2 my-4 xl:mr-4 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
				<div className="w-full max-w-md">
					<div className="mb-8 text-center lg:text-left">
						<div className="flex items-center gap-2 mb-6 justify-center lg:justify-start">
							<AuthBrand />
						</div>
						<h1 className="text-3xl sm:text-4xl font-medium mb-1">Welcome Back!</h1>
						<span className="text-primary-body">Sign in with your email or phone and continue shopping.</span>
					</div>

					<form onSubmit={handleSignIn} className="space-y-5">
						{error ? <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div> : null}

						<div className="relative">
							<input
								type="text"
								placeholder="Enter your email or phone"
								value={identifier}
								onChange={(event) => setIdentifier(event.target.value)}
								className="w-full px-4 py-3 pr-12 border border-gray-400 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent text-gray-900 placeholder-gray-500"
								required
							/>
							<Mail className="absolute right-5 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
						</div>

						<div className="relative">
							<input
								type={showPassword ? "text" : "password"}
								placeholder="Enter your password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								className="w-full px-4 py-3 pr-12 border border-gray-400 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent text-gray-900 placeholder-gray-500"
								required
							/>
							<button
								type="button"
								onClick={() => setShowPassword(!showPassword)}
								className="absolute right-5 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-400 hover:text-gray-600 transition-colors"
							>
								{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
							</button>
						</div>

						<div className="flex items-center justify-between">
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={rememberMe}
									onChange={(event) => setRememberMe(event.target.checked)}
									className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-primary-blue"
								/>
								<span className="text-sm text-gray-700">Remember me</span>
							</label>
							<Link href="/forgot-password" className="text-sm text-primary-blue hover:text-purple-700 font-medium">
								Forgot Password
							</Link>
						</div>

						<button
							type="submit"
							disabled={loading || authLoading}
							className="w-full bg-primary-blue hover:bg-primary-blue/90 cursor-pointer disabled:opacity-50 text-white font-bold py-3 px-4 rounded-full transition-all duration-200 flex items-center justify-center gap-2"
						>
							{loading ? "Signing in..." : "Sign in"}
							{loading ? null : <LogIn size={18} />}
						</button>
					</form>

					{socialAuthEnabled ? (
						<>
							<div className="flex items-center gap-3 my-6">
								<div className="flex-1 h-px bg-gray-300"></div>
								<span className="text-sm text-gray-600">or</span>
								<div className="flex-1 h-px bg-gray-300"></div>
							</div>

							<button
								type="button"
								onClick={handleGoogleSignIn}
								className="w-full border border-gray-400 font-semibold py-3 px-4 rounded-full transition-colors duration-200 flex items-center justify-center gap-2"
							>
								<Image src="/images/signin/google.svg" alt="Google logo" width={16} height={16} />
								Sign in with Google
							</button>
						</>
					) : null}

					<p className="text-center text-gray-600 text-sm mt-6">
						Don&apos;t have an account?{" "}
						<Link href="/signup" className="text-primary-blue hover:text-purple-700 font-semibold">
							Sign up for free!
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
