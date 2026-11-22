import React from "react";
import { fetchJustForYouSectionServer } from "@/lib/just-for-you";
import { ProductFeedSectionProducts } from "./BestSellingProducts/ProductFeedSectionProducts";

type ProductFeedSectionProps = {
	title?: string;
	subtitle?: string;
	demandTag?: string;
	host?: string | null;
	demoOnly?: boolean;
};

export default async function ProductFeedSection({ title, subtitle, demandTag, host = null, demoOnly = false }: ProductFeedSectionProps) {
	const initialSection = await fetchJustForYouSectionServer(host, 100, demandTag, demoOnly);

	const resolvedSection = {
		...initialSection,
		heading: title || initialSection.heading,
		subheading: subtitle || initialSection.subheading,
	};

	return (
		<div className="section mb-14">
			<ProductFeedSectionProducts title={title} subtitle={subtitle} demandTag={demandTag} initialSection={resolvedSection} />
		</div>
	);
}
