import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ArticleGrid from "@/components/ecommerce/blog/ArticleGrid";
import { articleArchiveHref, articleText, loadStorefrontArticleFeed } from "@/lib/storefront-articles";
import type { FashionSectionProps } from "../../types";

type ArticleSectionConfig = {
	content?: { heading?: string; subheading?: string; view_all_label?: string; read_more_label?: string };
	data?: { items_allow?: number };
};

export default async function RecentHealthArticles({ section, host, demoOnly, index }: FashionSectionProps) {
	const config = section.config as ArticleSectionConfig | undefined;
	const content = config?.content ?? {};
	const limit = Math.max(1, Math.min(12, Math.trunc(Number(config?.data?.items_allow) || 4)));
	const feed = await loadStorefrontArticleFeed(host, { home: true, limit, demo: demoOnly }).catch(() => null);
	if (!feed?.articles.length) return null;

	const heading = articleText(content.heading) || feed.heading || "Recent Articles";
	const subheading = articleText(content.subheading) || feed.subheading;
	const headingId = `recent-articles-${section.id ?? index}`;

	return (
		<section data-storefront-section="fashion-apparel-recent-health-articles" aria-labelledby={headingId} className="bg-slate-50 py-10 md:py-14">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<div className="mb-7 flex flex-wrap items-end justify-between gap-4 md:mb-9">
					<div>
						<h2 id={headingId} className="text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">{heading}</h2>
						{subheading && <p className="mt-2 text-sm font-normal! text-slate-600! sm:text-base">{subheading}</p>}
					</div>
					<Link
						href={articleArchiveHref(demoOnly)}
						prefetch={false}
						className="inline-flex items-center gap-2 rounded-full bg-[#1c3556] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#294c75] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c3556]"
					>
						{articleText(content.view_all_label) || "View All"}
						<ArrowRight aria-hidden="true" className="size-4" />
					</Link>
				</div>
				<ArticleGrid articles={feed.articles} demo={demoOnly} readMore={articleText(content.read_more_label) || "Read More"} />
			</div>
		</section>
	);
}
