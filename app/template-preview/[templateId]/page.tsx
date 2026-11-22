import TemplatePreviewContent from "@/components/ecommerce/TemplatePreviewContent";
import StorefrontInitialPreloader from "@/components/common/StorefrontInitialPreloader";

export async function generateStaticParams() {
	return [];
}

export default async function TemplatePreviewPage({
	params,
}: {
	params: Promise<{ templateId: string }>;
}) {
	const { templateId } = await params;

	return (
		<>
			<TemplatePreviewContent templateId={templateId} />
			<StorefrontInitialPreloader />
		</>
	);
}
