import { loadAllStorefrontProducts, loadStorefrontBlogs, loadStorefrontBrands, loadStorefrontCategories, resolveAbsoluteUrl } from "@/lib/storefront-export";

export async function GET(request: Request) {
	const host = request.headers.get("host");
	const origin = new URL(request.url).origin;

	const [products, categories, brands, blogs] = await Promise.all([
		loadAllStorefrontProducts(host),
		loadStorefrontCategories(host),
		loadStorefrontBrands(host),
		loadStorefrontBlogs(host),
	]);

	const staticUrls = [
		"/",
		"/products",
		"/categories",
		"/brands",
		"/group-purchase",
		"/new-arrival",
		"/best-seller",
	];

	const urls = [
		...staticUrls.map((path) => ({ loc: resolveAbsoluteUrl(origin, path), lastmod: new Date().toISOString() })),
		...categories.map((category) => ({
			loc: resolveAbsoluteUrl(origin, `/categories/${String(category.slug || "")}`),
			lastmod: new Date().toISOString(),
		})),
		...brands.map((brand) => ({
			loc: resolveAbsoluteUrl(origin, String(brand.url || `/products?brand=${String(brand.slug || "")}`)),
			lastmod: new Date().toISOString(),
		})),
		...products.map((product) => ({
			loc: resolveAbsoluteUrl(origin, product.url),
			lastmod: product.createdAt || new Date().toISOString(),
		})),
		...blogs.map((blog) => ({
			loc: resolveAbsoluteUrl(origin, String(blog.url || "")),
			lastmod: new Date().toISOString(),
		})),
	];

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
	.map(
		(entry) => `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${entry.lastmod}</lastmod>
  </url>`,
	)
	.join("\n")}
</urlset>`;

	return new Response(body, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
		},
	});
}
