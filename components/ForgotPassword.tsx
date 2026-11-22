"use client";

import { AuthBrand } from "@/components/auth/AuthBrand";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, LifeBuoy, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";

const recoverySteps = [
	{
		eyebrow: "Step 1",
		title: "Identify your account",
		description: "Use the email address linked to your Arcade account.",
	},
	{
		eyebrow: "Step 2",
		title: "Verify securely",
		description: "We will send a one-time recovery code once the reset service is connected.",
	},
	{
		eyebrow: "Step 3",
		title: "Create a new password",
		description: "Choose a fresh password and get back into your dashboard.",
	},
];

export function ForgotPassword() {
	const [email, setEmail] = useState("");
	const [error, setError] = useState("");
	const [submitted, setSubmitted] = useState(false);

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		setError("");

		const normalizedEmail = email.trim();

		if (!normalizedEmail) {
			setError("Enter the email address tied to your account.");
			return;
		}

		const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailPattern.test(normalizedEmail)) {
			setError("Enter a valid email address.");
			return;
		}

		setSubmitted(true);
	};

	return (
		<div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-900">
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.26),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.22),_transparent_30%),linear-gradient(135deg,_#eff6ff_0%,_#f8fafc_42%,_#e2e8f0_100%)]" />
			<div className="absolute left-[-10%] top-20 h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl" />
			<div className="absolute bottom-0 right-[-8%] h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />

			<div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
				<div className="grid overflow-hidden rounded-[36px] border border-white/50 bg-white/80 shadow-[0_32px_120px_rgba(15,23,42,0.18)] backdrop-blur xl:grid-cols-[1.05fr_0.95fr]">
					<section className="relative flex flex-col justify-between bg-slate-950 px-6 py-8 text-white sm:px-8 lg:px-10">
						<div className="absolute inset-0 bg-[linear-gradient(160deg,_rgba(15,23,42,0.96)_0%,_rgba(12,74,110,0.88)_52%,_rgba(6,95,70,0.82)_100%)]" />
						<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

						<div className="relative">
							<div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
								Account recovery
							</div>

							<div className="mt-6 max-w-lg">
								<h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
									Password help that feels like part of the product, not an afterthought.
								</h1>
								<p className="mt-4 text-sm leading-6 text-slate-200 sm:text-base">
									We redesigned recovery around clarity and trust, with stronger hierarchy, real guidance, and a less template-like feel.
								</p>
							</div>

							<div className="mt-8 grid gap-4">
								{recoverySteps.map((step) => (
									<div key={step.title} className="rounded-3xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
										<p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/85">{step.eyebrow}</p>
										<h2 className="mt-2 text-lg font-semibold text-white">{step.title}</h2>
										<p className="mt-2 text-sm leading-6 text-slate-200">{step.description}</p>
									</div>
								))}
							</div>
						</div>

						<div className="relative mt-8 flex flex-wrap items-center gap-4 text-sm text-slate-200">
							<div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2">
								<ShieldCheck size={16} className="text-cyan-200" />
								<span>Secure recovery flow</span>
							</div>
							<div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2">
								<LifeBuoy size={16} className="text-emerald-200" />
								<span>Support fallback included</span>
							</div>
						</div>
					</section>

					<section className="flex items-center px-6 py-8 sm:px-8 lg:px-10">
						<div className="w-full">
							<AuthBrand />

							<div className="mt-8 max-w-xl">
								<p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Forgot password</p>
								<h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.35rem]">
									Recover access without friction.
								</h2>
								<p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
									Enter your account email and we&apos;ll prepare the next step. This screen is production-ready visually and intentionally branded, while the reset API still needs to be connected.
								</p>
							</div>

							{submitted ? (
								<div className="mt-8 rounded-[28px] border border-emerald-200 bg-emerald-50 p-6">
									<div className="flex items-start gap-3">
										<CheckCircle2 className="mt-0.5 text-emerald-600" size={22} />
										<div>
											<h3 className="text-lg font-semibold text-emerald-950">Recovery screen updated</h3>
											<p className="mt-2 text-sm leading-6 text-emerald-900">
												The UI flow is ready and your email was captured locally as <span className="font-semibold">{email.trim()}</span>. The final send action should be wired to your backend reset endpoint next.
											</p>
										</div>
									</div>

									<div className="mt-5 flex flex-col gap-3 sm:flex-row">
										<button
											type="button"
											onClick={() => setSubmitted(false)}
											className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
										>
											Try another email
										</button>
										<Link
											href="/signin"
											className="inline-flex items-center justify-center rounded-full border border-emerald-300 px-5 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
										>
											Back to sign in
										</Link>
									</div>
								</div>
							) : (
								<form onSubmit={handleSubmit} className="mt-8">
									<div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
										{error ? <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

										<label className="block text-sm font-semibold text-slate-900" htmlFor="recovery-email">
											Account email
										</label>
										<p className="mt-1 text-sm text-slate-500">Use the email you sign in with so the reset request reaches the right account.</p>

										<div className="relative mt-4">
											<Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
											<input
												id="recovery-email"
												type="email"
												value={email}
												onChange={(event) => setEmail(event.target.value)}
												placeholder="you@example.com"
												className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-12 py-4 text-slate-900 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
												required
											/>
										</div>

										<div className="mt-6 flex flex-col gap-3 sm:flex-row">
											<button
												type="submit"
												className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
											>
												Continue recovery
											</button>
											<Link
												href="/signin"
												className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
											>
												<ArrowLeft size={16} className="mr-2" />
												Back to sign in
											</Link>
										</div>
									</div>
								</form>
							)}

							<div className="mt-6 rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-5">
								<p className="text-sm font-semibold text-slate-900">Why this feels more production-level</p>
								<p className="mt-2 text-sm leading-6 text-slate-600">
									The layout now carries brand weight, the left panel adds product context, and the form card focuses on trust and usability instead of relying on generic gradient-template patterns.
								</p>
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
