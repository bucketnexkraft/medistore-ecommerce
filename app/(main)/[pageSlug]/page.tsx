import { notFound } from "next/navigation";
import { loadEcommerceCategoryHome } from "@/components/ecommerce/categories/theme-registry";
import { ecommerceCategoryKeys, isEcommerceChromeSection, resolveEcommerceCategoryKey, type EcommerceSection } from "@/components/ecommerce/categories/category-contract";
import { loadStorefrontPageData } from "@/lib/storefront-page";
import { FlashDealsPageContent } from "@/components/ecommerce/categories/fashion-apparel/sections/flash_deal/FlashDealCountdown";

export const dynamic = "force-dynamic";

export default async function StorefrontDynamicPage({
	params,
}: {
	params: Promise<{ pageSlug: string }>;
}) {
	const { pageSlug } = await params;
	const { host, page, sections, contentHtml, storefrontCategory } = await loadStorefrontPageData(`/pages/${encodeURIComponent(pageSlug)}?react=1`);

	if (!page) {
		if (pageSlug === "flash-deals") return <FlashDealsPageContent host={host} />;
		notFound();
	}

	const typedSections = sections as EcommerceSection[];
	const contentSections = typedSections.filter((section) => !isEcommerceChromeSection(section));
	const hasStorefrontSections = contentSections.some((section) => {
		const variant = String(section?.variant || "").trim().toLowerCase();
		const layout = String(section?.layout || "").trim().toLowerCase();
		const componentKey = String(section?.component_key || section?.preset_key || section?.template?.component_key || "").trim();
		return variant !== "" || layout !== "" || componentKey !== "";
	});
	const inferredCategory = typedSections
		.map((section) => String(section.component_key || "").trim().toLowerCase())
		.flatMap((componentKey) => ecommerceCategoryKeys.filter((key) => componentKey.startsWith(`${key}-`)))[0];
	const categoryKey = resolveEcommerceCategoryKey(storefrontCategory?.key || storefrontCategory?.name) || inferredCategory || null;
	const CategoryHome = categoryKey ? await loadEcommerceCategoryHome(categoryKey) : null;

	if (hasStorefrontSections && CategoryHome) {
		return (
			<main>
				<CategoryHome sections={contentSections} host={host} />
			</main>
		);
	}

	if (contentHtml) {
		return (
			<main className="section py-10 md:py-14">
				<div className="rounded-[28px] border border-secondary-stroke bg-white p-6 md:p-8 lg:p-10 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
					<div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: contentHtml }} />
				</div>
			</main>
		);
	}

	const pageName = String(page?.name || pageSlug).trim();
	const pageDescription = String(page?.description || "").trim();

	return (
		<main className="section py-10 md:py-14">
			<div className="rounded-[28px] border border-secondary-stroke bg-white p-6 md:p-8 lg:p-10 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
				<div className="max-w-3xl">
					<h1 className="text-3xl font-bold text-primary-black md:text-4xl">{pageName || "Storefront Page"}</h1>
					{pageDescription ? <p className="mt-4 text-base text-primary-body md:text-lg">{pageDescription}</p> : null}
					<p className="mt-6 text-sm text-primary-body">
						This storefront page is live, but no sections or rich text content have been added yet.
					</p>
				</div>
			</div>
		</main>
	);
}
