<?php

namespace App\Services\Api;

use App\Enums\TemplateTypes;
use App\Jobs\SendStoreSetupCompletedEmail;
use App\Jobs\SyncCompanyDemoData;
use App\Models\Company;
use App\Models\CompanyETemplateAccess;
use App\Models\ECategory;
use App\Models\ETemplate;
use App\Services\Backoffice\ETemplateBuilderService;
use App\Support\StorefrontCategorySectionCatalog;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class EcommerceSetupService
{
    public function __construct(
        private readonly ETemplateBuilderService $templateBuilderService,
        private readonly StorefrontHomeBuilderService $storefrontHomeBuilderService
    ) {
    }

    private function resolveCompany(): Company
    {
        $user = auth()->user();

        if (! $user || ! $user->company_id) {
            throw new HttpResponseException(response()->json([
                'status' => 0,
                'message' => 'No company associated with the current user.',
            ], 404));
        }

        $company = Company::query()
            ->with(['saasPlan', 'selectedETemplate', 'ecommerceCategory', 'user'])
            ->find($user->company_id);

        if (! $company) {
            throw new HttpResponseException(response()->json([
                'status' => 0,
                'message' => 'Company not found.',
            ], 404));
        }

        $hasActivePlan = ! empty($company->saas_plan_id)
            && ! empty($company->plan_subscribed_at)
            && ! empty($company->saasPlan)
            && (bool) ($company->saasPlan->status ?? false);

        if (! $hasActivePlan) {
            throw new HttpResponseException(response()->json([
                'status' => 0,
                'message' => 'An active plan is required before ecommerce setup.',
            ], 403));
        }

        return $company;
    }

    private function templatePayload(?Company $company = null, bool $includePaid = false, bool $compact = false): array
    {
        $query = ETemplate::query()->orderBy('template_name');

        if ($compact) {
            $query->select([
                'id',
                'template_name',
                'template_type',
                'price',
                'short_description',
                'image',
                'categories',
                'tags',
                'section_preset_refs',
            ]);
        } else {
            $query->withCount(['pages', 'sections', 'actions']);
        }

        $accessibleTemplateIds = $company
            ? $company->eTemplateAccesses()->pluck('template_id')->map(fn ($id) => (int) $id)->all()
            : [];

        $this->excludeTakenSingleUseTemplates($query, $company?->company_id);

        if ($company && ($compact || ! $includePaid)) {
            $query->where(function ($builder) use ($accessibleTemplateIds) {
                $builder->whereIn('template_type', [TemplateTypes::Free->value, 'free']);
                $builder->orWhereIn('id', $accessibleTemplateIds);
            });
        }

        return $query->get()
            ->map(function (ETemplate $template) use ($company, $accessibleTemplateIds) {
                $templateOriginalPrice = max((float) $template->price, 0);
                $templatePrice = $this->templatePrice($template);

                return [
                    'id' => $template->id,
                    'template_name' => $template->template_name,
                    'short_description' => $template->short_description,
                    'price' => $template->price,
                    'original_price' => round($templateOriginalPrice, 2),
                    'discounted_price' => round($templatePrice, 2),
                    'template_type' => TemplateTypes::fromValue($template->template_type ?? null)->value,
                    'has_access' => $company
                        ? TemplateTypes::isFreeValue($template->template_type ?? null)
                            || in_array((int) $template->id, $accessibleTemplateIds, true)
                        : false,
                    'discount_amount' => $template->discount_amount ?? 0,
                    'discount_type' => $template->discount_type ?? 'fixed',
                    'plan_ids' => [],
                    'plan_original_price' => 0,
                    'plan_price' => 0,
                    'plan_discount_amount' => 0,
                    'plan_discount_type' => 'fixed',
                    'total_price' => round($templatePrice, 2),
                    'original_total_price' => round($templateOriginalPrice, 2),
                    'plan' => null,
                    'image_url' => $template->image_url,
                    'demo_preview_url' => $this->demoPreviewUrl((int) $template->id),
                    'categories' => $template->categories ?? [],
                    'tags' => $template->tags ?? [],
                    'pages_count' => (int) ($template->pages_count ?? 0),
                    'sections_count' => (int) ($template->sections_count ?? 0),
                    'actions_count' => (int) ($template->actions_count ?? 0),
                    'section_preset_refs' => $template->section_preset_refs ?? [],
                ];
            })
            ->values()
            ->all();
    }

    private function demoPreviewUrl(int $templateId): string
    {
        $baseUrl = rtrim((string) config('app.demo_preview_url'), '/');
        $token = rawurlencode(Crypt::encryptString((string) $templateId));

        return $baseUrl . '?template_id=' . $token . '&mode=demo';
    }

    private function templatePlanPrice($plan): float
    {
        $price = $this->planOriginalPrice($plan);

        if ($price <= 0) {
            return 0.0;
        }

        $discount = max((float) ($plan->discount_amount ?? 0), 0);
        $discountValue = ($plan->discount_type ?? 'fixed') === 'percent'
            ? $price * min($discount, 100) / 100
            : $discount;

        return round(max($price - $discountValue, 0), 2);
    }

    private function planOriginalPrice($plan): float
    {
        if (! $plan || ($plan->is_free ?? null) === 'free' || (method_exists($plan, 'isCommissionBased') && $plan->isCommissionBased())) {
            return 0.0;
        }

        return max((float) ($plan->price ?? 0), 0);
    }

    private function templatePrice(ETemplate $template): float
    {
        if (TemplateTypes::isFreeValue($template->template_type ?? null)) {
            return 0.0;
        }

        $price = max((float) ($template->price ?? 0), 0);
        $discount = max((float) ($template->discount_amount ?? 0), 0);
        $discountValue = ($template->discount_type ?? 'fixed') === 'percent'
            ? $price * min($discount, 100) / 100
            : $discount;

        return round(max($price - $discountValue, 0), 2);
    }

    private function excludeTakenSingleUseTemplates($query, ?string $allowedCompanyId = null): void
    {
        $takenIds = CompanyETemplateAccess::query()
            ->when($allowedCompanyId, fn ($access) => $access->where('company_id', '!=', $allowedCompanyId))
            ->pluck('template_id')
            ->filter()
            ->values()
            ->all();

        if (empty($takenIds)) {
            return;
        }

        $query->where(function ($builder) use ($takenIds) {
            $builder
                ->whereNotIn('template_type', [
                    TemplateTypes::PremiumSingleUse->value,
                    'premium single use',
                    'premium_single_use',
                    'ptsu',
                ])
                ->orWhereNotIn('id', $takenIds);
        });
    }

    private function categoryPayload()
    {
        $configuredNames = StorefrontCategorySectionCatalog::categoryNames();

        if (empty($configuredNames)) {
            return ECategory::query()
                ->where('status', true)
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (ECategory $category) => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'key' => Str::slug((string) $category->name),
                ]);
        }

        $ordering = implode(', ', array_map(
            fn (string $name) => DB::getPdo()->quote($name),
            $configuredNames
        ));

        return ECategory::query()
            ->where('status', true)
            ->whereIn('name', $configuredNames)
            ->orderByRaw("FIELD(name, {$ordering})")
            ->get(['id', 'name'])
            ->map(fn (ECategory $category) => [
                'id' => $category->id,
                'name' => $category->name,
                'key' => Str::slug((string) $category->name),
            ]);
    }

    public function getResponse(bool $includePaid = false, bool $compact = false): array
    {
        $company = $this->resolveCompany();
        $templates = $this->templatePayload($company, $includePaid, $compact);

        return [
            'status' => 1,
            'message' => 'Ecommerce setup data loaded successfully.',
            'data' => [
                'company' => [
                    'company_id' => $company->company_id,
                    'name' => $company->name,
                    'ecommerce_setup_completed_at' => optional($company->ecommerce_setup_completed_at)->toDateTimeString(),
                    'selected_e_template_id' => $company->selected_e_template_id,
                    'ecommerce_category_id' => $company->ecommerce_category_id,
                ],
                'selected_template' => $company->selectedETemplate ? [
                    'id' => $company->selectedETemplate->id,
                    'template_name' => $company->selectedETemplate->template_name,
                    'primary_color' => $company->selectedETemplate->primary_color,
                    'secondary_color' => $company->selectedETemplate->secondary_color,
                    'font_family' => $company->selectedETemplate->font_family,
                    'short_description' => $company->selectedETemplate->short_description,
                    'price' => $company->selectedETemplate->price,
                    'image_url' => $company->selectedETemplate->image_url,
                    'section_preset_refs' => $company->selectedETemplate->section_preset_refs ?? [],
                ] : null,
                'selected_category' => $company->ecommerceCategory ? [
                    'id' => $company->ecommerceCategory->id,
                    'name' => $company->ecommerceCategory->name,
                ] : null,
                'categories' => $this->categoryPayload(),
                'templates' => $templates,
            ],
        ];
    }

    public function getPostPaymentOptions(): array
    {
        return $this->getResponse(true, true);
    }

    public function getPublicOptions(): array
    {
        $categories = $this->categoryPayload();
        $templates = $this->templatePayload();

        return [
            'status' => 1,
            'message' => 'Public ecommerce setup options loaded successfully.',
            'data' => [
                'selected_template' => $templates[0] ?? null,
                'selected_category' => $categories->first(),
                'categories' => $categories,
                'template_types' => TemplateTypes::options(),
                'templates' => $templates,
            ],
        ];
    }

    public function getPublicPremiumTemplateOptions(string $search = '', int $page = 1, int $perPage = 20, ?int $templateId = null, ?int $excludeTemplateId = null, ?string $companyId = null): array
    {
        $query = ETemplate::query()
            ->whereIn('template_type', [
                TemplateTypes::Premium->value,
                'paid',
                'premium',
                'premimum',
            ])
            ->orderBy('template_name');

        $this->excludeTakenSingleUseTemplates($query);

        if ($templateId) {
            $query->whereKey($templateId);
        }

        if ($excludeTemplateId) {
            $query->where('id', '!=', $excludeTemplateId);
        }

        if ($companyId) {
            $accessibleTemplateIds = CompanyETemplateAccess::query()
                ->where('company_id', $companyId)
                ->pluck('template_id')
                ->filter()
                ->values()
                ->all();

            if (! empty($accessibleTemplateIds)) {
                $query->whereNotIn('id', $accessibleTemplateIds);
            }
        }

        if ($search !== '' && !$templateId) {
            $query->where(function ($builder) use ($search) {
                $builder->where('template_name', 'like', "%{$search}%")
                    ->orWhere('short_description', 'like', "%{$search}%");
            });
        }

        $templates = $query->paginate(max(1, min($perPage, 50)), ['*'], 'page', max(1, $page));

        return [
            'status' => 1,
            'message' => 'Premium template options loaded successfully.',
            'data' => $templates->getCollection()->map(fn (ETemplate $template) => [
                'id' => $template->id,
                'template_name' => $template->template_name,
                'template_type' => TemplateTypes::fromValue($template->template_type ?? null)->value,
                'short_description' => $template->short_description,
                'price' => $template->price,
                'discounted_price' => $this->templatePrice($template),
                'image_url' => $template->image_url,
                'demo_preview_url' => $this->demoPreviewUrl((int) $template->id),
            ])->values()->all(),
            'meta' => [
                'current_page' => $templates->currentPage(),
                'last_page' => $templates->lastPage(),
                'total' => $templates->total(),
            ],
        ];
    }

    public function getPublicTemplatePreview(int $templateId): array
    {
        return Cache::remember("public_template_preview:{$templateId}", 60, function () use ($templateId) {
        $template = ETemplate::query()->find($templateId);
        if (! $template) {
            throw new HttpResponseException(response()->json([
                'status' => 0,
                'message' => 'Template not found.',
            ], 404));
        }

        $builder = $this->templateBuilderService->getBuilder($template);
        unset($builder['meta']);

        return [
            'status' => 1,
            'message' => 'Public ecommerce template preview loaded successfully.',
            'data' => [
                'template' => [
                    'id' => $template->id,
                    'template_name' => $template->template_name,
                    'primary_color' => $template->primary_color,
                    'secondary_color' => $template->secondary_color,
                    'font_family' => $template->font_family,
                    'short_description' => $template->short_description,
                    'template_type' => TemplateTypes::fromValue($template->template_type ?? null)->value,
                    'price' => $template->price,
                    'image_url' => $template->image_url,
                    'demo_preview_url' => $this->demoPreviewUrl((int) $template->id),
                    'categories' => collect($template->categories ?? [])
                        ->map(function ($category) {
                            if (! is_array($category)) {
                                return $category;
                            }

                            $name = trim((string) ($category['name'] ?? ''));

                            return [
                                ...$category,
                                'key' => $name !== '' ? Str::slug($name) : null,
                            ];
                        })
                        ->values()
                        ->all(),
                ],
                'builder' => $builder,
            ],
        ];
        });
    }

    public function getPublicTemplatePreviewByToken(string $token): array
    {
        try {
            $templateId = Crypt::decryptString($token);

            if (! ctype_digit($templateId) || (int) $templateId < 1) {
                throw new \RuntimeException('Invalid template preview token.');
            }
        } catch (\Throwable) {
            throw new HttpResponseException(response()->json([
                'status' => 0,
                'message' => 'Invalid template preview token.',
            ], 404));
        }

        return $this->getPublicTemplatePreview((int) $templateId);
    }

    public function applyTemplate(int $templateId, int $categoryId, ?bool $seedDemoData = null): array
    {
        $company = $this->resolveCompany();
        $wasSetupCompleted = ! empty($company->ecommerce_setup_completed_at);

        $template = ETemplate::query()->find($templateId);
        if (! $template) {
            throw new HttpResponseException(response()->json([
                'status' => 0,
                'message' => 'Selected template not found.',
            ], 404));
        }

        $isFreeTemplate = TemplateTypes::isFreeValue($template->template_type ?? null);
        $hasTemplateAccess = $isFreeTemplate || $company->eTemplateAccesses()
            ->where('template_id', $template->id)
            ->exists();
        if (! $hasTemplateAccess) {
            throw new HttpResponseException(response()->json([
                'status' => 0,
                'message' => 'Purchase this premium template before using it.',
            ], 403));
        }

        $category = ECategory::query()->where('status', true)->find($categoryId);
        if (! $category) {
            throw new HttpResponseException(response()->json([
                'status' => 0,
                'message' => 'Selected category not found.',
            ], 404));
        }

        $templateCategoryIds = collect($template->categories ?? [])
            ->pluck('id')
            ->filter(fn ($value) => is_numeric($value))
            ->map(fn ($value) => (int) $value)
            ->all();

        if (! empty($templateCategoryIds) && ! in_array($category->id, $templateCategoryIds, true)) {
            throw new HttpResponseException(response()->json([
                'status' => 0,
                'message' => 'This template is not tagged for the selected category.',
            ], 422));
        }

        // Update the selected template before materializing its builder. The
        // storefront builder uses the selected template to normalize preset
        // metadata; doing this in the opposite order leaves the previous
        // template active during the switch and can mix both templates'
        // sections in the company builder.
        $company->update([
            'selected_e_template_id' => $template->id,
            'ecommerce_category_id' => $category->id,
            'ecommerce_setup_completed_at' => now(),
        ]);

        $templateBuilder = $this->templateBuilderService->getBuilder($template);
        $storefrontBuilder = $this->transformTemplateBuilderForCompany($templateBuilder, $company->company_id, $template);
        // Template selection only needs the selected template/category in its
        // response. Avoid rebuilding the complete storefront payload here;
        // that payload is loaded separately by the builder screen.
        $this->storefrontHomeBuilderService->updateResponse($storefrontBuilder, false);

        if ($seedDemoData === true) {
            SyncCompanyDemoData::dispatchAfterResponse((int) $category->id, (string) $company->company_id);
        }

        if (! $wasSetupCompleted) {
            $recipientEmail = $this->resolveStoreOwnerEmail($company);

            if ($recipientEmail !== '') {
                SendStoreSetupCompletedEmail::dispatchAfterResponse(
                    $recipientEmail,
                    $this->resolveStoreOwnerName($company),
                    (string) $company->name,
                    $this->resolveAdminLoginUrl(),
                    (string) $template->template_name,
                    $company->saasPlan?->name,
                    $company->saasPlan?->billing_period,
                    $this->templatePlanPrice($company->saasPlan),
                    $this->resolveSetupPassword()
                );
            }
        }

        return [
            'status' => 1,
            'message' => 'Template applied successfully. You can now customize your storefront.',
            'data' => [
                'company' => [
                    'company_id' => $company->company_id,
                    'name' => $company->name,
                    'ecommerce_setup_completed_at' => optional($company->fresh()->ecommerce_setup_completed_at)->toDateTimeString(),
                    'selected_e_template_id' => $template->id,
                    'ecommerce_category_id' => $category->id,
                ],
                'template' => [
                    'id' => $template->id,
                    'template_name' => $template->template_name,
                    'primary_color' => $template->primary_color,
                    'secondary_color' => $template->secondary_color,
                    'font_family' => $template->font_family,
                    'short_description' => $template->short_description,
                    'price' => $template->price,
                    'image_url' => $template->image_url,
                ],
                'category' => [
                    'id' => $category->id,
                    'name' => $category->name,
                ],
            ],
        ];
    }

    private function resolveStoreOwnerEmail(Company $company): string
    {
        $userEmail = trim((string) ($company->user?->email ?? ''));
        if ($userEmail !== '') {
            return $userEmail;
        }

        return trim((string) ($company->email ?? ''));
    }

    private function resolveStoreOwnerName(Company $company): string
    {
        $user = $company->user;

        if ($user) {
            $name = trim((string) $user->first_name . ' ' . (string) ($user->last_name ?? ''));
            if ($name !== '') {
                return $name;
            }
        }

        return trim((string) ($company->contact_name ?? $company->name ?? '')) ?: (string) ($company->name ?? 'Store Owner');
    }

    private function resolveAdminLoginUrl(): string
    {
        $adminLoginUrl = trim((string) config('app.admin_login_url', ''));

        if ($adminLoginUrl !== '') {
            return rtrim($adminLoginUrl, '/');
        }

        $baseUrl = rtrim((string) config('app.frontend_url', config('app.url')), '/');

        return $baseUrl . '/login';
    }

    private function resolveSetupPassword(): ?string
    {
        $password = trim((string) request()->input('password', ''));

        if ($password !== '') {
            return $password;
        }

        $loginPassword = trim((string) request()->input('login_password', ''));
        if ($loginPassword !== '') {
            return $loginPassword;
        }

        return null;
    }

    private function transformTemplateBuilderForCompany(array $templateBuilder, string $companyId, ?ETemplate $template = null): array
    {
        $pageIdMap = [];
        $sectionIdMap = [];

        $pages = collect($templateBuilder['pages'] ?? [])->map(function (array $page, int $index) use (&$pageIdMap, $companyId) {
            $newId = $this->makeStorefrontBuilderId('page', $companyId, $index + 1);
            $pageIdMap[$page['id']] = $newId;

            return [
                ...$page,
                'id' => $newId,
            ];
        })->values()->all();

        $templateDefaultPageId = (string) ($templateBuilder['default_page_id'] ?? '');
        $defaultPageId = $templateDefaultPageId !== '' && isset($pageIdMap[$templateDefaultPageId])
            ? $pageIdMap[$templateDefaultPageId]
            : ($pages[0]['id'] ?? '');

        $sections = collect($templateBuilder['sections'] ?? [])->map(function (array $section, int $index) use (&$sectionIdMap, $pageIdMap, $companyId, $defaultPageId) {
            $newId = $this->makeStorefrontBuilderId('section', $companyId, $index + 1);
            $sectionIdMap[$section['id']] = $newId;
            $oldPageId = (string) ($section['page_id'] ?? '');

            return [
                ...$section,
                'id' => $newId,
                'page_id' => $oldPageId !== '' ? ($pageIdMap[$oldPageId] ?? '') : $defaultPageId,
            ];
        })->filter(fn (array $section) => $section['page_id'] !== '')->values()->all();

        $actions = collect($templateBuilder['actions'] ?? [])->map(function (array $action, int $index) use ($pageIdMap, $sectionIdMap, $companyId, $defaultPageId) {
            $newId = $this->makeStorefrontBuilderId('action', $companyId, $index + 1);
            $oldPageId = (string) ($action['page_id'] ?? '');

            return [
                ...$action,
                'id' => $newId,
                'page_id' => $oldPageId !== '' ? ($pageIdMap[$oldPageId] ?? '') : $defaultPageId,
                'section_id' => ! empty($action['section_id']) ? ($sectionIdMap[$action['section_id']] ?? '') : '',
                'target_page_id' => ! empty($action['target_page_id']) ? ($pageIdMap[$action['target_page_id']] ?? '') : '',
            ];
        })->filter(fn (array $action) => $action['page_id'] !== '')->values()->all();

        $meta = $this->filterTemplateMetaForCompany($templateBuilder['meta'] ?? [], $templateBuilder['sections'] ?? [], $template);

        return [
            'version' => 1,
            'default_page_id' => $defaultPageId,
            'pages' => $pages,
            'sections' => $sections,
            'actions' => $actions,
            'settings' => $templateBuilder['settings'] ?? [],
            'meta' => $meta,
        ];
    }

    private function filterTemplateMetaForCompany(array $meta, array $sections, ?ETemplate $template = null): array
    {
        $allowedKeys = collect($template?->section_preset_refs ?? [])
            ->pluck('preset_key')
            ->map(fn ($value) => trim((string) $value))
            ->filter()
            ->unique()
            ->values()
            ->all();

        if (empty($allowedKeys)) {
            $allowedKeys = collect($sections)
                ->filter(fn ($section) => is_array($section))
                ->pluck('preset_key')
                ->map(fn ($value) => trim((string) $value))
                ->filter()
                ->unique()
                ->values()
                ->all();
        }

        if (empty($allowedKeys)) {
            return $meta;
        }

        $allowedLookup = array_fill_keys(
            StorefrontCategorySectionCatalog::expandPresetKeys($allowedKeys),
            true
        );

        if (isset($meta['section_presets']) && is_array($meta['section_presets'])) {
            $meta['section_presets'] = collect($meta['section_presets'])
                ->map(function ($group) use ($allowedLookup) {
                    if (! is_array($group)) {
                        return [];
                    }

                    return collect($group)
                        ->filter(fn ($preset) => is_array($preset) && isset($allowedLookup[$preset['preset_key'] ?? '']))
                        ->values()
                        ->all();
                })
                ->filter(fn ($group) => ! empty($group))
                ->all();
        }

        if (isset($meta['category_preset_map']) && is_array($meta['category_preset_map'])) {
            $meta['category_preset_map'] = collect($meta['category_preset_map'])
                ->map(function ($groupMap) use ($allowedLookup) {
                    if (! is_array($groupMap)) {
                        return [];
                    }

                    return collect($groupMap)
                        ->map(function ($presetKeys) use ($allowedLookup) {
                            if (! is_array($presetKeys)) {
                                return [];
                            }

                            return array_values(array_filter(
                                array_map(fn ($presetKey) => (string) $presetKey, $presetKeys),
                                fn ($presetKey) => isset($allowedLookup[$presetKey])
                            ));
                        })
                        ->filter(fn ($presetKeys) => ! empty($presetKeys))
                        ->all();
                })
                ->filter(fn ($groupMap) => ! empty($groupMap))
                ->all();
        }

        return $meta;
    }

    private function makeStorefrontBuilderId(string $prefix, string $companyId, int $index): string
    {
        $compactPrefix = match ($prefix) {
            'page' => 'pg',
            'section' => 'sec',
            'action' => 'act',
            default => Str::slug($prefix),
        };

        $hash = substr(sha1($companyId . '|' . $prefix . '|' . $index . '|' . (string) Str::uuid()), 0, 24);

        return $compactPrefix . '-' . $index . '-' . $hash;
    }
}
