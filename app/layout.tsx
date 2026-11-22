import type { Metadata } from "next";
import { headers } from "next/headers";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { FloatingChatSupport } from "@/components/common/FloatingChatSupport";
import { CompareProvider } from "@/components/providers/CompareProvider";
import { CurrencyProvider } from "@/components/providers/CurrencyProvider";
import { WishlistProvider } from "@/components/providers/WishlistProvider";
import { Toaster } from "@/components/ui/toaster";
import { Geist, Geist_Mono } from "next/font/google";
import { loadStorefrontSettings } from "@/lib/storefront-settings";
import "react-phone-number-input/style.css";
import "./globals.css";

export const dynamic = "force-dynamic";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
	const fallbackTitle = "Nex Commerce";
	const fallbackDescription = "The best ecommerce";
	const fallbackIcon = "/favicon.ico";

	try {
		const headerStore = await headers();
		const host = headerStore.get("host");
		const { settingsData, preferencesData } = await loadStorefrontSettings(host);
		const siteName = String(preferencesData?.application_name ?? preferencesData?.name ?? settingsData?.sitename ?? fallbackTitle);
		const rawFaviconUrl = String(preferencesData?.site_favicon ?? settingsData?.icon_url ?? fallbackIcon);
		const faviconUrl = rawFaviconUrl.includes("?")
			? `${rawFaviconUrl}&v=${encodeURIComponent(rawFaviconUrl)}`
			: `${rawFaviconUrl}?v=${encodeURIComponent(rawFaviconUrl)}`;

		return {
			title: siteName,
			description: fallbackDescription,
			icons: {
				icon: [{ url: faviconUrl }],
				shortcut: [{ url: faviconUrl }],
				apple: [{ url: faviconUrl }],
			},
		};
	} catch {
		return {
			title: fallbackTitle,
			description: fallbackDescription,
			icons: {
				icon: [{ url: fallbackIcon }],
				shortcut: [{ url: fallbackIcon }],
				apple: [{ url: fallbackIcon }],
			},
		};
	}
}

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
				<AuthProvider>
					<WishlistProvider>
						<CompareProvider>
							<CurrencyProvider>
								{children}
								<FloatingChatSupport />
								<Toaster />
							</CurrencyProvider>
						</CompareProvider>
					</WishlistProvider>
				</AuthProvider>
			</body>
		</html>
	);
}
