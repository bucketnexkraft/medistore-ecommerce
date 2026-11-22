import { Footer } from "@/components/common/Footer";
import type { StorefrontChromeSection } from "@/lib/storefront-chrome";
import type { EcommerceChromeComponentProps } from "../chrome-registry";

export default function DefaultFooter({ section, preferencesData, host, demoOnly }: EcommerceChromeComponentProps) {
	return <Footer initialSection={section as StorefrontChromeSection} preferencesData={preferencesData} host={host} demoOnly={demoOnly} />;
}
