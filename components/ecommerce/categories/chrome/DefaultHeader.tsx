import Header from "@/components/common/Header";
import type { EcommerceChromeComponentProps } from "../chrome-registry";

export default function DefaultHeader({ initialData, host, demoOnly, previewMode }: EcommerceChromeComponentProps) {
	return <Header initialData={initialData} host={host} demoOnly={demoOnly} previewMode={previewMode} />;
}
