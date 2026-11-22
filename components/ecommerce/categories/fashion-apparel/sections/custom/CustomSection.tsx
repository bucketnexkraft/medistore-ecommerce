import type { FashionSectionProps } from "../../types";

export default function CustomSection({ section }: FashionSectionProps) {
	const html = String(section.rich_text_html || section.content?.html || "").trim();

	if (!html) {
		return null;
	}

	return (
		<section className="section py-8 md:py-12">
			<div className="prose prose-lg mx-auto max-w-5xl rounded-[28px] border border-secondary-stroke bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] md:p-10" dangerouslySetInnerHTML={{ __html: html }} />
		</section>
	);
}
