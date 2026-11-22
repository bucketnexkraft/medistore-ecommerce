export const normalizePlanFeatures = (planOrFeatures) => {
  const source = Array.isArray(planOrFeatures)
    ? planOrFeatures
    : planOrFeatures?.effective_features ??
      planOrFeatures?.features ??
      planOrFeatures?.feature_codes ??
      planOrFeatures?.unlocked_features ??
      [];

  let parsedFeatures = source;

  if (typeof source === "string") {
    try {
      parsedFeatures = JSON.parse(source);
    } catch {
      parsedFeatures = source
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  if (
    parsedFeatures &&
    !Array.isArray(parsedFeatures) &&
    typeof parsedFeatures === "object"
  ) {
    parsedFeatures = Object.values(parsedFeatures);
  }

  return Array.isArray(parsedFeatures)
    ? parsedFeatures.map((feature) => String(feature)).filter(Boolean)
    : [];
};

export const isFeatureIncludedInPlan = (planFeatures, featureCode) => {
  if (!featureCode) return true;
  return normalizePlanFeatures(planFeatures).includes(featureCode);
};
