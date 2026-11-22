export const DEMAND_TAG_OPTIONS = [
  { value: "best_seller", label: "Best Seller", className: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "trending", label: "Trending", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "popular", label: "Popular", className: "bg-sky-100 text-sky-700 border-sky-200" },
  { value: "top_rated", label: "Top Rated", className: "bg-violet-100 text-violet-700 border-violet-200" },
  { value: "most_viewed", label: "Most Viewed", className: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { value: "most_sold", label: "Most Sold", className: "bg-red-100 text-red-700 border-red-200" },
  { value: "seasonal", label: "Seasonal", className: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "clearance", label: "Clearance", className: "bg-rose-100 text-rose-700 border-rose-200" },
  { value: "imported", label: "Imported", className: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "high_risk", label: "High Risk", className: "bg-orange-100 text-orange-700 border-orange-200" },
];

export const getDemandTag = (value) =>
  DEMAND_TAG_OPTIONS.find((tag) => tag.value === String(value || "").trim().toLowerCase()) || {
    value,
    label: value?.replaceAll("_", " ") || "",
    className: "bg-gray-100 text-gray-700 border-gray-200",
  };

export const normalizeDemandTags = (tags) => {
  if (!tags) return [];
  if (typeof tags === "string") {
    const trimmed = tags.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) =>
            typeof item === "string"
              ? item
              : item?.value ?? item?.label ?? null
          )
          .filter(Boolean);
      }
    } catch (_) {
      // Fall back to treating the input as a plain value.
    }

    return [trimmed].filter(Boolean);
  }

  if (Array.isArray(tags)) {
    return tags
      .map((item) =>
        typeof item === "string"
          ? item
          : item?.value ?? item?.label ?? null
      )
      .filter(Boolean);
  }

  return [tags].filter(Boolean);
};
