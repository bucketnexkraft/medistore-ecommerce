import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BlogArticle } from "@/components/ecommerce/blog/BlogPages";

export default async function BlogDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ is_demo?: string }>;
}) {
	const [{ slug }, query, requestHeaders] = await Promise.all([params, searchParams, headers()]);
	const demo = ["1", "true"].includes(query.is_demo ?? "");
	return await BlogArticle({ slug, host: requestHeaders.get("host"), demo }) ?? notFound();
}
