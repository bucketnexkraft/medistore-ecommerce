import { loadEcommerceCategoryHome } from "@/components/ecommerce/categories/theme-registry";
import StorefrontHomeRetry from "@/components/common/StorefrontHomeRetry";
import { ecommerceCategoryKeys, isEcommerceChromeSection, resolveEcommerceCategoryKey, type EcommerceSection } from "@/components/ecommerce/categories/category-contract";
import { loadStorefrontPageData } from "@/lib/storefront-page";
import TemplatePreviewContent, { getTemplatePreview } from "@/components/ecommerce/TemplatePreviewContent";

export const dynamic = "force-dynamic";

export default async function Home({
	searchParams,
}: {
	searchParams?: Promise<{ template_id?: string | string[]; is_demo?: string | string[]; preview_page?: string | string[] }>;
}) {
	const query = await searchParams;
	const templateId = Array.isArray(query?.template_id) ? query.template_id[0] : query?.template_id;
	const demoFlag = Array.isArray(query?.is_demo) ? query.is_demo[0] : query?.is_demo;
	const previewPage = Array.isArray(query?.preview_page) ? query.preview_page[0] : query?.preview_page;

	if (templateId && ["true", "1"].includes(String(demoFlag || "").toLowerCase())) {
		const previewHost = "demo.nex-ecom.orfactor.com";
		const preview = await getTemplatePreview(templateId, previewHost);

		return <TemplatePreviewContent templateId={templateId} host={previewHost} initialPreview={preview} pageSlug={previewPage} />;
	}

	const homeData = await loadStorefrontPageData("/home?react=1");
	if (homeData.requestFailed) {
		return <StorefrontHomeRetry />;
	}

	const sections = homeData.sections as EcommerceSection[];
	const contentSections = sections.filter((section) => !isEcommerceChromeSection(section));

	const hasRenderableSections = contentSections.some((section) => {
		const variant = String(section?.variant || "").trim().toLowerCase();
		const layout = String(section?.layout || "").trim().toLowerCase();
		const componentKey = String(section?.component_key || section?.preset_key || section?.template?.component_key || "").trim();
		return variant !== "" || layout !== "" || componentKey !== "";
	});
	const categoryValue = homeData.storefrontCategory?.key || homeData.storefrontCategory?.name;
	const inferredCategory = sections
		.map((section) => String(section.component_key || "").trim().toLowerCase())
		.flatMap((componentKey) => ecommerceCategoryKeys.filter((key) => componentKey.startsWith(`${key}-`)))
		[0];
	const categoryKey = resolveEcommerceCategoryKey(categoryValue) || inferredCategory || null;
	const CategoryHome = categoryKey ? await loadEcommerceCategoryHome(categoryKey) : null;

	return (
		<main>
			{hasRenderableSections && CategoryHome ? (
				<CategoryHome sections={contentSections} host={homeData.host} />
			) : homeData.contentHtml ? (
				<section className="section py-10 md:py-14">
					<div className="rounded-[28px] border border-secondary-stroke bg-white p-6 md:p-8 lg:p-10 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
						<div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: homeData.contentHtml }} />
					</div>
				</section>
			) : (
				<section className="section py-16 md:py-24">
					<div className="rounded-[28px] border border-secondary-stroke bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.06)] md:p-12">
						<div className="max-w-2xl">
							<p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-body">Storefront</p>
							<h1 className="mt-4 text-3xl font-bold text-primary-black md:text-4xl">No configuration has been set up yet</h1>
							<p className="mt-4 text-base text-primary-body">
								This store is live on the current domain, but no storefront home configuration has been created yet.
							</p>
						</div>
					</div>
				</section>
			)}
		</main>
	);
}
