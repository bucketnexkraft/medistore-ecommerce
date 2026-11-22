import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { toast, ToastContainer } from 'react-toastify';
import {
  HiArchiveBox,
  HiArrowPath,
  HiBars3BottomLeft,
  HiCheckCircle,
  HiChevronDown,
  HiChevronUp,
  HiCog6Tooth,
  HiCube,
  HiLockClosed,
  HiRectangleGroup,
  HiShieldCheck,
  HiSparkles,
  HiTag,
  HiTruck,
  HiXCircle,
} from 'react-icons/hi2';
import {
  getproductSettings,
  updateFeaturePreferenceGroup,
  updateProductSettings,
} from '../../../api/productSettings';
import TableLoading from '../../../components/loadings/TableLoading';
import { isFeatureIncludedInPlan } from '../../../utils/planFeatures';
import { hasPermission } from '../../../utils/permissions';

const PASSWORD_PROTECTED_ROUTE_PREFERENCE = {
  code: 'ftr_password_protected_routes',
  name: 'Password Protected Routes',
  description: 'Enable password confirmation for protected routes such as roles.',
  is_active: false,
  is_default_active: false,
  group: 'workspace_access',
  group_name: 'Workspace & Access',
  group_description: 'Company settings, roles, and protected workspace access.',
  group_order: 10,
};

const GROUP_ICONS = {
  workspace_access: HiShieldCheck,
  product_catalog: HiCube,
  inventory_warehouse: HiArchiveBox,
  pos_sales: HiRectangleGroup,
  storefront_checkout: HiTruck,
  orders_customer_service: HiBars3BottomLeft,
  marketing_loyalty: HiTag,
  reports_insights: HiSparkles,
};

const mergeRequiredPreferences = (preferences) => {
  const list = Array.isArray(preferences) ? preferences : [];
  return list.some(
    (preference) =>
      preference.code === PASSWORD_PROTECTED_ROUTE_PREFERENCE.code
  )
    ? list
    : [...list, PASSWORD_PROTECTED_ROUTE_PREFERENCE];
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.errors?.[0] ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

function GroupCheckbox({ checked, mixed, disabled, onChange }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = mixed;
  }, [mixed]);

  return (
    <input
      ref={inputRef}
      type='checkbox'
      className='toggle toggle-primary toggle-sm shrink-0'
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      aria-label='Toggle all available features in this group'
    />
  );
}

export default function ProductSettings() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const selectedPlanFeatures = useSelector(
    (state) => state.auth.selected_plan_features || []
  );
  const isSuperAdmin =
    Number(useSelector((state) => state.auth.is_super_admin) || 0) === 1;
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [updatingCode, setUpdatingCode] = useState(null);
  const [updatingGroup, setUpdatingGroup] = useState(null);
  const canEdit = hasPermission('product-setup.edit');

  const isLockedByPlan = useCallback(
    (preference) => {
      if (isSuperAdmin) return false;
      if (typeof preference.is_in_plan === 'boolean') {
        return !preference.is_in_plan;
      }
      return (
        !isFeatureIncludedInPlan(selectedPlanFeatures, preference.code)
      );
    },
    [isSuperAdmin, selectedPlanFeatures]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getproductSettings(accessToken);
      if (!result.status) {
        throw new Error(result?.message || 'Failed to fetch feature preferences');
      }
      setPreferences(mergeRequiredPreferences(result?.data?.preferences));
    } catch (error) {
      console.error('Error fetching feature preferences:', error);
      toast.error(getErrorMessage(error, 'Failed to load feature preferences'));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const groups = useMemo(() => {
    const grouped = new Map();
    preferences.forEach((preference) => {
      const code = preference.group || 'workspace_access';
      if (!grouped.has(code)) {
        grouped.set(code, {
          code,
          name: preference.group_name || 'Workspace & Access',
          description:
            preference.group_description || 'Workspace feature preferences.',
          order: Number(preference.group_order || 999),
          preferences: [],
        });
      }
      grouped.get(code).preferences.push(preference);
    });
    return [...grouped.values()].sort((first, second) => first.order - second.order);
  }, [preferences]);

  const enabledCount = preferences.filter((preference) =>
    Boolean(preference.is_active)
  ).length;
  const lockedCount = preferences.filter(isLockedByPlan).length;
  const isUpdating = Boolean(updatingCode || updatingGroup);

  const toggleExpanded = (groupCode) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupCode)) next.delete(groupCode);
      else next.add(groupCode);
      return next;
    });
  };

  const handleFeatureToggle = async (preference, newValue) => {
    const result = await Swal.fire({
      title: newValue ? 'Enable this feature?' : 'Disable this feature?',
      text: `${preference.name} will be ${newValue ? 'available' : 'hidden'} for this workspace.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      confirmButtonText: newValue ? 'Enable feature' : 'Disable feature',
    });
    if (!result.isConfirmed) return;

    setUpdatingCode(preference.code);
    try {
      const response = await updateProductSettings(
        accessToken,
        preference.code,
        newValue
      );
      if (!response.status) throw new Error(response?.message || 'Update failed');
      setPreferences((current) =>
        current.map((item) =>
          item.code === preference.code
            ? { ...item, is_active: newValue }
            : item
        )
      );
      toast.success(`${preference.name} ${newValue ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update feature'));
    } finally {
      setUpdatingCode(null);
    }
  };

  const handleGroupToggle = async (group, newValue) => {
    const eligible = group.preferences.filter(
      (preference) => !isLockedByPlan(preference) && !preference.is_core
    );
    const result = await Swal.fire({
      title: newValue ? `Enable ${group.name}?` : `Disable ${group.name}?`,
      text: `${eligible.length} plan-available feature${
        eligible.length === 1 ? '' : 's'
      } will be ${newValue ? 'enabled' : 'disabled'}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      confirmButtonText: newValue ? 'Enable group' : 'Disable group',
    });
    if (!result.isConfirmed) return;

    setUpdatingGroup(group.code);
    try {
      const response = await updateFeaturePreferenceGroup(
        accessToken,
        group.code,
        newValue
      );
      const updates = new Map(
        (response?.data?.preferences || []).map((item) => [item.code, item])
      );
      setPreferences((current) =>
        current.map((item) =>
          updates.has(item.code)
            ? { ...item, ...updates.get(item.code) }
            : item
        )
      );
      const skipped = response?.data?.skipped_codes?.length || 0;
      toast.success(
        `${group.name} updated${
          skipped ? `; ${skipped} protected or plan-locked feature${skipped === 1 ? '' : 's'} unchanged` : ''
        }.`
      );
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update feature group'));
    } finally {
      setUpdatingGroup(null);
    }
  };

  return (
    <div className='w-full px-3 py-4 text-slate-900 sm:px-5 md:px-6'>
      <ToastContainer position='top-right' autoClose={5000} theme='colored' />

      <div className='mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'>
        <div className='flex flex-col gap-5 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex min-w-0 items-start gap-4'>
            <div className='grid size-12 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-100'>
              <HiShieldCheck className='size-6' />
            </div>
            <div>
              <p className='text-xs font-bold uppercase tracking-wider text-blue-600'>
                Company Preference
              </p>
              <h1 className='mt-1 text-2xl font-bold text-slate-950'>
                Feature Preference
              </h1>
              <p className='mt-1 max-w-2xl text-sm leading-6 text-slate-500'>
                Enable a complete workflow at once, or open a group to control
                its features individually.
              </p>
            </div>
          </div>

          <div className='grid grid-cols-3 gap-2 sm:min-w-80'>
            <div className='rounded-lg border border-slate-200 bg-slate-50 p-3'>
              <p className='text-[11px] font-bold uppercase text-slate-500'>Groups</p>
              <p className='mt-1 text-xl font-bold text-slate-950'>{groups.length}</p>
            </div>
            <div className='rounded-lg border border-emerald-100 bg-emerald-50 p-3'>
              <p className='text-[11px] font-bold uppercase text-emerald-700'>Active</p>
              <p className='mt-1 text-xl font-bold text-emerald-700'>{enabledCount}</p>
            </div>
            <div className='rounded-lg border border-amber-100 bg-amber-50 p-3'>
              <p className='text-[11px] font-bold uppercase text-amber-700'>Plan locked</p>
              <p className='mt-1 text-xl font-bold text-amber-700'>{lockedCount}</p>
            </div>
          </div>
        </div>

        <div className='flex flex-col gap-2 bg-slate-50/80 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between'>
          <span className='flex items-center gap-2 font-semibold text-slate-600'>
            <HiSparkles className='size-4 text-blue-600' />
            Optional features included in your plan can be changed. Core features stay on.
          </span>
          <span className='flex items-center gap-2 text-xs font-semibold text-slate-500'>
            {isUpdating ? (
              <span className='loading loading-spinner loading-xs text-blue-600' />
            ) : (
              <HiArrowPath className='size-4' />
            )}
            {isUpdating ? 'Saving changes' : 'Changes save after confirmation'}
          </span>
        </div>
      </div>

      {loading && <TableLoading />}
      {!loading && (
        <div className='space-y-3'>
          {groups.map((group) => {
            const GroupIcon = GROUP_ICONS[group.code] || HiCog6Tooth;
            const expanded = expandedGroups.has(group.code);
            const eligible = group.preferences.filter(
              (preference) => !isLockedByPlan(preference)
            );
            const changeable = eligible.filter((preference) => !preference.is_core);
            const activeAvailable = eligible.filter((preference) =>
              Boolean(preference.is_active)
            ).length;
            const allActive = eligible.length > 0 && activeAvailable === eligible.length;
            const mixed = activeAvailable > 0 && !allActive;
            const groupBusy = updatingGroup === group.code;

            return (
              <section
                key={group.code}
                className='overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md'
              >
                <div className='flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between'>
                  <button
                    type='button'
                    className='flex min-w-0 flex-1 items-start gap-3 text-left'
                    onClick={() => toggleExpanded(group.code)}
                    aria-expanded={expanded}
                  >
                    <span className='grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600'>
                      <GroupIcon className='size-5' />
                    </span>
                    <span className='min-w-0'>
                      <span className='flex flex-wrap items-center gap-2'>
                        <span className='text-base font-bold text-slate-950'>{group.name}</span>
                        <span className='rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600'>
                          {activeAvailable}/{eligible.length} active
                        </span>
                        {group.preferences.length > eligible.length && (
                          <span className='rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700'>
                            {group.preferences.length - eligible.length} plan locked
                          </span>
                        )}
                      </span>
                      <span className='mt-1 block text-sm leading-5 text-slate-500'>
                        {group.description}
                      </span>
                      <span className='mt-3 block h-1.5 max-w-md overflow-hidden rounded-full bg-slate-100'>
                        <span
                          className='block h-full rounded-full bg-emerald-500 transition-all'
                          style={{
                            width: `${eligible.length ? (activeAvailable / eligible.length) * 100 : 0}%`,
                          }}
                        />
                      </span>
                    </span>
                  </button>

                  <div className='flex items-center justify-between gap-4 sm:justify-end'>
                    {canEdit ? (
                      <div className='flex items-center gap-2'>
                        <span className='text-xs font-bold text-slate-500'>
                          {allActive ? 'All on' : mixed ? 'Some on' : 'All off'}
                        </span>
                        <GroupCheckbox
                          checked={allActive}
                          mixed={mixed}
                          disabled={isUpdating || changeable.length === 0}
                          onChange={(value) => handleGroupToggle(group, value)}
                        />
                      </div>
                    ) : (
                      <span className='rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700'>
                        View only
                      </span>
                    )}
                    <button
                      type='button'
                      className='grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50'
                      onClick={() => toggleExpanded(group.code)}
                      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${group.name}`}
                    >
                      {expanded ? (
                        <HiChevronUp className='size-4' />
                      ) : (
                        <HiChevronDown className='size-4' />
                      )}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className='border-t border-slate-100 bg-slate-50/70 p-3 sm:p-4'>
                    <div className='grid gap-2 lg:grid-cols-2'>
                      {group.preferences.map((preference) => {
                        const enabled = Boolean(preference.is_active);
                        const locked = isLockedByPlan(preference);
                        const itemBusy = updatingCode === preference.code || groupBusy;
                        return (
                          <div
                            key={preference.code}
                            className='flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3'
                          >
                            <div className='min-w-0'>
                              <div className='flex flex-wrap items-center gap-2'>
                                <h3 className='font-bold text-slate-900'>{preference.name}</h3>
                                {preference.is_core && (
                                  <span className='rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700'>
                                    Always on
                                  </span>
                                )}
                                {preference.is_default_active && !preference.is_core && (
                                  <span className='rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700'>
                                    Plan default
                                  </span>
                                )}
                              </div>
                              <p className='mt-1 text-sm leading-5 text-slate-500'>
                                {preference.description}
                              </p>
                              <span
                                className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${
                                  locked
                                    ? 'text-amber-700'
                                    : enabled
                                      ? 'text-emerald-700'
                                      : 'text-slate-500'
                                }`}
                              >
                                {locked ? (
                                  <HiLockClosed className='size-3.5' />
                                ) : enabled ? (
                                  <HiCheckCircle className='size-3.5' />
                                ) : (
                                  <HiXCircle className='size-3.5' />
                                )}
                                {locked ? 'Not included in plan' : enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>

                            {preference.is_core ? (
                              <span className='shrink-0 text-xs font-bold text-blue-700'>
                                Required
                              </span>
                            ) : canEdit && !locked ? (
                              <input
                                type='checkbox'
                                className='toggle toggle-primary toggle-sm mt-1 shrink-0'
                                checked={enabled}
                                disabled={isUpdating}
                                onChange={(event) =>
                                  handleFeatureToggle(preference, event.target.checked)
                                }
                                aria-label={`Toggle ${preference.name}`}
                              />
                            ) : locked ? (
                              <Link
                                to='/subscription/plans'
                                className='shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700'
                              >
                                View plans
                              </Link>
                            ) : (
                              <span className='shrink-0 text-xs font-bold text-slate-500'>
                                {enabled ? 'On' : 'Off'}
                              </span>
                            )}
                            {itemBusy && (
                              <span className='loading loading-spinner loading-xs shrink-0 text-blue-600' />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            );
          })}

          {groups.length === 0 && (
            <div className='flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 text-center'>
              <HiCog6Tooth className='size-8 text-slate-400' />
              <h3 className='mt-3 font-bold text-slate-900'>No feature preferences assigned</h3>
              <p className='mt-1 text-sm text-slate-500'>
                This company does not have feature preferences available yet.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
