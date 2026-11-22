import Link from "next/link";
import SafeImage from "@/components/common/SafeImage";
import { type FeaturedProduct } from "@/lib/featured-products";

type HeroProps = {
	initialProducts?: FeaturedProduct[];
};

export default function Hero({ initialProducts = [] }: HeroProps) {
	const [primary, secondary, tertiary] = initialProducts;

	if (!primary) {
		return null;
	}

	return (
		<div className="container mx-auto px-4 pt-10 lg:px-0">
			<div className="grid gap-5 lg:grid-cols-[minmax(0,2.1fr)_minmax(320px,1fr)]">
				<Link
					href={primary.url}
					className="group block min-h-[320px] overflow-hidden rounded-20 border border-secondary-stroke bg-white md:min-h-[420px] lg:min-h-[560px]"
					aria-label={primary.name}
				>
					<SafeImage
						unoptimized
						priority
						src={primary.image}
						alt={primary.name}
						width={1100}
						height={760}
						className="h-[320px] w-full object-cover md:h-[420px] lg:h-[560px]"
					/>
				</Link>

				<div className="grid gap-5">
					{secondary ? (
						<Link
							href={secondary.url}
							className="group block min-h-[220px] overflow-hidden rounded-20 border border-secondary-stroke bg-white md:min-h-[260px] lg:min-h-[270px]"
							aria-label={secondary.name}
						>
							<SafeImage
								unoptimized
								src={secondary.image}
								alt={secondary.name}
								width={520}
								height={360}
								className="h-[220px] w-full object-cover md:h-[260px] lg:h-[270px]"
							/>
						</Link>
					) : null}

					{tertiary ? (
						<Link
							href={tertiary.url}
							className="group block min-h-[220px] overflow-hidden rounded-20 border border-secondary-stroke bg-white md:min-h-[260px] lg:min-h-[270px]"
							aria-label={tertiary.name}
						>
							<SafeImage
								unoptimized
								src={tertiary.image}
								alt={tertiary.name}
								width={520}
								height={360}
								className="h-[220px] w-full object-cover md:h-[260px] lg:h-[270px]"
							/>
						</Link>
					) : null}
				</div>
			</div>
		</div>
	);
}
