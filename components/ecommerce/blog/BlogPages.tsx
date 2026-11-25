import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import sanitizeHtml from "sanitize-html";
import { articleArchiveHref, loadStorefrontArticle, loadStorefrontArticleFeed } from "@/lib/storefront-articles";
import ArticleGrid from "./ArticleGrid";

type BlogPageProps = { host: string | null; demo?: boolean };

export async function BlogArchive({ host, demo }: BlogPageProps) {
	const feed = await loadStorefrontArticleFeed(host, { home: false, limit: 24, demo }).catch(() => null);

	return (
		<main className="bg-slate-50 py-10 md:py-14">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{feed?.heading || "Articles"}</h1>
				{feed?.subheading && <p className="mt-2 text-base font-normal! text-slate-600!">{feed.subheading}</p>}
				<div className="mt-7">
					{feed?.articles.length ? (
						<ArticleGrid articles={feed.articles} demo={demo} />
					) : (
						<p className="font-normal! text-slate-600!">{feed ? "No articles have been published yet." : "Articles are temporarily unavailable."}</p>
					)}
				</div>
			</div>
		</main>
	);
}

export async function BlogArticle({ slug, host, demo }: BlogPageProps & { slug: string }) {
	const article = await loadStorefrontArticle(slug, host, demo);
	if (!article) return null;
	const body = sanitizeHtml(article.body, {
		allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "iframe"],
		allowedAttributes: {
			...sanitizeHtml.defaults.allowedAttributes,
			img: ["src", "alt", "title", "width", "height"],
			iframe: ["src", "title", "allowfullscreen"],
		},
		allowedSchemes: ["http", "https", "mailto", "tel"],
		allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"],
		allowProtocolRelative: false,
	});

	return (
		<main className="bg-slate-50 py-10 md:py-14">
			<article className="mx-auto max-w-4xl px-4 sm:px-6">
				<Link href={articleArchiveHref(demo)} className="inline-flex items-center gap-2 text-sm font-semibold text-[#315c8a] hover:underline">
					<ArrowLeft aria-hidden="true" className="size-4" />
					All Articles
				</Link>
				{(article.category || article.date) && (
					<div className="mt-6 flex flex-wrap gap-x-3 text-sm text-slate-600">
						{article.category && <span className="font-semibold text-[#315c8a]">{article.category}</span>}
						{article.date && <span>{article.date}</span>}
					</div>
				)}
				<h1 className="mt-3 text-3xl leading-tight font-bold tracking-tight wrap-break-word text-slate-900 md:text-5xl">{article.title}</h1>
				{article.summary && <p className="mt-4 text-lg leading-relaxed font-normal! text-slate-600!">{article.summary}</p>}
				{!(/\/placeholder\.jpg(?:[?#]|$)/i.test(article.image)) && (
					<div className="relative mt-7 aspect-video overflow-hidden rounded-2xl bg-slate-100">
						<Image src={article.image} alt="" fill unoptimized sizes="(min-width: 896px) 848px, 100vw" className="object-cover" />
					</div>
				)}
				{body && (
					<div
						className="mt-7 space-y-4 text-base leading-relaxed wrap-break-word text-slate-800 [&_a]:text-[#315c8a] [&_a]:underline [&_iframe]:aspect-video [&_iframe]:w-full [&_img]:h-auto [&_img]:max-w-full [&_ol]:list-decimal [&_p]:font-normal! [&_p]:text-slate-800! [&_ul]:list-disc [&_ul,&_ol]:ps-6"
						dangerouslySetInnerHTML={{ __html: body }}
					/>
				)}
			</article>
		</main>
	);
}
