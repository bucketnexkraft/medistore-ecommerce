import { headers } from "next/headers";
import { BlogArchive } from "@/components/ecommerce/blog/BlogPages";
import { loadStorefrontPageData } from "@/lib/storefront-page";
import StorefrontDynamicPage from "../[pageSlug]/page";

export default async function BlogPage({
	searchParams,
}: {
	searchParams: Promise<{ is_demo?: string }>;
}) {
	const demo = ["1", "true"].includes((await searchParams).is_demo ?? "");
	const host = (await headers()).get("host");
	if (!demo) {
		const { page, sections } = await loadStorefrontPageData("/pages/blog?react=1");
		const isLegacyArchive = sections.some((section) =>
			section.name === "blog" && !section.variant && !section.component_key && !section.preset_key
		);
		if (page && !isLegacyArchive) return <StorefrontDynamicPage params={Promise.resolve({ pageSlug: "blog" })} />;
	}
	return <BlogArchive host={host} demo={demo} />;
}
