import Image from "next/image";
import Link from "next/link";
import { articleHref, type StorefrontArticle } from "@/lib/storefront-articles";

export default function ArticleGrid({
	articles,
	demo,
	readMore = "Read More",
}: {
	articles: StorefrontArticle[];
	demo?: boolean;
	readMore?: string;
}) {
	return (
		<ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
			{articles.map((article) => (
				<li key={article.slug} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/75 bg-white shadow-xs">
					<Link
						href={articleHref(article.slug, demo)}
						prefetch={false}
						aria-label={`${readMore}: ${article.title}`}
						className="group grid h-full grid-rows-[auto_1fr] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-700"
					>
						<div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
							<Image
								src={article.image}
								alt=""
								fill
								unoptimized
								sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
								className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
							/>
						</div>
						<div className="flex min-w-0 flex-col items-start gap-2 p-4">
							{article.category && <span className="text-xs font-semibold text-[#315c8a]">{article.category}</span>}
							<h3 className="text-base leading-relaxed font-semibold wrap-break-word text-slate-900">{article.title}</h3>
							<span className="mt-auto rounded-lg bg-[#1c3556] px-4 py-2 text-sm font-medium text-white group-hover:bg-[#294c75]">{readMore}</span>
						</div>
					</Link>
				</li>
			))}
		</ul>
	);
}
