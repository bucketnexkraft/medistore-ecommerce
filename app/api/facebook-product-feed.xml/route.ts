import { escapeXml, loadAllStorefrontProducts, loadStorefrontPreferences, resolveAbsoluteUrl } from "@/lib/storefront-export";

export async function GET(request: Request) {
	const host = request.headers.get("host");
	const origin = new URL(request.url).origin;
	const [preferences, products] = await Promise.all([
		loadStorefrontPreferences(host),
		loadAllStorefrontProducts(host),
	]);

	const siteName = String(preferences?.name || preferences?.application_name || "Storefront").trim() || "Storefront";
	const siteLink = resolveAbsoluteUrl(origin, "/");

	const items = products
		.filter((product) => product.id && product.name && product.url)
		.map((product) => {
			const description = [product.brand, product.categoryName].filter(Boolean).join(" | ") || product.name;
			return `    <item>
      <g:id>${escapeXml(product.id)}</g:id>
      <g:title>${escapeXml(product.name)}</g:title>
      <g:description>${escapeXml(description)}</g:description>
      <g:link>${escapeXml(resolveAbsoluteUrl(origin, product.url))}</g:link>
      <g:image_link>${escapeXml(resolveAbsoluteUrl(origin, product.thumbnail || "/images/placeholder.jpg"))}</g:image_link>
      <g:availability>${product.quantity > 0 ? "in stock" : "out of stock"}</g:availability>
      <g:price>${product.price.toFixed(2)} USD</g:price>
      <g:brand>${escapeXml(product.brand || siteName)}</g:brand>
      <g:condition>new</g:condition>
      <g:product_type>${escapeXml(product.categoryName || "General")}</g:product_type>
    </item>`;
		})
		.join("\n");

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>${escapeXml(siteName)} Product Feed</title>
    <link>${escapeXml(siteLink)}</link>
    <description>${escapeXml(`${siteName} Facebook catalog feed`)}</description>
${items}
  </channel>
</rss>`;

	return new Response(body, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
		},
	});
}
