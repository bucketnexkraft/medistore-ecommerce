const COMPANY_LANDING_ROUTES = [
  { right: 'dashboard.view', feature: 'ftr_dashboard', path: '/dashboard' },
  { right: 'warehouse.view', feature: 'ftr_warehouses', path: '/warehouses' },
  { right: 'supplier.view', feature: 'ftr_suppliers', path: '/suppliers' },
  { right: 'user.view', feature: 'ftr_users', path: '/users' },
];

export const getCompanyLandingPath = (rights, activeFeatureCodes) => {
  const grantedRights = new Set(
    (Array.isArray(rights) ? rights : [])
      .filter((item) => Number(item?.permission) === 1)
      .map((item) => item.right)
  );
  const activeFeatures = new Set(Array.isArray(activeFeatureCodes) ? activeFeatureCodes : []);
  const destination = COMPANY_LANDING_ROUTES.find(
    ({ right, feature }) => grantedRights.has(right) && activeFeatures.has(feature)
  );

  return destination?.path || (grantedRights.has('product-setup.view')
    ? '/company-preference/feature-preference'
    : '/profile');
};
