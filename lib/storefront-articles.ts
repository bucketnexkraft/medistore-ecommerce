import { serverApiFetch } from "@/lib/api-client";
import { resolveApiAssetUrl } from "@/lib/config";

export type StorefrontArticle = {
	slug: string;
	title: string;
	category: string;
	image: string;
	summary: string;
	body: string;
	date?: string;
};

const demoArticles: StorefrontArticle[] = [
	{
		slug: "planning-a-diagnostic-center",
		title: "What to consider when planning a diagnostic center",
		category: "Clinic Planning",
		image: "/images/hero-medical/stethoscope-background.jpg",
		summary: "Plan the layout, staffing and equipment needs before comparing suppliers.",
		body: "<p>Start with the tests your facility plans to offer and map how patients and samples will move through the space. Ask the clinical team to review the plan before you buy equipment.</p><p>When comparing suppliers, ask about installation, staff training, maintenance and the availability of consumables. Check your local licensing requirements before opening.</p>",
	},
	{
		slug: "recording-blood-pressure-readings",
		title: "রক্তচাপের রিডিং কীভাবে গুছিয়ে রাখবেন",
		category: "Health Blog",
		image: "/images/brand-showcase/new-arrivals.webp",
		summary: "রক্তচাপের রিডিং লিখে রাখলে চিকিৎসকের সঙ্গে পরের সাক্ষাতে আলোচনা সহজ হয়।",
		body: "<p>তারিখ, সময় এবং যন্ত্রে দেখা রিডিং লিখে রাখুন। পরের সাক্ষাতে এই তালিকা চিকিৎসককে দেখাতে পারেন।</p><p>কতবার মাপবেন বা কোনো রিডিং নিয়ে উদ্বেগ হলে কী করবেন, সে বিষয়ে আপনার চিকিৎসকের নির্দেশনা অনুসরণ করুন।</p>",
	},
	{
		slug: "questions-before-purchasing-oxygen-equipment",
		title: "অক্সিজেন যন্ত্র কেনার আগে কী কী প্রশ্ন করবেন",
		category: "Medical Equipment",
		image: "/images/brand-showcase/bundle-deals.webp",
		summary: "চিকিৎসকের পরামর্শের পাশাপাশি সরবরাহকারীর সেবা ও ওয়ারেন্টির তথ্য জেনে নিন।",
		body: "<p>কোন ধরনের যন্ত্র প্রয়োজন তা চিকিৎসকের সঙ্গে ঠিক করুন। এরপর সরবরাহকারীর কাছে ওয়ারেন্টি, ব্যবহার শেখানোর ব্যবস্থা এবং রক্ষণাবেক্ষণ সম্পর্কে জিজ্ঞাসা করুন।</p><p>সহায়তার নম্বর ও যন্ত্রের নির্দেশিকা সহজে পাওয়া যায় এমন জায়গায় রাখুন।</p>",
	},
	{
		slug: "preparing-for-a-dental-checkup",
		title: "দাঁতের চেকআপের আগে কীভাবে প্রস্তুতি নেবেন",
		category: "Health Blog",
		image: "/images/hero-medical/healthcare-background.webp",
		summary: "দাঁত বা মাড়ি নিয়ে প্রশ্ন থাকলে চেকআপের আগে লিখে রাখুন।",
		body: "<p>কোন সমস্যা কখন শুরু হয়েছে এবং কী কী প্রশ্ন করতে চান, তা লিখে রাখুন। আগে কোনো চিকিৎসা করিয়ে থাকলে সেই তথ্যও সঙ্গে রাখুন।</p><p>চেকআপের শেষে পরের ভিজিট এবং বাড়িতে দাঁতের যত্ন নেওয়ার বিষয়ে দন্তচিকিৎসকের নির্দেশনা জেনে নিন।</p>",
	},
];

export const articleText = (value: unknown) => typeof value === "string" ? value.trim() : "";

type ArticleResponse = {
	slug?: string;
	title?: string;
	category?: { name?: string } | null;
	image_url?: string | null;
	short_description?: string;
	description?: string;
	created_at?: string;
};

function normalizeArticle(row: ArticleResponse, host: string | null): StorefrontArticle | null {
	const slug = articleText(row?.slug);
	const title = articleText(row?.title);
	if (!slug || slug === "." || slug === ".." || /[\/\\]/.test(slug) || !title) return null;

	const image = articleText(row.image_url);
	return {
		slug,
		title,
		category: articleText(row.category?.name),
		image: /^(?:https?:\/\/[^/\\\s]+|\/(?![\/\\]))/i.test(image) && !/\/placeholder\.jpg(?:[?#]|$)/i.test(image)
			? resolveApiAssetUrl(image, host)
			: "/images/placeholder.jpg",
		summary: articleText(row.short_description),
		body: articleText(row.description),
		date: articleText(row.created_at),
	};
}

export const articleArchiveHref = (demo?: boolean) => demo ? "/blog?is_demo=1" : "/blog";
export const articleHref = (slug: string, demo?: boolean) => `/blog/${encodeURIComponent(slug)}${demo ? "?is_demo=1" : ""}`;

export async function loadStorefrontArticleFeed(
	host: string | null,
	{ home, limit, demo }: { home: boolean; limit: number; demo?: boolean },
) {
	if (demo) {
		return {
			heading: "Our Recent Health Articles",
			subheading: "Explore healthcare guides, equipment advice, and practical tips.",
			articles: demoArticles.slice(0, limit),
		};
	}

	const response = await serverApiFetch(`/landing/sections/blog?home=${home ? 1 : 0}&limit=${limit}`, host, {
		next: { revalidate: 300 },
	});
	if (!response.ok) throw new Error("Unable to load storefront articles");

	const { data } = (await response.json()) as {
		data?: { heading?: string; subheading?: string; blogs?: ArticleResponse[] };
	};
	return {
		heading: articleText(data?.heading),
		subheading: articleText(data?.subheading),
		articles: (Array.isArray(data?.blogs) ? data.blogs : [])
			.map((article) => normalizeArticle(article, host))
			.filter((article): article is StorefrontArticle => article !== null)
			.slice(0, limit),
	};
}

export async function loadStorefrontArticle(slug: string, host: string | null, demo?: boolean) {
	if (demo) return demoArticles.find((article) => article.slug === slug) ?? null;

	const response = await serverApiFetch(`/landing/blogs/${encodeURIComponent(slug)}`, host, { next: { revalidate: 300 } });
	if (response.status === 404) return null;
	if (!response.ok) throw new Error("Unable to load storefront article");

	const { data } = (await response.json()) as { data?: { blog?: ArticleResponse } };
	return data?.blog ? normalizeArticle(data.blog, host) : null;
}
