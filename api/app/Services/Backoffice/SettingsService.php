<?php

namespace App\Services\Backoffice;

use App\Constant\Directory;
use App\Models\Setting;
use App\Services\DynamicMailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;

class SettingsService
{
    public function __construct(private DynamicMailService $dynamicMailService) {}

    private const MAX_REFERRAL_LEVELS = 20;

    private const REMOVED_BASIC_FIELDS = [
        'google_map_api_key',
        'map_radius',
        'almost_full',
        'admin_vat',
    ];

    private const SETTING_KEYS = [
        'basic',
        'configurations',
        'email_configuration',
        'ecommerce_store',
        'referral_rules',
        'payout_settings',
        'extension',
        'seo',
        'social',
        'kyc',
        'cron',
    ];

    private function decodeSettingValue(?string $rawValue): array
    {
        if (! $rawValue) {
            return [];
        }

        $decoded = json_decode($rawValue, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function uploadImage(Request $request, string $fieldName, ?string $folder = null): ?string
    {
        if (! $request->hasFile($fieldName)) {
            return null;
        }

        $file = $request->file($fieldName);
        if (! $file || ! $file->isValid()) {
            return null;
        }

        return upload($file, (string) $folder);
    }

    private function settingRecord(string $key): ?Setting
    {
        return Setting::query()->where('key', $key)->first();
    }

    private function settingValue(string $key): array
    {
        $record = $this->settingRecord($key);

        return $this->decodeSettingValue($record?->getRawOriginal('value'));
    }

    private function filterRemovedBasicFields(array $settings): array
    {
        foreach (self::REMOVED_BASIC_FIELDS as $field) {
            unset($settings[$field]);
        }

        return $settings;
    }

    /**
     * @param array<string, mixed> $requestData
     * @return array<int, array{level:int, percentage:float}>
     */
    private function normalizeReferralLevels(array $requestData, int $maxLevels): array
    {
        $rows = [];
        $inputLevels = $requestData['levels'] ?? [];

        if (is_array($inputLevels) && $inputLevels !== []) {
            foreach ($inputLevels as $index => $row) {
                if (! is_array($row)) {
                    continue;
                }

                $level = (int) ($row['level'] ?? ($index + 1));
                if ($level < 1 || $level > $maxLevels) {
                    continue;
                }

                $rows[$level] = [
                    'level' => $level,
                    'percentage' => round((float) ($row['percentage'] ?? 0), 2),
                ];
            }
        }

        for ($level = 1; $level <= $maxLevels; $level++) {
            if (isset($rows[$level])) {
                continue;
            }

            $legacyKey = "level{$level}_percentage";
            $rows[$level] = [
                'level' => $level,
                'percentage' => round((float) ($requestData[$legacyKey] ?? 0), 2),
            ];
        }

        ksort($rows);

        return array_values($rows);
    }

    private function sections(): array
    {
        return [
            ['key' => 'basic', 'title' => 'Basic Settings'],
            ['key' => 'configurations', 'title' => 'Site Preference'],
            ['key' => 'email_configuration', 'title' => 'Email Configuration'],
            ['key' => 'ecommerce_store', 'title' => 'Ecommerce Store'],
            ['key' => 'referral_rules', 'title' => 'Referral Rules'],
            ['key' => 'payout_settings', 'title' => 'Payout Settings'],
            ['key' => 'extension', 'title' => 'Extension Settings'],
        ];
    }

    public function index()
    {
        return response()->json([
            'status' => 1,
            'message' => 'Settings sections fetched successfully.',
            'data' => $this->sections(),
        ], 200);
    }

    public function show(string $key)
    {
        if (! in_array($key, self::SETTING_KEYS, true)) {
            return response()->json([
                'status' => 0,
                'message' => 'Invalid settings section.',
            ], 404);
        }

        if ($key === 'cron') {
            $appUrl = rtrim(config('app.url') ?? url('/'), '/');

            return response()->json([
                'status' => 1,
                'message' => 'Cron settings fetched successfully.',
                'data' => [
                    'cron_event' => "curl -s {$appUrl}/event-expired",
                    'cron_queue' => "curl -s {$appUrl}/cron/run-queue",
                ],
            ], 200);
        }

        $data = $this->settingValue($key);

        if ($key === 'payout_settings') {
            $data = array_merge([
                'enabled' => 0,
                'minimum_amount' => 10,
                'maximum_amount' => null,
                'max_pending_requests' => 1,
                'methods' => ['Bank Transfer'],
                'instructions' => '',
            ], $data);
        }

        if ($key === 'basic') {
            $data = $this->filterRemovedBasicFields($data);
        }

        $imageFolders = [
            'white_logo' => Directory::LOGO_PATH,
            'dark_logo' => Directory::LOGO_PATH,
            'icon' => Directory::LOGO_PATH,
            'og_image' => Directory::SEO_PATH,
        ];

        foreach ($imageFolders as $imageField => $folder) {
            if (! empty($data[$imageField])) {
                $data[$imageField.'_url'] = get_file($data[$imageField], $folder);
            }
        }

        if ($key === 'kyc') {
            $data = array_values($data);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Settings fetched successfully.',
            'data' => $data,
        ], 200);
    }

    public function update(Request $request, string $key)
    {
        if (! in_array($key, self::SETTING_KEYS, true) || $key === 'cron') {
            return response()->json([
                'status' => 0,
                'message' => 'Invalid settings section.',
            ], 422);
        }

        $existing = $this->settingValue($key);
        $payload = [];

        if ($key === 'basic') {
            $existing = $this->filterRemovedBasicFields($existing);

            $validator = Validator::make($request->all(), [
                'sitename' => 'required|string',
                'currency' => 'required|string',
                'currency_symbol' => 'required|string',
                'base_color' => ['required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
                'timezone' => 'nullable|timezone',
                'pagination' => 'required|integer|min:1',
                'copyright' => 'required|string',
                'currency_format' => 'required|in:left,right,both',
                'precision' => 'required|integer|min:0',
                'white_logo' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg,webp|max:2048',
                'dark_logo' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg,webp|max:2048',
                'icon' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg,webp|max:2048',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ], 422);
            }

            $payload = $validator->validated();
            foreach (['white_logo', 'dark_logo', 'icon'] as $field) {
                $uploaded = $this->uploadImage($request, $field, 'logo');
                if ($uploaded) {
                    $payload[$field] = $uploaded;
                } else {
                    unset($payload[$field]);
                }
            }
        }

        if ($key === 'configurations') {
            $switches = [
                'email_notification',
                'sms_notification',
                'user_registration',
                'strong_password',
                'maintanance_mode',
                'language',
                'email_verification',
                'sms_verification',
                'kyc_enable',
                'push_notification',
            ];

            foreach ($switches as $switch) {
                $payload[$switch] = $request->has($switch) ? 1 : 0;
            }
        }

        if ($key === 'email_configuration') {
            $validator = Validator::make($request->all(), [
                'email_method' => 'required|in:php,smtp,sendgrid',
                'email_send_from' => 'required|email',
                'smtp_host' => 'nullable|string',
                'smtp_port' => 'nullable|numeric',
                'smtp_username' => 'nullable|string',
                'smtp_password' => 'nullable|string',
                'smtp_encryption' => 'nullable|in:ssl,tls',
                'sendgrid_api_key' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ], 422);
            }

            $payload = $validator->validated();

            if (($payload['email_method'] ?? 'php') === 'smtp') {
                $smtpValidator = Validator::make($request->all(), [
                    'smtp_host' => 'required|string',
                    'smtp_port' => 'required|numeric',
                    'smtp_username' => 'required|string',
                    'smtp_password' => 'required|string',
                    'smtp_encryption' => 'nullable|in:ssl,tls',
                ]);

                if ($smtpValidator->fails()) {
                    return response()->json([
                        'status' => 0,
                        'errors' => $smtpValidator->messages()->all(),
                    ], 422);
                }

                $payload = array_merge($payload, $smtpValidator->validated());
            }

            if (($payload['email_method'] ?? 'php') === 'sendgrid') {
                $sendgridValidator = Validator::make($request->all(), [
                    'sendgrid_api_key' => 'required|string',
                ]);

                if ($sendgridValidator->fails()) {
                    return response()->json([
                        'status' => 0,
                        'errors' => $sendgridValidator->messages()->all(),
                    ], 422);
                }

                $payload = array_merge($payload, $sendgridValidator->validated());
            }
        }

        if ($key === 'ecommerce_store') {
            $validator = Validator::make($request->all(), [
                'platform_store_domain' => 'required|string|max:255',
                'storefront_local_domain' => 'nullable|string|max:255',
                'store_link_example' => 'nullable|string|max:255',
                'subdomain_separator' => 'nullable|string|max:10',
                'default_store_protocol' => 'required|in:http,https',
                'reserved_subdomains' => 'nullable|string',
                'store_link_help_text' => 'nullable|string|max:500',
                'custom_domain_help_text' => 'nullable|string|max:500',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ], 422);
            }

            $payload = array_merge($validator->validated(), [
                'managed_subdomains_enabled' => $request->has('managed_subdomains_enabled') ? 1 : 0,
                'custom_domains_enabled' => $request->has('custom_domains_enabled') ? 1 : 0,
                'auto_generate_store_links' => $request->has('auto_generate_store_links') ? 1 : 0,
                'company_name_as_subdomain' => $request->has('company_name_as_subdomain') ? 1 : 0,
                'show_store_link_during_onboarding' => $request->has('show_store_link_during_onboarding') ? 1 : 0,
            ]);
        }

        if ($key === 'referral_rules') {
            $maxLevels = (int) $request->input('max_levels', 1);
            $dynamicLevelRules = [];
            for ($level = 1; $level <= max(1, $maxLevels); $level++) {
                $dynamicLevelRules["level{$level}_percentage"] = 'nullable|numeric|min:0|max:100';
            }

            $validator = Validator::make($request->all(), array_merge([
                'max_levels' => 'required|integer|min:1|max:' . self::MAX_REFERRAL_LEVELS,
                'signup_bonus' => 'required|numeric|min:0',
                'levels' => 'nullable|array',
                'levels.*.level' => 'required_with:levels|integer|min:1',
                'levels.*.percentage' => 'required_with:levels|numeric|min:0|max:100',
            ], $dynamicLevelRules));

            if ($validator->fails()) {
                return response()->json([
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ], 422);
            }

            $validated = $validator->validated();
            $maxLevels = (int) $validated['max_levels'];
            $levels = $this->normalizeReferralLevels($request->all(), $maxLevels);

            $payload = [
                'max_levels' => $maxLevels,
                'signup_bonus' => round((float) $validated['signup_bonus'], 2),
                'levels' => $levels,
            ];

            foreach ($levels as $row) {
                $payload['level' . $row['level'] . '_percentage'] = $row['percentage'];
            }
        }

        if ($key === 'payout_settings') {
            $validator = Validator::make($request->all(), [
                'minimum_amount' => 'required|numeric|min:0.01',
                'maximum_amount' => 'nullable|numeric|gte:minimum_amount',
                'max_pending_requests' => 'required|integer|min:1|max:20',
                'methods' => 'required|array|min:1',
                'methods.*' => 'required|string|max:64|distinct',
                'instructions' => 'nullable|string|max:1000',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ], 422);
            }

            $payload = array_merge($validator->validated(), [
                'enabled' => $request->boolean('enabled') ? 1 : 0,
                'minimum_amount' => round((float) $request->input('minimum_amount'), 2),
                'maximum_amount' => $request->filled('maximum_amount')
                    ? round((float) $request->input('maximum_amount'), 2)
                    : null,
                'methods' => array_values(array_unique(array_map('trim', $request->input('methods', [])))),
            ]);
        }

        if ($key === 'extension') {
            $validator = Validator::make($request->all(), [
                'pusher_app_key' => 'nullable|string',
                'pusher_app_cluster' => 'nullable|string',
                'pusher_app_id' => 'nullable|string',
                'pusher_app_secret' => 'nullable|string',
                'google_id' => 'nullable|string',
                'site_key' => 'nullable|string',
                'secret_key' => 'nullable|string',
                'tdio_url' => 'nullable|string',
                'ai_key' => 'nullable|string',
                'ai_generation_limit' => 'nullable|integer|min:0',
                'ai_max_text_length' => 'nullable|integer|min:0',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ], 422);
            }

            $payload = array_merge($validator->validated(), [
                'analytics_status' => $request->has('analytics_status') ? 1 : 0,
                'recaptcha_status' => $request->has('recaptcha_status') ? 1 : 0,
                'tdio_status' => $request->has('tdio_status') ? 1 : 0,
                'push_status' => $request->has('push_status') ? 1 : 0,
                'ai_status' => $request->has('ai_status') ? 1 : 0,
            ]);
        }

        if ($key === 'seo') {
            $validator = Validator::make($request->all(), [
                'seo_title' => 'required|string|max:70',
                'seo_description' => 'nullable|string|max:160',
                'seo_keywords' => 'nullable',
                'og_title' => 'nullable|string|max:70',
                'og_description' => 'nullable|string|max:160',
                'og_image' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg,webp|max:2048',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ], 422);
            }

            $payload = $validator->validated();
            $uploaded = $this->uploadImage($request, 'og_image');
            if ($uploaded) {
                $payload['og_image'] = $uploaded;
            } else {
                unset($payload['og_image']);
            }

            if (isset($payload['seo_keywords']) && is_string($payload['seo_keywords'])) {
                $payload['seo_keywords'] = array_values(array_filter(array_map('trim', explode(',', $payload['seo_keywords']))));
            }
        }

        if ($key === 'social') {
            $validator = Validator::make($request->all(), [
                'google_client_id' => 'nullable|string',
                'google_client_secret' => 'nullable|string',
                'google_callback_url' => 'nullable|url',
                'facebook_client_id' => 'nullable|string',
                'facebook_client_secret' => 'nullable|string',
                'facebook_callback_url' => 'nullable|url',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ], 422);
            }

            $payload = array_merge($validator->validated(), [
                'facebook_status' => $request->has('facebook_status') ? 1 : 0,
                'google_status' => $request->has('google_status') ? 1 : 0,
            ]);
        }

        if ($key === 'kyc') {
            $validator = Validator::make($request->all(), [
                'kyc_fields' => 'required|array|min:1',
                'kyc_fields.*.name' => 'required|string|max:100',
                'kyc_fields.*.label' => 'required|string|max:100',
                'kyc_fields.*.type' => 'required|in:text,file,textarea',
                'kyc_fields.*.is_required' => 'required|in:0,1,true,false',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ], 422);
            }

            $payload = collect($validator->validated()['kyc_fields'])
                ->map(function ($field) {
                    return [
                        'name' => $field['name'],
                        'label' => $field['label'],
                        'type' => $field['type'],
                        'is_required' => in_array((string) $field['is_required'], ['1', 'true'], true),
                    ];
                })
                ->values()
                ->all();
        }

        $merged = $key === 'kyc' ? $payload : ($key === 'referral_rules' ? $payload : array_merge($existing, $payload));

        Setting::query()->updateOrCreate(
            ['key' => $key],
            ['value' => $merged, 'is_active' => 1]
        );

        if ($key === 'basic') {
            Cache::forget('storefront:landing-settings:global');
            Cache::forget('storefront:landing-currencies:global');
            Cache::forget('storefront:landing-currencies-v2:global');
        }

        return response()->json([
            'status' => 1,
            'message' => ucfirst(str_replace('_', ' ', $key)).' updated successfully.',
            'data' => $merged,
        ], 200);
    }

    public function sendTestMail(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'receiver_email' => 'required|email',
            'subject' => 'required|string|max:255',
            'message' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $emailConfig = $this->settingValue('email_configuration');
        if (empty($emailConfig['email_method']) || empty($emailConfig['email_send_from'])) {
            return response()->json([
                'status' => 0,
                'message' => 'Please save email configuration first.',
            ], 422);
        }

        try {
            $sent = $this->dynamicMailService->sendHtml(
                (string) $request->input('receiver_email'),
                (string) $request->input('subject'),
                (string) $request->input('message')
            );

            if (! $sent) {
                throw new \RuntimeException('Failed to send test mail using configured email method.');
            }

            return response()->json([
                'status' => 1,
                'message' => 'Test mail sent successfully.',
            ], 200);
        } catch (\Throwable $exception) {
            return response()->json([
                'status' => 0,
                'message' => 'Unable to send test mail. Please verify your email configuration.',
                'error' => $exception->getMessage(),
            ], 422);
        }
    }
}
