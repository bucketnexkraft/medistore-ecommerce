<?php

namespace App\Services\Api;

use App\Data\FeaturePreference;
use App\Models\Company;
use App\Models\CompanyFeaturePreference;
use App\Models\Currency;
use App\Models\CustomOption;
use App\Models\DeliveryMode;
use App\Models\Location;
use App\Models\LocationHierarchy;
use App\Models\QualificationType;
use App\Models\Question;
use App\Models\Segmentation;
use App\Models\User;
use App\Models\Setting;
use App\Services\CompanySmsService;
use App\Services\CompanyPlanFeatureService;
use App\Services\ImageService;
use App\Services\Api\PathaoCourierService;
use App\Support\EcommerceCompanyContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class PreferanceService
{
    private const DEFAULT_CURRENCY_CODE = 'USD';
    private const PUBLIC_SETTING_KEYS = [
        'application_name',
        'application_phone',
        'application_email',
        'application_fax',
        'application_address',
        'about_us',
        'terms_and_conditions',
        'privacy_policy',
        'return_policy',
        'site_logo',
        'site_favicon',
        'site_color',
        'default_language',
        'default_timezone',
        'default_currency',
        'facebook_link',
        'twitter_link',
        'linkedin_link',
        'instagram_link',
        'youtube_link',
        'reg_number',
        'tin_number',
        'bin_number',
        'currency',
        'sitename',
        'basic',
        'white_logo',
        'dark_logo',
        'icon',
        'og_image',
    ];

    public function __construct(private readonly CompanyPlanFeatureService $companyPlanFeatureService)
    {
    }

    private function serializeSetting(Setting $setting): array
    {
        return [
            'id' => $setting->id,
            'key' => $setting->key,
            'value' => $this->normalizeSettingValue($setting),
            'is_active' => $setting->is_active ?? $setting->status ?? 1,
            'created_at' => $setting->created_at,
            'updated_at' => $setting->updated_at,
        ];
    }

    private function companyHasColumn(string $column): bool
    {
        return Schema::hasColumn('company', $column);
    }

    private function normalizeSettingValue(Setting $setting): mixed
    {
        $rawValue = $setting->getRawOriginal('value');

        if ($rawValue === null) {
            return null;
        }

        $imageKeys = ['site_logo', 'site_favicon', 'profile_picture', 'white_logo', 'dark_logo', 'icon'];
        if (in_array($setting->key, $imageKeys, true) && $rawValue !== '') {
            if (filter_var($rawValue, FILTER_VALIDATE_URL)) {
                return $rawValue;
            }

            return ImageService::url($rawValue, 'settings');
        }

        if (!is_string($rawValue)) {
            return $rawValue;
        }

        $trimmed = trim($rawValue);
        if ($trimmed === '') {
            return null;
        }

        $decoded = json_decode($trimmed, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            if (is_string($decoded)) {
                return $this->normalizeScalarInput($decoded);
            }

            return $decoded;
        }

        return $this->normalizeScalarInput($trimmed);
    }

    private function normalizeScalarInput(mixed $value): mixed
    {
        if (!is_string($value)) {
            return $value;
        }

        $value = trim($value);

        // Some clients send quoted values like "\"text\"" or "\"\"".
        if (strlen($value) >= 2 && $value[0] === '"' && $value[strlen($value) - 1] === '"') {
            $value = trim(substr($value, 1, -1));
        }

        return $value === '' ? null : $value;
    }

    private function normalizeJsonInput(mixed $value): mixed
    {
        if (!is_string($value)) {
            return $value;
        }

        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        $decoded = json_decode($trimmed, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            return $decoded;
        }

        return $value;
    }

    private function resolveDefaultCurrency(): ?Currency
    {
        $preferredCurrency = Currency::query()
            ->where('code', self::DEFAULT_CURRENCY_CODE)
            ->first();

        if ($preferredCurrency) {
            return $preferredCurrency;
        }

        return Currency::query()
            ->where('is_active', 1)
            ->orderBy('id')
            ->first();
    }

    public function preferences(Request $request)
    {
        $settings = Setting::query()
            ->whereIn('key', self::PUBLIC_SETTING_KEYS)
            ->get()
            ->mapWithKeys(fn (Setting $setting) => [
                $setting->key => $this->serializeSetting($setting),
            ]);

        $company = null;
        $authUser = Auth::guard('api')->user();
        $requestedCompanyId = trim((string) $request->input('companyId', ''));

        if ($requestedCompanyId !== '' && $authUser && ($authUser->company_id === $requestedCompanyId || $authUser->isSuperAdmin())) {
            $company = Company::find($requestedCompanyId);
        } elseif ($authUser && $authUser->company_id) {
            $company = Company::find($authUser->company_id);
        } else {
            $resolvedCompanyId = EcommerceCompanyContext::resolveCompanyIdForRequest($request)
                ?? EcommerceCompanyContext::currentCompanyId();

            if (is_string($resolvedCompanyId) && trim($resolvedCompanyId) !== '') {
                $company = Company::find(trim($resolvedCompanyId));
            }
        }

        if ($company) {
            $company->loadMissing([
                'saasPlan:id,name,plan_type,billing_period',
                'selectedETemplate:id,template_name',
            ]);

            $planExpiresAt = null;
            if ($company->plan_subscribed_at && $company->saasPlan && !$company->saasPlan->isCommissionBased()) {
                $planExpiresAt = match ($company->saasPlan->billing_period) {
                    'yearly' => $company->plan_subscribed_at->copy()->addYear(),
                    'monthly' => $company->plan_subscribed_at->copy()->addMonth(),
                    default => $company->plan_subscribed_at->copy()->addMonth(),
                };
            }

            $currency = $company->currency ?? $this->resolveDefaultCurrency();
            $canViewCompanySecrets = $authUser && (
                $authUser->isSuperAdmin()
                || (
                    (int) $authUser->role !== User::ECOMMERCE_USER_ROLE
                    && (string) $authUser->company_id === (string) $company->company_id
                )
            );

            $companyMappings = [
                'application_name' => $this->normalizeScalarInput($company->name),
                'application_email' => $this->normalizeScalarInput($company->email),
                'application_phone' => $this->normalizeScalarInput($company->phone_number),
                'application_fax' => $this->normalizeScalarInput($company->fax ?? null),
                'application_address' => $this->normalizeScalarInput($company->address),
                'currency' => $currency,
                'site_logo' => !empty($company->website_logo) ? ImageService::url($company->website_logo, 'settings') : null,
                'site_favicon' => !empty($company->site_favicon) ? ImageService::url($company->site_favicon, 'settings') : null,
                'site_color' => $this->companyHasColumn('site_color') ? $company->site_color : null,
                'about_us' => $this->normalizeScalarInput($company->about_us ?? null),
                'terms_and_conditions' => $this->normalizeScalarInput($company->terms_and_conditions ?? null),
                'privacy_policy' => $this->normalizeScalarInput($company->privacy_policy ?? null),
                'return_policy' => $this->normalizeScalarInput($company->return_policy ?? null),
                'site_url' => $this->normalizeScalarInput($company->site_url ?? null),
                'default_language' => $company->language_id ?? null,
                'default_timezone' => $company->default_timezone ?? null,
                'default_currency' => $company->currency_id ?? null,
                'facebook_link' => $this->normalizeScalarInput($company->facebook_link ?? null),
                'twitter_link' => $this->normalizeScalarInput($company->twitter_link ?? null),
                'linkedin_link' => $this->normalizeScalarInput($company->linkedin_link ?? null),
                'instagram_link' => $this->normalizeScalarInput($company->instagram_link ?? null),
                'youtube_link' => $this->normalizeScalarInput($company->youtube_link ?? null),
                'domain' => $this->normalizeScalarInput($company->domain ?? null),
                'chat_support_channel' => $this->normalizeScalarInput($company->chat_support_channel ?? null),
                'facebook_page_id' => $this->normalizeScalarInput($company->facebook_page_id ?? null),
                'whatsapp_number' => $this->normalizeScalarInput($company->whatsapp_number ?? null),
                'gtm_id' => $this->normalizeScalarInput($company->gtm_id ?? null),
                'facebook_pixel_id' => $this->normalizeScalarInput($company->facebook_pixel_id ?? null),
                'facebook_pixel_access_token' => $this->normalizeScalarInput($company->facebook_pixel_access_token ?? null),
                'facebook_test_event_id' => $this->normalizeScalarInput($company->facebook_test_event_id ?? null),
                'tiktok_pixel_id' => $this->normalizeScalarInput($company->tiktok_pixel_id ?? null),
                'tiktok_pixel_access_token' => $this->normalizeScalarInput($company->tiktok_pixel_access_token ?? null),
                'tiktok_test_event_code' => $this->normalizeScalarInput($company->tiktok_test_event_code ?? null),
                'social_auth_enabled' => (bool) ($company->social_auth_enabled ?? false),
                'social_auth_available' => $this->companyPlanFeatureService->isFeatureAllowedByPlan(
                    $company->company_id,
                    FeaturePreference::SOCIAL_AUTH->value
                ) && (bool) ($company->social_auth_enabled ?? false),
                'google_client_id' => $canViewCompanySecrets ? $this->normalizeScalarInput($company->google_client_id ?? null) : null,
                'google_client_secret' => $canViewCompanySecrets ? $this->normalizeScalarInput($company->google_client_secret ?? null) : null,
                'delivery_channel_settings' => $this->normalizeJsonInput($company->delivery_channel_settings ?? null),
                'delivery_charge_settings' => $this->normalizeJsonInput($company->delivery_charge_settings ?? null),
                'courier_settings' => $this->normalizeJsonInput($company->courier_settings ?? null),
                'sms_service_provider' => $this->normalizeScalarInput($company->sms_service_provider ?? null),
                'sms_api_key' => $this->normalizeScalarInput($company->sms_api_key ?? null),
                'sms_sender_id' => $this->normalizeScalarInput($company->sms_sender_id ?? null),
                  'sms_verify_phone_on_order' => (bool) ($company->sms_verify_phone_on_order ?? false),
                  'sms_template_settings' => $this->normalizeJsonInput($company->sms_template_settings ?? null),
                  'payment_gateway_settings' => $this->normalizeJsonInput($company->payment_gateway_settings ?? null),
                  'allow_guest_checkout' => (bool) ($this->companyHasColumn('allow_guest_checkout') ? ($company->allow_guest_checkout ?? false) : false),
                  'reg_number' => $this->normalizeScalarInput($company->reg_number ?? null),
                'tin_number' => $this->normalizeScalarInput($company->tin_number ?? null),
                'bin_number' => $this->normalizeScalarInput($company->bin_number ?? null),
                'push_status' => (bool) ($company->push_status ?? false),
                'stock_tracking_enabled' => (bool) ($company->stock_tracking_enabled ?? true),
                'pusher_app_key' => $this->normalizeScalarInput($company->pusher_app_key ?? null),
                'pusher_app_cluster' => $this->normalizeScalarInput($company->pusher_app_cluster ?? null),
                'pusher_app_id' => $this->normalizeScalarInput($company->pusher_app_id ?? null),
                'pusher_app_secret' => $this->normalizeScalarInput($company->pusher_app_secret ?? null),
                'active_plan' => $company->saasPlan?->name,
                'active_template' => $company->selectedETemplate?->template_name,
                'plan_expires_at' => $planExpiresAt?->toDateTimeString(),
            ];

            foreach ($companyMappings as $key => $value) {
                if (isset($settings[$key])) {
                    $settings->put($key, [
                        ...$settings->get($key),
                        'value' => $value,
                    ]);
                } else {
                    $settings->put($key, [
                        'id' => null,
                        'key' => $key,
                        'value' => $value,
                        'is_active' => 1,
                        'created_at' => null,
                        'updated_at' => null,
                    ]);
                }
            }
        } else {
            if (!isset($settings['currency'])) {
                $settings->put('currency', [
                    'id' => null,
                    'key' => 'currency',
                    'value' => $this->resolveDefaultCurrency(),
                    'is_active' => 1,
                    'created_at' => null,
                    'updated_at' => null,
                ]);
            }
        }

        $data = $settings->values();

        return response()->json([
            'status' => 1,
            'message' => 'Data retrieved successfully!',
            'data' => $data,
        ], 200);
    }

    public function updateCompanyPreferences(Request $request)
    {
        $user = auth()->user();

        if (!$user || !$user->company_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'No company associated with the user',
            ], 400);
        }

        $company = Company::find($user->company_id);
        if (!$company) {
            return response()->json([
                'status' => 'error',
                'message' => 'Company not found',
            ], 404);
        }

        $paymentGatewayFeatureAllowed = $this->companyPlanFeatureService->isFeatureAllowedByPlan(
            $company->company_id,
            FeaturePreference::PAYMENT_GATEWAY->value
        );

        $fieldMappings = [
            'application_name' => 'name',
            'application_phone' => 'phone_number',
            'application_email' => 'email',
            'application_fax' => 'fax',
            'application_address' => 'address',
            'default_language' => 'language_id',
            'application_reg_number' => 'reg_number',
            'application_tin_number' => 'tin_number',
            'application_bin_number' => 'bin_number',
            'currency' => 'currency_id',
            'facebook_link' => 'facebook_link',
            'twitter_link' => 'twitter_link',
            'instagram_link' => 'instagram_link',
            'linkedin_link' => 'linkedin_link',
            'youtube_link' => 'youtube_link',
            'chat_support_channel' => 'chat_support_channel',
            'facebook_page_id' => 'facebook_page_id',
            'whatsapp_number' => 'whatsapp_number',
            'gtm_id' => 'gtm_id',
            'facebook_pixel_id' => 'facebook_pixel_id',
            'facebook_pixel_access_token' => 'facebook_pixel_access_token',
            'facebook_test_event_id' => 'facebook_test_event_id',
            'tiktok_pixel_id' => 'tiktok_pixel_id',
            'tiktok_pixel_access_token' => 'tiktok_pixel_access_token',
            'tiktok_test_event_code' => 'tiktok_test_event_code',
            'delivery_channel_settings' => 'delivery_channel_settings',
            'delivery_charge_settings' => 'delivery_charge_settings',
            'courier_settings' => 'courier_settings',
            'sms_service_provider' => 'sms_service_provider',
            'sms_api_key' => 'sms_api_key',
            'sms_sender_id' => 'sms_sender_id',
             'sms_verify_phone_on_order' => 'sms_verify_phone_on_order',
             'sms_template_settings' => 'sms_template_settings',
             'payment_gateway_settings' => 'payment_gateway_settings',
             'about_us' => 'about_us',
            'terms_and_conditions' => 'terms_and_conditions',
            'privacy_policy' => 'privacy_policy',
            'return_policy' => 'return_policy',
            'push_status' => 'push_status',
            'stock_tracking_enabled' => 'stock_tracking_enabled',
            'pusher_app_key' => 'pusher_app_key',
            'pusher_app_cluster' => 'pusher_app_cluster',
            'pusher_app_id' => 'pusher_app_id',
            'pusher_app_secret' => 'pusher_app_secret',
            'google_client_id' => 'google_client_id',
            'google_client_secret' => 'google_client_secret',
            'site_logo' => 'website_logo',
            'site_favicon' => 'site_favicon',
        ];

          if ($this->companyHasColumn('site_color')) {
              $fieldMappings['site_color'] = 'site_color';
          }

          if ($this->companyHasColumn('allow_guest_checkout')) {
              $fieldMappings['allow_guest_checkout'] = 'allow_guest_checkout';
          }

        $updateData = [];

        foreach ($request->allFiles() as $key => $file) {
            if (isset($fieldMappings[$key]) && $file->isValid()) {
                $request->validate([
                    $key => 'required|image|mimes:jpeg,png,jpg,gif,svg|max:2048',
                ]);

                $updateData[$fieldMappings[$key]] = ImageService::upload($file, 'settings', [
                    'extensions' => ['jpg', 'jpeg', 'png', 'gif', 'svg'],
                    'mime_types' => ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'],
                    'max_kb' => 2048,
                    'field' => $key,
                ]);
            }
        }

        $inputFields = $request->except(array_keys($request->allFiles()));
        foreach ($inputFields as $key => $val) {
            if ($key === 'social_auth_enabled') {
                $request->validate([
                    $key => 'nullable|boolean',
                ]);

                $enabled = filter_var($val, FILTER_VALIDATE_BOOLEAN);
                $company->social_auth_enabled = $enabled;
                $company->save();
                CompanyFeaturePreference::query()->updateOrCreate(
                    [
                        'company_id' => $company->company_id,
                        'feature' => FeaturePreference::SOCIAL_AUTH->value,
                    ],
                    [
                        'active' => $enabled,
                    ]
                );
                $responseData[$key] = $enabled;
                continue;
            }

            if (isset($fieldMappings[$key])) {
                $val = $this->normalizeScalarInput($val);

                $validationRules = 'nullable|string';
                if (in_array($key, ['application_email'])) {
                    $validationRules = 'nullable|email';
                } elseif (in_array($key, ['currency', 'default_language'])) {
                    $validationRules = 'nullable|integer';
                } elseif (in_array($key, ['facebook_link', 'twitter_link', 'instagram_link', 'linkedin_link', 'youtube_link'])) {
                    $validationRules = 'nullable|url';
                } elseif ($key === 'chat_support_channel') {
                    $validationRules = 'nullable|in:facebook,whatsapp';
                } elseif ($key === 'allow_guest_checkout') {
                    $validationRules = 'nullable|boolean';
                } elseif (in_array($key, ['google_client_id', 'google_client_secret'], true)) {
                    $validationRules = 'nullable|string';
                }

                $request->validate([
                    $key => $validationRules,
                ]);

                if ($key === 'default_language') {
                    $request->validate([
                        $key => 'nullable|integer|exists:languages,id',
                    ]);
                }

                if ($key === 'push_status') {
                    $updateData[$fieldMappings[$key]] = filter_var($val, FILTER_VALIDATE_BOOLEAN);
                } elseif ($key === 'sms_verify_phone_on_order') {
                    $updateData[$fieldMappings[$key]] = filter_var($val, FILTER_VALIDATE_BOOLEAN);
                } elseif ($key === 'allow_guest_checkout') {
                    $updateData[$fieldMappings[$key]] = filter_var($val, FILTER_VALIDATE_BOOLEAN);
                } elseif ($key === 'stock_tracking_enabled') {
                    $updateData[$fieldMappings[$key]] = filter_var($val, FILTER_VALIDATE_BOOLEAN);
                } elseif ($key === 'payment_gateway_settings' && !$paymentGatewayFeatureAllowed) {
                    continue;
                } elseif (in_array($key, ['delivery_channel_settings', 'delivery_charge_settings', 'courier_settings', 'sms_template_settings', 'payment_gateway_settings'], true)) {
                    $updateData[$fieldMappings[$key]] = $this->normalizeJsonInput($val);
                } elseif (is_array($val)) {
                    $updateData[$fieldMappings[$key]] = implode(',', $val);
                } else {
                    $updateData[$fieldMappings[$key]] = $val;
                }
            }
        }

        $responseData = [];
        $company->update($updateData);

        Cache::forget(sprintf('storefront:%s:%s', 'landing-preferences', $company->company_id ?: 'global'));
        Cache::forget(sprintf('storefront:%s:%s', 'landing-social-auth', $company->company_id ?: 'global'));
        Cache::forget(sprintf('storefront:%s:%s', 'landing-currencies-v3', $company->company_id ?: 'global'));

        foreach ($fieldMappings as $originalKey => $companyField) {
            if (array_key_exists($companyField, $updateData)) {
                $responseData[$originalKey] = $updateData[$companyField];
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Company preferences successfully updated',
            'data' => $responseData,
        ], 200);
    }

    public function sendTestSms(Request $request)
    {
        $user = auth()->user();

        if (! $user || ! $user->company_id) {
            return response()->json([
                'status' => 0,
                'message' => 'No company associated with the user.',
            ], 400);
        }

        $validated = $request->validate([
            'phone' => 'required|string|max:30',
            'message' => 'nullable|string|max:1000',
        ]);

        $company = Company::query()->find($user->company_id);

        if (! $company) {
            return response()->json([
                'status' => 0,
                'message' => 'Company not found.',
            ], 404);
        }

        $defaultMessage = sprintf(
            'Test SMS from %s. Your SMS gateway setup is working.',
            trim((string) ($company->name ?: 'your shop'))
        );

        $sent = app(CompanySmsService::class)->sendMessage(
            $company,
            (string) $validated['phone'],
            trim((string) ($validated['message'] ?? '')) ?: $defaultMessage,
            [
                'event' => 'test_sms',
                'company_id' => (string) $company->getKey(),
                'requested_by' => (string) $user->getKey(),
            ]
        );

        if (! $sent) {
            return response()->json([
                'status' => 0,
                'message' => 'Test SMS could not be sent. Please verify API key, sender ID, and recipient number.',
            ], 422);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Test SMS sent successfully.',
        ]);
    }

    public function sendTestPathaoCourier(Request $request)
    {
        $user = auth()->user();

        if (! $user || ! $user->company_id) {
            return response()->json([
                'status' => 0,
                'message' => 'No company associated with the user.',
            ], 400);
        }

        $validated = $request->validate([
            'pathao' => 'nullable|array',
            'pathao.base_url' => 'nullable|string|max:255',
            'pathao.client_id' => 'nullable|string|max:255',
            'pathao.client_secret' => 'nullable|string|max:255',
            'pathao.username' => 'nullable|string|max:255',
            'pathao.password' => 'nullable|string|max:255',
            'pathao.grant_type' => 'nullable|string|max:50',
        ]);

        $company = Company::query()->find($user->company_id);

        if (! $company) {
            return response()->json([
                'status' => 0,
                'message' => 'Company not found.',
            ], 404);
        }

        try {
            $result = app(PathaoCourierService::class)->testConnection($company, $validated['pathao'] ?? null);

            $pathaoData = is_array($result['data'] ?? null) ? $result['data'] : [];
            $currentCourierSettings = is_array($company->courier_settings ?? null) ? $company->courier_settings : [];
            $currentPathaoSettings = is_array($currentCourierSettings['pathao'] ?? null) ? $currentCourierSettings['pathao'] : [];

            $company->courier_settings = [
                ...$currentCourierSettings,
                'pathao' => [
                    ...$currentPathaoSettings,
                    ...($validated['pathao'] ?? []),
                    'access_token' => $pathaoData['access_token'] ?? ($currentPathaoSettings['access_token'] ?? null),
                    'token_type' => $pathaoData['token_type'] ?? ($currentPathaoSettings['token_type'] ?? null),
                    'expires_in' => $pathaoData['expires_in'] ?? ($currentPathaoSettings['expires_in'] ?? null),
                    'merchant_identifier' => $pathaoData['merchant_identifier'] ?? ($currentPathaoSettings['merchant_identifier'] ?? null),
                ],
            ];

            $company->save();
        } catch (\Throwable $exception) {
            return response()->json([
                'status' => 0,
                'message' => $exception->getMessage() ?: 'Pathao courier connection could not be verified.',
            ], 422);
        }

        return response()->json($result);
    }

    public function updatePreferences(Request $request)
    {
        $data = [];

        foreach ($request->all() as $key => $val) {
            if ($request->hasFile($key)) {
                $request->validate([
                    $key => 'required|image|mimes:jpeg,png,jpg,gif,svg,webp|max:2048',
                ]);

                $data[$key] = ImageService::upload($request->file($key), 'settings', [
                    'extensions' => ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'],
                    'mime_types' => ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'],
                    'max_kb' => 2048,
                    'field' => $key,
                ]);
            }
        }

        $nonFileKeys = array_keys($request->files->all());
        $inputFields = $request->except(array_merge(['_token'], $nonFileKeys));
        foreach ($inputFields as $key => $val) {
            if (!is_array($val)) {
                $request->validate([
                    $key => 'nullable|string',
                ]);
                $data[$key] = $val;
            } else {
                $data[$key] = implode(',', $val);
            }
        }

        foreach ($data as $key => $val) {
            Setting::updateOrCreate(
                ['key' => $key],
                ['value' => $val]
            );
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Settings successfully updated',
            'data' => $data,
        ]);
    }

    public function customData()
    {
        $types = CustomOption::where('option_for', 'exam')->where('type', 'question type')->get();
        $difficulty_level = CustomOption::where('option_for', 'exam')->where('type', 'difficulty level')->get();
        $exam_purpose = CustomOption::where('option_for', 'exam')->where('type', 'exam purpose')->get();
        $media_type = CustomOption::where('option_for', 'exam')->where('type', 'media type')->get();
        $segmentation = Segmentation::where('status', 1)->get();
        $questions = Question::with('options')->where('status', 1)->get();
        $qualification_types = QualificationType::where('status', 1)->get();
        $course_delivery_modes = DeliveryMode::where('status', 1)->get();
        $data = [
            'question_type' => $types,
            'difficulty_level' => $difficulty_level,
            'exam_purpose' => $exam_purpose,
            'media_type' => $media_type,
            'segmentation' => $segmentation,
            'questions' => $questions,
            'qualification_types' => $qualification_types,
            'course_delivery_modes' => $course_delivery_modes,
        ];
        return response()->json([
            'status' => 1,
            'message' => 'Data retrive successful!',
            'data' => $data,
        ], 200);
    }

    public function getCompanyPreferences()
    {
        $user = Auth::guard('api')->user();

        if (!$user) {
            return response()->json([
                'status' => 0,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if (!$user->company_id) {
            return response()->json([
                'status' => 0,
                'message' => 'No company associated with the user.',
            ], 404);
        }

        $company = Company::find($user->company_id);
        if (!$company) {
            return response()->json([
                'status' => 0,
                'message' => 'Company not found.',
            ], 404);
        }

        $reword = $company->rewordSetup;

        $data = [
            'company' => [
                'company_id' => $company->company_id,
                'name' => $company->name,
                'email' => $company->email,
                'phone_number' => $company->phone_number,
                'address' => $company->address,
                'website_logo' => $company->website_logo,
                'site_favicon' => $company->site_favicon,
                'site_color' => $this->companyHasColumn('site_color') ? $company->site_color : null,
                'currency_id' => $company->currency_id,
                  'language_id' => $company->language_id,
                  'default_timezone' => $company->default_timezone,
                  'allow_guest_checkout' => (bool) ($this->companyHasColumn('allow_guest_checkout') ? ($company->allow_guest_checkout ?? false) : false),
                  'push_status' => (bool) ($company->push_status ?? false),
                'pusher_app_key' => $company->pusher_app_key,
                'pusher_app_cluster' => $company->pusher_app_cluster,
                'pusher_app_id' => $company->pusher_app_id,
                'pusher_app_secret' => $company->pusher_app_secret,
            ],
            'reword' => $reword,
        ];
        return response()->json([
            'status' => 1,
            'message' => 'Company preferences retrieved successfully',
            'data' => $data,
        ]);
    }

    public function getCurrency()
    {
        $currency = Currency::query()
            ->where('is_active', 1)
            ->orderByRaw("CASE WHEN UPPER(code) = ? THEN 0 ELSE 1 END", [self::DEFAULT_CURRENCY_CODE])
            ->orderBy('id')
            ->get();

        if ($currency->isEmpty()) {
            return response()->json([
                'status' => 0,
                'message' => 'Currency not found',
            ], 404);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Currency retrieved successfully',
            'data' => $currency,
        ]);
    }

    public function geoLocations()
    {
        $divisionId = trim((string) request()->query('division_id', ''));
        $districtId = trim((string) request()->query('district_id', ''));
        $include = strtolower(trim((string) request()->query('include', 'all')));
        $includeAll = $include === 'all';

        try {
            $divisionHierarchy = LocationHierarchy::query()
                ->where('status', true)
                ->where('slug', 'division')
                ->first();
            $districtHierarchy = LocationHierarchy::query()
                ->where('status', true)
                ->where('slug', 'district')
                ->first();
            $upazilaHierarchy = LocationHierarchy::query()
                ->where('status', true)
                ->where(function ($query) {
                    $query->whereIn('slug', ['upazila-thana', 'upazilathana'])
                        ->orWhere('name', 'Upazila/Thana');
                })
                ->first();

            if (! $divisionHierarchy || ! $districtHierarchy || ! $upazilaHierarchy) {
                throw new \RuntimeException('Division, district, or upazila/thana hierarchy is not configured.');
            }

            $divisions = $includeAll || $include === 'divisions'
                ? $this->localLocationOptions((int) $divisionHierarchy->id, null, 'division')
                : [];
            $districts = $includeAll || $include === 'districts'
                ? $this->localLocationOptions(
                    (int) $districtHierarchy->id,
                    $divisionId !== '' ? (int) $divisionId : null,
                    'district'
                )
                : [];
            $upazilas = $includeAll || $include === 'upazilas'
                ? $this->localLocationOptions(
                    (int) $upazilaHierarchy->id,
                    $districtId !== '' ? (int) $districtId : null,
                    'upazila'
                )
                : [];

            return response()->json([
                'status' => 1,
                'message' => 'Locations retrieved from the local location tables.',
                'data' => [
                    'divisions' => $divisions,
                    'districts' => $districts,
                    'upazilas' => $upazilas,
                ],
            ], 200);
        } catch (\Throwable $exception) {
            Log::warning('Failed to fetch Bangladesh geo locations', [
                'division_id' => $divisionId !== '' ? $divisionId : null,
                'district_id' => $districtId !== '' ? $districtId : null,
                'message' => $exception->getMessage(),
            ]);

            return response()->json([
                'status' => 0,
                'message' => $exception->getMessage() ?: 'Failed to load local locations.',
                'data' => [
                    'divisions' => [],
                    'districts' => [],
                    'upazilas' => [],
                ],
            ], 502);
        }
    }

    private function localLocationOptions(int $hierarchyId, ?int $parentId, string $type): array
    {
        $cacheKey = sprintf('landing:geo:%s:%s:%s', $type, $hierarchyId, $parentId ?? 'all');

        return Cache::remember($cacheKey, now()->addMinutes(30), function () use ($hierarchyId, $parentId, $type) {
            return Location::query()
                ->where('location_hierarchy_id', $hierarchyId)
                ->where('status', true)
                ->when($parentId !== null, fn ($query) => $query->where('parent_id', $parentId))
                ->orderBy('name')
                ->get(['id', 'name', 'parent_id', 'meta'])
                ->map(function (Location $location) use ($type) {
                    $meta = is_array($location->meta) ? $location->meta : [];

                    return [
                        'id' => (string) $location->id,
                        'name' => (string) $location->name,
                        'name_bn' => filled($meta['name_bn'] ?? null) ? (string) $meta['name_bn'] : null,
                        'division_id' => $type === 'district' ? (string) $location->parent_id : null,
                        'district_id' => $type === 'upazila' ? (string) $location->parent_id : null,
                    ];
                })
                ->values()
                ->all();
        });
    }
}
