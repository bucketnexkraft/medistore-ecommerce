import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  HiArrowRight,
  HiBolt,
  HiCheck,
  HiCheckCircle,
  HiCog6Tooth,
  HiExclamationTriangle,
} from 'react-icons/hi2';
import { getproductSettings } from '../../api/productSettings';
import { isFeatureIncludedInPlan } from '../../utils/planFeatures';
import { skipPlanJourney } from '../../utils/userJourney';
import { getCompanyLandingPath } from '../../utils/companyLanding';

export default function PlanJourney() {
  const navigate = useNavigate();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const companyId = useSelector((state) => state.auth.company_id);
  const selectedPlanId = useSelector((state) => state.auth.selected_plan_id);
  const selectedPlan = useSelector((state) => state.auth.selected_plan);
  const selectedPlanFeatures = useSelector((state) => state.auth.selected_plan_features || []);
  const rights = useSelector((state) => state.right.rights || []);
  const [preferences, setPreferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getproductSettings(accessToken);
      if (!result?.status) throw new Error(result?.message || 'Unable to load your plan features.');
      setPreferences(Array.isArray(result?.data?.preferences) ? result.data.preferences : []);
    } catch (requestError) {
      setError(requestError?.message || 'Unable to load your plan features.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const includedFeatures = useMemo(
    () => preferences.filter((item) => isFeatureIncludedInPlan(selectedPlanFeatures, item?.code)),
    [preferences, selectedPlanFeatures]
  );
  const activeFeatures = includedFeatures.filter((item) => item?.is_active);
  const inactiveFeatures = includedFeatures.filter((item) => !item?.is_active);
  const progress = includedFeatures.length
    ? Math.round((activeFeatures.length / includedFeatures.length) * 100)
    : 0;

  const handleSkip = () => {
    skipPlanJourney(companyId, selectedPlanId);
    navigate(getCompanyLandingPath(rights, preferences.filter((item) => item.is_active).map((item) => item.code)), { replace: true });
  };

  return (
    <div className='w-full px-3 py-4 text-slate-900 sm:px-5 md:px-6'>
      <div className='mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <p className='text-xs font-bold uppercase tracking-[0.16em] text-blue-600'>Getting started</p>
          <h1 className='mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl'>Set up your workspace</h1>
          <p className='mt-1 text-sm text-slate-500'>Review what is ready and switch on the tools your team needs.</p>
        </div>
        <button type='button' className='w-fit text-sm font-semibold text-slate-500 hover:text-slate-900' onClick={handleSkip}>
          Skip setup for now
        </button>
      </div>

      <section className='overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'>
        <div className='border-b border-slate-200 px-5 py-5 sm:px-7'>
          <div className='flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between'>
            <div className='flex items-start gap-4'>
              <div className='grid size-11 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-sm'>
                <HiCheck className='size-6' />
              </div>
              <div>
                <div className='flex flex-wrap items-center gap-2'>
                  <h2 className='text-xl font-bold text-slate-950'>Your workspace is ready</h2>
                  <span className='rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700'>{selectedPlan?.name || 'Current plan'}</span>
                </div>
                <p className='mt-1 max-w-2xl text-sm leading-6 text-slate-600'>
                  Thank you for choosing us. We activated your plan defaults, but several included tools still need your review for a smoother day-to-day workflow.
                </p>
              </div>
            </div>
            {!loading && !error && (
              <div className='min-w-64 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200'>
                <div className='flex items-center justify-between text-xs font-bold text-slate-600'>
                  <span>Workspace readiness</span><span>{progress}%</span>
                </div>
                <div className='mt-2 h-2 overflow-hidden rounded-full bg-slate-200'>
                  <div className='h-full rounded-full bg-blue-600 transition-all' style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className='grid min-h-80 place-items-center'><span className='loading loading-spinner loading-lg text-primary' /></div>
        ) : error ? (
          <div className='m-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700'>
            {error} <button type='button' className='font-bold underline' onClick={loadPreferences}>Try again</button>
          </div>
        ) : (
          <div className='flex flex-col'>
            <div className='order-2 border-t border-slate-200 p-5 sm:p-7'>
              <div className='flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5'>
                <HiExclamationTriangle className='mt-0.5 size-5 shrink-0 text-amber-600' />
                <div>
                  <p className='font-bold text-amber-950'>{inactiveFeatures.length} included features are still off</p>
                  <p className='mt-0.5 text-sm leading-5 text-amber-800'>Review these tools now to avoid missing useful workflow, reporting, and automation options later.</p>
                </div>
              </div>

              <div className='mt-6 flex items-center justify-between'>
                <div><h3 className='font-bold text-slate-950'>Recommended next step</h3><p className='mt-0.5 text-sm text-slate-500'>Available in your plan, waiting to be enabled.</p></div>
                <HiBolt className='size-5 text-amber-500' />
              </div>

              <div className='mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200'>
                {inactiveFeatures.slice(0, 6).map((feature) => (
                  <div key={feature.code} className='flex items-start gap-3 px-4 py-3'>
                    <span className='mt-1 size-4 shrink-0 rounded-full border-2 border-slate-300' />
                    <div className='min-w-0'><p className='font-semibold text-slate-800'>{feature.name}</p><p className='mt-0.5 truncate text-xs text-slate-500'>{feature.description}</p></div>
                  </div>
                ))}
                {inactiveFeatures.length === 0 && (
                  <div className='flex items-center gap-3 px-4 py-5 text-sm font-semibold text-emerald-700'><HiCheckCircle className='size-5' />All included features are active.</div>
                )}
              </div>
              {inactiveFeatures.length > 6 && <p className='mt-3 text-xs font-semibold text-slate-500'>+ {inactiveFeatures.length - 6} more features available to review</p>}

              <div className='mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <button type='button' className='rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50' onClick={handleSkip}>Continue to workspace</button>
                <button type='button' className='btn btn-primary gap-2' onClick={() => navigate('/company-preference/feature-preference')}>
                  Review and activate features <HiArrowRight className='size-4' />
                </button>
              </div>
            </div>

            <aside className='order-1 bg-slate-50/70 p-5 sm:p-7'>
              <div className='flex items-center gap-2'><HiCog6Tooth className='size-5 text-blue-600' /><h3 className='font-bold text-slate-950'>Active now</h3></div>
              <p className='mt-1 text-sm text-slate-500'>{activeFeatures.length} of {includedFeatures.length} plan features are on.</p>
              <div className='mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
                {activeFeatures.slice(0, 8).map((feature) => (
                  <div key={feature.code} className='flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 ring-1 ring-slate-200'>
                    <HiCheckCircle className='size-5 shrink-0 text-emerald-500' /><span className='text-sm font-semibold text-slate-700'>{feature.name}</span>
                    {feature.is_default_active && <span className='ml-auto text-[10px] font-bold uppercase tracking-wide text-slate-400'>Default</span>}
                  </div>
                ))}
                {activeFeatures.length > 8 && <p className='px-2 pt-1 text-xs font-semibold text-slate-500'>+ {activeFeatures.length - 8} more active features</p>}
              </div>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
