export const STOREFRONT_LINK_TYPES = [
  { value: "internal_route", label: "Internal Route" },
  { value: "storefront_page", label: "Storefront Page" },
  { value: "custom_path", label: "Custom Path" },
  { value: "external_url", label: "External URL" },
];

export const STOREFRONT_INTERNAL_ROUTE_OPTIONS = [
  { value: "/", label: "Home" },
  { value: "/products", label: "Products" },
  { value: "/categories", label: "Categories" },
  { value: "/brands", label: "Brands" },
  { value: "/deals", label: "Deals" },
  { value: "/new-arrival", label: "New Arrival" },
  { value: "/limited-sale", label: "Limited Sale" },
  { value: "/best-seller", label: "Best Seller" },
  { value: "/group-purchase", label: "Group Purchase" },
  { value: "/wishlist", label: "Wishlist" },
  { value: "/cart", label: "Cart" },
  { value: "/checkout", label: "Checkout" },
  { value: "/track-order", label: "Track Order" },
  { value: "/user-dashboard", label: "User Dashboard" },
];

const INTERNAL_ROUTE_SET = new Set(STOREFRONT_INTERNAL_ROUTE_OPTIONS.map((option) => option.value));

export const normalizeStorefrontLinkType = (value) => {
  if (value === "internal_route" || value === "storefront_page" || value === "custom_path" || value === "external_url") {
    return value;
  }

  return "custom_path";
};

export const resolveStorefrontPageHref = (slug) => {
  const normalizedSlug = String(slug || "").trim().toLowerCase();

  if (normalizedSlug === "") {
    return "#";
  }

  if (normalizedSlug === "home") {
    return "/";
  }

  return `/${normalizedSlug}`;
};

export const resolveStorefrontActionHref = (action) => {
  const linkType = normalizeStorefrontLinkType(action?.link_type);
  const routeKey = String(action?.route_key || "").trim();
  const expression = String(action?.expression || "").trim();
  const targetPageSlug = String(action?.target_page_slug || "").trim();
  const targetPageRouteMode = String(action?.target_page_route_mode || "").trim();
  const targetPageRouteKey = String(action?.target_page_route_key || "").trim();

  if (linkType === "internal_route") {
    if (routeKey !== "" && INTERNAL_ROUTE_SET.has(routeKey)) {
      return routeKey;
    }

    return expression || "#";
  }

  if (linkType === "external_url") {
    return expression || "#";
  }

  if (linkType === "storefront_page") {
    if (targetPageRouteMode === "internal_route" && targetPageRouteKey !== "") {
      return targetPageRouteKey;
    }

    return resolveStorefrontPageHref(targetPageSlug);
  }

  return expression || routeKey || "#";
};

export const buildStorefrontActionLinkState = (action = {}) => {
  const expression = String(action?.expression || "").trim();
  const routeKey = String(action?.route_key || "").trim();
  const linkType = normalizeStorefrontLinkType(action?.link_type);

  if (linkType === "internal_route") {
    const fallbackRoute = INTERNAL_ROUTE_SET.has(routeKey)
      ? routeKey
      : INTERNAL_ROUTE_SET.has(expression)
        ? expression
        : STOREFRONT_INTERNAL_ROUTE_OPTIONS[0].value;

    return {
      link_type: "internal_route",
      route_key: fallbackRoute,
      expression: fallbackRoute,
      target_page_id: "",
      target_page_slug: "",
    };
  }

  if (linkType === "external_url") {
    return {
      link_type: "external_url",
      route_key: "",
      expression,
      target_page_id: "",
      target_page_slug: "",
    };
  }

  if (linkType === "storefront_page") {
    return {
      link_type: "storefront_page",
      route_key: "",
      expression: "",
      target_page_id: String(action?.target_page_id || "").trim(),
      target_page_slug: String(action?.target_page_slug || "").trim(),
    };
  }

  return {
    link_type: "custom_path",
    route_key: "",
    expression,
    target_page_id: "",
    target_page_slug: "",
  };
};
