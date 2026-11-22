import type { NextConfig } from "next";

const buildRemotePattern = (value: string | undefined | null) => {
	if (!value) {
		return null;
	}

	try {
		const url = new URL(value);
		return {
			protocol: url.protocol.replace(":", "") as "http" | "https",
			hostname: url.hostname,
			port: url.port,
			pathname: "/**",
		};
	} catch {
		return null;
	}
};

const remotePatterns = [
	buildRemotePattern(process.env.NEXT_PUBLIC_API_URL),
	buildRemotePattern(process.env.NEXT_PUBLIC_API_BASE_URL),
	buildRemotePattern(process.env.NEXT_PUBLIC_STORE_URL),
	buildRemotePattern(process.env.NEXT_PUBLIC_STORAGE_URL),
	{
		protocol: "http",
		hostname: "127.0.0.1",
		port: "3000",
		pathname: "/**",
	},
	{
		protocol: "http",
		hostname: "localhost",
		port: "3000",
		pathname: "/**",
	},
	{
		protocol: "http",
		hostname: "127.0.0.1",
		port: "8000",
		pathname: "/**",
	},
	{
		protocol: "http",
		hostname: "localhost",
		port: "8000",
		pathname: "/**",
	},
	{
		protocol: "http",
		hostname: "mstore.ecommerce.com",
		port: "3000",
		pathname: "/**",
	},
	{
		protocol: "http",
		hostname: "mstore.ecommerce.com",
		port: "",
		pathname: "/**",
	},
	{
		protocol: "https",
		hostname: "mstore.ecommerce.com",
		port: "",
		pathname: "/**",
	},
	{
		protocol: "http",
		hostname: "demo.nex-ecom.orfactor.com",
		port: "3000",
		pathname: "/**",
	},
	{
		protocol: "http",
		hostname: "demo.nex-ecom.orfactor.com",
		port: "",
		pathname: "/**",
	},
	{
		protocol: "https",
		hostname: "demo.nex-ecom.orfactor.com",
		port: "",
		pathname: "/**",
	},
	{
		protocol: "https",
		hostname: "images.unsplash.com",
		port: "",
		pathname: "/**",
	},
].filter(Boolean) as NonNullable<NextConfig["images"]>["remotePatterns"];

const nextConfig: NextConfig = {
	allowedDevOrigins: ["arcade.orfactor.com"],
	images: {
		remotePatterns,
	},
	webpack: (config, { dev }) => {
		if (dev) {
			config.watchOptions = {
				...config.watchOptions,
				ignored: [
					...(Array.isArray(config.watchOptions?.ignored) ? config.watchOptions.ignored : []),
					"**/api/storage/**",
					"**/api/bootstrap/cache/**",
				],
			};
		}

		return config;
	},
};

export default nextConfig;
