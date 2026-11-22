const JOURNEY_STORAGE_PREFIX = 'stoqio:user-journey-skipped';

const journeyIdentity = (source = {}) => ({
  companyId: source?.company_id || source?.user?.company_id || '',
  planId: source?.selected_plan_id || source?.selected_plan?.id || '',
});

export const getPlanJourneyStorageKey = (companyId, planId) =>
  companyId && planId ? `${JOURNEY_STORAGE_PREFIX}:${companyId}:${planId}` : null;

export const hasSkippedPlanJourney = (companyId, planId) => {
  const key = getPlanJourneyStorageKey(companyId, planId);
  if (!key || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

export const skipPlanJourney = (companyId, planId) => {
  const key = getPlanJourneyStorageKey(companyId, planId);
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // Storage can be unavailable in privacy-restricted browsers.
  }
};

export const resetPlanJourney = (companyId, planId) => {
  const key = getPlanJourneyStorageKey(companyId, planId);
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in privacy-restricted browsers.
  }
};

export const shouldShowPlanJourney = (source = {}) => {
  const isSuperAdmin = Number(source?.user?.is_super_admin ?? source?.is_super_admin ?? 0) === 1;
  const { companyId, planId } = journeyIdentity(source);
  return !isSuperAdmin && Boolean(source?.has_active_plan) && Boolean(companyId) && Boolean(planId)
    && !hasSkippedPlanJourney(companyId, planId);
};
