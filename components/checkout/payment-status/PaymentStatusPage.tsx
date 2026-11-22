import Link from "next/link";
import { ReactNode } from "react";

interface PaymentStatusPageProps {
	title: string;
	description: string;
	icon: ReactNode;
	primaryHref: string;
	primaryLabel: string;
	secondaryHref: string;
	secondaryLabel: string;
}

export function PaymentStatusPage({
	title,
	description,
	icon,
	primaryHref,
	primaryLabel,
	secondaryHref,
	secondaryLabel,
}: PaymentStatusPageProps) {
	return (
		<div className="section py-16">
			<div className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10">
				<div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 text-primary-black">
					{icon}
				</div>
				<h1 className="mt-6 text-3xl font-bold text-primary-black sm:text-4xl">{title}</h1>
				<p className="mx-auto mt-4 max-w-2xl text-base text-primary-body sm:text-lg">{description}</p>
				<div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
					<Link
						href={primaryHref}
						className="inline-flex items-center justify-center rounded-full bg-primary-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
					>
						{primaryLabel}
					</Link>
					<Link
						href={secondaryHref}
						className="inline-flex items-center justify-center rounded-full border border-gray-300 px-6 py-3 text-sm font-semibold text-primary-black transition-colors hover:border-gray-400 hover:bg-zinc-50"
					>
						{secondaryLabel}
					</Link>
				</div>
			</div>
		</div>
	);
}
