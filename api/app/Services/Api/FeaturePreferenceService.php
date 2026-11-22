<?php

namespace App\Services\Api;

use App\Data\FeaturePreference;
use App\Data\FeaturePreferenceGroup;
use App\Models\CompanyFeaturePreference;
use App\Services\CompanyPlanFeatureService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class FeaturePreferenceService
{
    public function __construct(private readonly CompanyPlanFeatureService $companyPlanFeatureService)
    {
    }

    public function isEnabled(string $code, ?string $companyId = null): bool
    {
        $companyId ??= Auth::user()?->company_id;

        if (!$companyId || !in_array($code, FeaturePreference::values(), true)) {
            return false;
        }

        if (FeaturePreference::from($code)->isCore()) {
            return $this->companyPlanFeatureService->isFeatureAllowedByPlan($companyId, $code);
        }

        return (bool) CompanyFeaturePreference::query()
            ->where('company_id', $companyId)
            ->whereIn('feature', FeaturePreference::storedValuesFor($code))
            ->value('active');
    }

    public function index(): array
    {
        $user = Auth::user();

        if (!$user || !$user->company_id) {
            return [[
                'status' => 0,
                'message' => 'No company associated with the user.',
            ], 400];
        }

        $preferences = CompanyFeaturePreference::query()
            ->where('company_id', $user->company_id)
            ->orderBy('created_at')
            ->get()
            ->keyBy(fn ($item) => FeaturePreference::normalizeStoredValue($item->feature));
        $allowedCodes = $this->companyPlanFeatureService->allowedFeatureCodes($user->company_id);

        $assignedPreferences = [];
        $legacyFlags = [];
        foreach (FeaturePreference::cases() as $option) {
            $record = $preferences->get($option->value);
            $isInPlan = in_array($option->value, $allowedCodes, true);
            $isActive = $isInPlan && ($option->isCore() || (bool) optional($record)->active);

            if ($option->legacyField()) {
                $legacyFlags[$option->legacyField()] = $isActive ? 1 : 0;
            }

            $group = $option->group();
            $assignedPreferences[] = [
                'id' => $record?->id,
                'code' => $option->value,
                'name' => $option->label(),
                'description' => $option->description(),
                'is_active' => $isActive,
                'is_default_active' => $option->isCore() || (bool) $record?->is_default_active,
                'is_core' => $option->isCore(),
                'is_in_plan' => $isInPlan,
                'group' => $group->value,
                'group_name' => $group->label(),
                'group_description' => $group->description(),
                'group_order' => $group->order(),
            ];
        }

        return [[
            'status' => 1,
            'message' => 'Feature preferences fetched successfully.',
            'data' => array_merge($legacyFlags, [
                'preferences' => $assignedPreferences,
                'groups' => FeaturePreferenceGroup::options(),
            ]),
        ], 200];
    }

    public function update(string $code, bool $isActive): array
    {
        $user = Auth::user();

        if (!$user || !$user->company_id) {
            return [[
                'status' => 0,
                'message' => 'No company associated with the user.',
            ], 400];
        }

        if (!in_array($code, FeaturePreference::values(), true)) {
            return [[
                'status' => 0,
                'errors' => ['The selected code is invalid.'],
            ], 422];
        }

        if (!$isActive && FeaturePreference::from($code)->isCore()) {
            return [[
                'status' => 0,
                'errors' => ['This core feature must remain active.'],
            ], 422];
        }

        if ($isActive && !$this->companyPlanFeatureService->isFeatureAllowedByPlan($user->company_id, $code)) {
            return [[
                'status' => 0,
                'errors' => ['This feature is not included in your active plan.'],
            ], 422];
        }

        $preference = CompanyFeaturePreference::query()
            ->where('company_id', $user->company_id)
            ->whereIn('feature', FeaturePreference::storedValuesFor($code))
            ->first();

        if (!$preference) {
            $preference = CompanyFeaturePreference::create([
                'company_id' => $user->company_id,
                'feature' => $code,
                'active' => $isActive,
            ]);
        } else {
            $preference->update([
                'active' => $isActive,
            ]);
        }

        return [[
            'status' => 1,
            'message' => 'Feature preference updated successfully.',
            'data' => [
                'id' => $preference->id,
                'code' => $preference->feature,
                'is_active' => (bool) $preference->active,
            ],
        ], 200];
    }

    public function updateGroup(string $groupCode, bool $isActive): array
    {
        $user = Auth::user();

        if (!$user || !$user->company_id) {
            return [[
                'status' => 0,
                'message' => 'No company associated with the user.',
            ], 400];
        }

        $group = FeaturePreferenceGroup::tryFrom($groupCode);
        if (!$group) {
            return [[
                'status' => 0,
                'errors' => ['The selected feature group is invalid.'],
            ], 422];
        }

        $allowedCodes = $this->companyPlanFeatureService->allowedFeatureCodes($user->company_id);
        $groupOptions = collect(FeaturePreference::cases())
            ->filter(static fn (FeaturePreference $option) => $option->group() === $group);
        $eligibleOptions = $groupOptions
            ->filter(static fn (FeaturePreference $option) =>
                in_array($option->value, $allowedCodes, true)
                && ($isActive || !$option->isCore())
            );

        if ($isActive && $eligibleOptions->isEmpty()) {
            return [[
                'status' => 0,
                'errors' => ['No features in this group are included in your active plan.'],
            ], 422];
        }

        $updatedPreferences = DB::transaction(function () use ($eligibleOptions, $user, $isActive) {
            return $eligibleOptions->map(function (FeaturePreference $option) use ($user, $isActive) {
                $preference = CompanyFeaturePreference::query()
                    ->where('company_id', $user->company_id)
                    ->whereIn('feature', $option->storedValues())
                    ->first();

                if (!$preference) {
                    $preference = CompanyFeaturePreference::create([
                        'company_id' => $user->company_id,
                        'feature' => $option->value,
                        'active' => $isActive,
                    ]);
                } else {
                    $preference->update(['active' => $isActive]);
                }

                return [
                    'id' => $preference->id,
                    'code' => $option->value,
                    'is_active' => (bool) $preference->active,
                    'is_default_active' => (bool) $preference->is_default_active,
                ];
            })->values()->all();
        });

        $eligibleCodes = $eligibleOptions->map(static fn (FeaturePreference $option) => $option->value);
        $skippedCodes = $groupOptions
            ->reject(static fn (FeaturePreference $option) => $eligibleCodes->contains($option->value))
            ->map(static fn (FeaturePreference $option) => $option->value)
            ->values()
            ->all();

        return [[
            'status' => 1,
            'message' => $group->label().' features updated successfully.',
            'data' => [
                'group' => $group->toArray(),
                'preferences' => $updatedPreferences,
                'skipped_codes' => $skippedCodes,
            ],
        ], 200];
    }
}
