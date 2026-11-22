import { CategoryStorefrontHome } from "./CategoryStorefrontHome";
import type { FashionHomeProps } from "./types";
import { sectionRegistry } from "./sections/registry";

export default function FashionApparelHome(props: FashionHomeProps) {
	return <CategoryStorefrontHome {...props} sectionRegistry={sectionRegistry} />;
}
