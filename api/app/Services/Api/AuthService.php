<?php

namespace App\Services\Api;

use App\Data\FeaturePreference;
use App\Jobs\SendTemplatedEmail;
use App\Models\Company;
use App\Models\CompanyFeaturePreference;
use App\Models\PosSetting;
use App\Models\User;
use App\Notifications\BackofficeCompanyRegistered;
use App\Services\Api\ReferralService;
use App\Services\CompanyPlanFeatureService;
use App\Services\BackofficeCompanyService;
use App\Services\CompanySmsService;
use App\Services\DynamicMailService;
use App\Services\ImageService;
use App\Support\EcommerceCompanyContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Tymon\JWTAuth\Exceptions\JWTException;
use Tymon\JWTAuth\Exceptions\TokenExpiredException;
use Tymon\JWTAuth\Exceptions\TokenInvalidException;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthService
{
    private int $passwordResetExpiryMinutes = 15;
    private int $socialAuthStateExpiryMinutes = 10;
    private int $adminTransferExpiryMinutes = 2;
    public function __construct(
        private readonly DynamicMailService $dynamicMailService,
        private readonly CompanyPlanFeatureService $companyPlanFeatureService,
        private readonly BackofficeCompanyService $backofficeCompanyService
    )
    {
    }

    private function resolvePlanAccess(?User $user, ?Company $company): array
    {
        $plan = $company?->saasPlan;
        $hasPlanSelection = !empty($company?->saas_plan_id) && !empty($plan);
        $hasPlanActivation = $hasPlanSelection
            && !empty($company?->plan_subscribed_at)
            && (bool) ($plan?->status ?? false);
        $hasActivePlan = !$user?->isSuperAdmin() ? $hasPlanActivation : true;
        $needsPlanSelection = !$user?->isSuperAdmin() && !empty($user?->company_id) && !$hasActivePlan;
        $needsEcommerceSetup = $hasActivePlan
            && !$user?->isSuperAdmin()
            && !empty($user?->company_id)
            && (
                empty($company?->selected_e_template_id)
                || empty($company?->ecommerce_category_id)
            );
        $needsDomainSetup = $hasActivePlan
            && !$needsEcommerceSetup
            && !$user?->isSuperAdmin()
            && !empty($user?->company_id)
            && empty($company?->domain);

        $nextStep = $needsPlanSelection
            ? 'plan'
            : ($needsEcommerceSetup ? 'template' : ($needsDomainSetup ? 'domain' : 'complete'));
        $nextStepUrl = match ($nextStep) {
            'plan' => '/pricing',
            'template' => '/store',
            'domain' => '/domain',
            default => null,
        };

        return [
            'has_active_plan' => $hasActivePlan,
            'needs_plan_selection' => $needsPlanSelection,
            'needs_ecommerce_setup' => $needsEcommerceSetup,
            'needs_domain_setup' => $needsDomainSetup,
            'next_step' => $nextStep,
            'next_step_url' => $nextStepUrl,
        ];
    }

    private function buildAuthResponse(User $user, string $token, string $message = 'Login successful!')
    {
        $user->loadMissing(['currentCompany.saasPlan']);
        $company = $user->currentCompany;
        $isEcommerceUser = (int) $user->role === User::ECOMMERCE_USER_ROLE;

        if ($company && !$user->isSuperAdmin() && !$isEcommerceUser) {
            $this->backofficeCompanyService->ensureCompanyAccessBootstrap($company, $user, 'Administrator');
            $this->companyPlanFeatureService->syncCompanyPreferencesToPlan($company->fresh('saasPlan'));
            $user->unsetRelation('roles');
            $user->unsetRelation('currentCompany');
            $user->load(['roles', 'currentCompany.saasPlan']);
            $company = $user->currentCompany;
        } else {
            $user->loadMissing('roles');
        }

        $planAccess = $this->resolvePlanAccess($user, $company);

        $resolvedRights = $this->backofficeCompanyService->resolveRightsForUser($user);

        return response()->json([
            'status' => 1,
            'message' => $message,
            'token' => $token,
            'user' => $user,
            'role_name' => $user->resolveRoleName(),
            'rights' => $resolvedRights,
            'has_active_plan' => $planAccess['has_active_plan'],
            'needs_plan_selection' => $planAccess['needs_plan_selection'],
            'selected_plan_id' => $planAccess['has_active_plan'] ? $company?->saas_plan_id : null,
            'selected_plan' => $planAccess['has_active_plan'] ? $company?->saasPlan : null,
            'selected_plan_features' => $planAccess['has_active_plan'] ? ($company?->saasPlan?->effectiveFeatures() ?? []) : [],
            'active_feature_codes' => $planAccess['has_active_plan'] ? $this->companyPlanFeatureService->effectiveFeatureCodes($company?->company_id) : [],
            'needs_ecommerce_setup' => $planAccess['needs_ecommerce_setup'],
            'needs_domain_setup' => $planAccess['needs_domain_setup'],
            'next_step' => $planAccess['next_step'],
            'next_step_url' => $planAccess['next_step_url'],
            'selected_e_template_id' => $company?->selected_e_template_id,
            'ecommerce_setup_completed_at' => optional($company?->ecommerce_setup_completed_at)->toDateTimeString(),
            'redirect_to' => $user->role == 1 ? 'admin.index' : 'home',
        ], 200);
    }

    private function inactiveCompanyResponse()
    {
        return response()->json([
            'status' => 0,
            'errors' => [
                'company' => ['Your company account is inactive. Please contact the administrator.'],
            ],
        ], 403);
    }

    private function phoneLoginCandidates(string $identifier): array
    {
        $normalized = preg_replace('/[^\d+]/', '', trim($identifier));
        $digits = preg_replace('/\D/', '', $normalized);
        $candidates = array_filter([$identifier, $normalized, $digits]);

        if (str_starts_with($digits, '8801') && strlen($digits) === 13) {
            $local = '0' . substr($digits, 3);
            $candidates[] = $local;
            $candidates[] = $digits;
            $candidates[] = '+' . $digits;
        } elseif (str_starts_with($digits, '01') && strlen($digits) === 11) {
            $international = '880' . substr($digits, 1);
            $candidates[] = $international;
            $candidates[] = '+' . $international;
        } elseif (str_starts_with($digits, '1') && strlen($digits) === 10) {
            $local = '0' . $digits;
            $international = '880' . $digits;
            $candidates[] = $local;
            $candidates[] = $international;
            $candidates[] = '+' . $international;
        }

        return array_values(array_unique(array_filter($candidates)));
    }

    private function inferCompanyNameFromRegistration(Request $request): string
    {
        $explicitCompanyName = trim((string) $request->input('company_name', ''));
        if ($explicitCompanyName !== '') {
            return $explicitCompanyName;
        }

        $firstName = trim((string) $request->input('first_name', ''));
        $lastName = trim((string) $request->input('last_name', ''));
        $fullName = trim(preg_replace('/\s+/', ' ', "{$firstName} {$lastName}"));

        if ($fullName !== '') {
            return "{$fullName}'s Company";
        }

        $email = trim((string) $request->input('email', ''));
        $emailHandle = trim((string) Str::before($email, '@'));

        if ($emailHandle !== '') {
            return Str::title(str_replace(['.', '_', '-'], ' ', $emailHandle)) . "'s Company";
        }

        return 'New Company';
    }

    private function frontendSigninUrl(): string
    {
        return rtrim((string) config('app.frontend_url', config('app.url') . ':5173'), '/')
            . '/signin';
    }

    private function googleStateCacheKey(string $state): string
    {
        return 'google-social-auth:' . $state;
    }

    private function resolveGoogleCredentials(?string $companyId): array
    {
        $company = null;

        if (is_string($companyId) && trim($companyId) !== '') {
            $company = Company::withoutGlobalScopes()->find(trim($companyId));
        }

        $redirectUri = trim((string) config('services.google.redirect'));
        $companyClientId = trim((string) ($company?->google_client_id ?? ''));
        $companyClientSecret = trim((string) ($company?->google_client_secret ?? ''));

        if ($companyClientId !== '' && $companyClientSecret !== '' && $redirectUri !== '') {
            return [
                'client_id' => $companyClientId,
                'client_secret' => $companyClientSecret,
                'redirect_uri' => $redirectUri,
            ];
        }

        return [
            'client_id' => trim((string) config('services.google.client_id')),
            'client_secret' => trim((string) config('services.google.client_secret')),
            'redirect_uri' => $redirectUri,
        ];
    }

    private function resolveCompanyIdFromHost(?string $host): ?string
    {
        $normalizedHost = strtolower(trim((string) $host));

        if ($normalizedHost === '') {
            return null;
        }

        $normalizedHost = preg_replace('#^https?://#', '', $normalizedHost);
        $normalizedHost = preg_replace('#/.*$#', '', $normalizedHost);
        $normalizedHost = preg_replace('#:\d+$#', '', $normalizedHost);
        $normalizedHost = preg_replace('#^www\.#', '', $normalizedHost);

        if ($normalizedHost === '') {
            return null;
        }

        return Company::withoutGlobalScopes()
            ->whereRaw(
                "
                LOWER(
                    TRIM(
                        BOTH '/' FROM
                        REGEXP_REPLACE(
                            REGEXP_REPLACE(
                                REGEXP_REPLACE(domain, '^https?://', ''),
                                '^www\\.',
                                ''
                            ),
                            ':[0-9]+$',
                            ''
                        )
                    )
                ) = ?
            ",
                [$normalizedHost]
            )
            ->value('company_id');
    }

    private function isSocialAuthEnabledForCompany(?string $companyId): bool
    {
        if (!$companyId) {
            return false;
        }

        $company = Company::query()->find($companyId);

        if (!$company || !$company->social_auth_enabled) {
            return false;
        }

        return $this->companyPlanFeatureService->isFeatureAllowedByPlan(
            $companyId,
            FeaturePreference::SOCIAL_AUTH->value
        );
    }

    private function googleFallbackPhone(string $googleId, string $email): string
    {
        $base = substr(hash('sha1', $googleId !== '' ? $googleId : $email), 0, 18);

        return 'g-' . $base;
    }

    private function buildRedirectUrl(string $baseUrl, array $query = []): string
    {
        $normalizedBase = rtrim($baseUrl, '?&');

        if ($query === []) {
            return $normalizedBase;
        }

        $separator = str_contains($normalizedBase, '?') ? '&' : '?';

        return $normalizedBase . $separator . http_build_query($query);
    }

    private function socialAuthFailureRedirect(array $statePayload, string $message): \Illuminate\Http\RedirectResponse
    {
        $returnUrl = (string) ($statePayload['return_url'] ?? $this->frontendSigninUrl());

        return redirect()->away($this->buildRedirectUrl($returnUrl, [
            'auth_error' => $message,
        ]));
    }

    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'identifier' => 'required',
            'password' => 'required',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $identifier = $request->input('identifier');
        $credentials = [
            'password' => $request->input('password'),
        ];
        $isEmailLogin = filter_var($identifier, FILTER_VALIDATE_EMAIL);
        $phoneCandidates = $this->phoneLoginCandidates((string) $identifier);
        $phoneDigitCandidates = array_values(array_unique(array_filter(array_map(
            fn ($value) => preg_replace('/\D/', '', (string) $value),
            $phoneCandidates,
        ))));
        $normalizedPhoneColumn = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '')";

        if ($isEmailLogin) {
            $credentials['email'] = $identifier;
        } else {
            $credentials['phone'] = $identifier;
        }

        $user = User::query()
            ->when(
                $isEmailLogin,
                fn ($query) => $query->where('email', $identifier),
                fn ($query) => $query->where(function ($phoneQuery) use ($phoneCandidates, $phoneDigitCandidates, $normalizedPhoneColumn) {
                    $phoneQuery->whereIn('phone', $phoneCandidates);

                    if (!empty($phoneDigitCandidates)) {
                        $phoneQuery->orWhereIn(DB::raw($normalizedPhoneColumn), $phoneDigitCandidates);
                    }
                })
            )
            ->first();

        if (!$user) {
            return response()->json([
                'status' => 0,
                'errors' => [
                    'credentials' => ['Invalid credentials.'],
                ],
            ], 401);
        }

        if ($user->status != 1) {
            return response()->json([
                'status' => 0,
                'errors' => [
                    'account' => ['Your account is not active yet!'],
                ],
            ], 403);
        }

        $user->loadMissing('currentCompany');
        if (!$user->isSuperAdmin() && !empty($user->company_id) && (int) ($user->currentCompany?->status ?? 0) !== 1) {
            return $this->inactiveCompanyResponse();
        }

        if ($isEmailLogin) {
            $credentials['email'] = $user->email;
        } else {
            $credentials['phone'] = $user->phone;
        }

        if (!$token = Auth::guard('api')->attempt($credentials)) {
            return response()->json([
                'status' => 0,
                'errors' => [
                    'credentials' => ['Invalid credentials.'],
                ],
            ], 401);
        }

        return $this->buildAuthResponse(Auth::guard('api')->user(), $token, 'Login successful!');
    }

    public function issueAdminTransferCode(Request $request)
    {
        try {
            $user = JWTAuth::parseToken()->authenticate();
        } catch (TokenExpiredException $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Token has expired.',
            ], 401);
        } catch (TokenInvalidException $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Token is invalid.',
            ], 401);
        } catch (JWTException $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Token is missing.',
            ], 401);
        }

        if ($loginCheckResponse = $this->ensureLoginEligible($user)) {
            return $loginCheckResponse;
        }

        $transferCode = Str::random(64);

        Cache::put(
            $this->adminTransferCacheKey($transferCode),
            [
                'user_id' => $user->getKey(),
            ],
            now()->addMinutes($this->adminTransferExpiryMinutes)
        );

        return response()->json([
            'status' => 1,
            'message' => 'Admin handoff code created.',
            'transfer_code' => $transferCode,
            'expires_in_seconds' => $this->adminTransferExpiryMinutes * 60,
            'admin_login_url' => $this->buildAdminLoginUrl($transferCode),
        ], 200);
    }

    public function consumeAdminTransferCode(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'transfer_code' => 'required|string|min:16',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $transferCode = trim((string) $request->input('transfer_code'));
        $payload = Cache::pull($this->adminTransferCacheKey($transferCode));

        if (!$payload || empty($payload['user_id'])) {
            return response()->json([
                'status' => 0,
                'message' => 'Admin handoff code is invalid or expired.',
            ], 410);
        }

        $user = User::query()->find($payload['user_id']);

        if (!$user) {
            return response()->json([
                'status' => 0,
                'message' => 'User not found for this handoff code.',
            ], 404);
        }

        if ($loginCheckResponse = $this->ensureLoginEligible($user)) {
            return $loginCheckResponse;
        }

        $token = JWTAuth::fromUser($user);

        return $this->buildAuthResponse($user, $token, 'Admin login successful!');
    }

    public function issueLandingTransferCode(Request $request)
    {
        try {
            $user = JWTAuth::parseToken()->authenticate();
        } catch (TokenExpiredException $e) {
            return response()->json(['status' => 0, 'message' => 'Token has expired.'], 401);
        } catch (TokenInvalidException $e) {
            return response()->json(['status' => 0, 'message' => 'Token is invalid.'], 401);
        } catch (JWTException $e) {
            return response()->json(['status' => 0, 'message' => 'Token is missing.'], 401);
        }

        if ($loginCheckResponse = $this->ensureLoginEligible($user)) {
            return $loginCheckResponse;
        }

        $transferCode = Str::random(64);

        Cache::put(
            $this->landingTransferCacheKey($transferCode),
            ['user_id' => $user->getKey()],
            now()->addMinutes($this->adminTransferExpiryMinutes)
        );

        return response()->json([
            'status' => 1,
            'message' => 'Landing handoff code created.',
            'transfer_code' => $transferCode,
            'expires_in_seconds' => $this->adminTransferExpiryMinutes * 60,
            'landing_login_url' => $this->buildLandingLoginUrl($transferCode),
        ], 200);
    }

    public function consumeLandingTransferCode(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'transfer_code' => 'required|string|min:16',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $transferCode = trim((string) $request->input('transfer_code'));
        $payload = Cache::pull($this->landingTransferCacheKey($transferCode));

        if (!$payload || empty($payload['user_id'])) {
            return response()->json([
                'status' => 0,
                'message' => 'Landing handoff code is invalid or expired.',
            ], 410);
        }

        $user = User::query()->find($payload['user_id']);

        if (!$user) {
            return response()->json([
                'status' => 0,
                'message' => 'User not found for this handoff code.',
            ], 404);
        }

        if ($loginCheckResponse = $this->ensureLoginEligible($user)) {
            return $loginCheckResponse;
        }

        $token = JWTAuth::fromUser($user);

        return $this->buildAuthResponse($user, $token, 'Landing login successful!');
    }

    public function registerCompany(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'company_name' => 'nullable|string|max:255',
            'email' => 'required|email|unique:user,email',
            'phone' => 'required|max:20|unique:user,phone',
            'password' => 'required|string|min:6|confirmed',
            'enable_social_auth' => 'nullable|boolean',
            'referral_code' => 'nullable|string|max:32',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        DB::beginTransaction();

        try {
            $user = new User();
            $user->first_name = $request->first_name;
            $user->last_name = $request->last_name;
            $user->email = $request->email;
            $user->phone = $request->phone;
            $user->role = User::ECOMMERCE_COMPANY_ROLE;
            $user->status = 1;
            $user->password = Hash::make($request->password);
            $user->save();

            $company = new Company();
            $company->type = '4';
            $company->business_mode = 'online';
            $company->user_id = $user->id;
            $company->name = $this->inferCompanyNameFromRegistration($request);
            $company->contact_name = trim(($request->first_name ?? '') . ' ' . ($request->last_name ?? ''));
            $company->phone_number = $request->phone;
            $company->email = $request->email;
            $company->status = 1;

            $referralService = app(ReferralService::class);
            if ($request->filled('referral_code')) {
                $referrer = $referralService->attachReferrerFromCode($company, (string) $request->input('referral_code'));

                if (! $referrer) {
                    DB::rollBack();

                    return response()->json([
                        'status' => 0,
                        'errors' => [
                            'referral_code' => ['The selected referral code is invalid.'],
                        ],
                    ], 422);
                }
            }

            $company->save();

            $user->company_id = $company->company_id;
            $user->save();

            foreach (FeaturePreference::defaultsForInsert($company->company_id) as $preference) {
                CompanyFeaturePreference::create($preference);
            }

            if ($request->filled('enable_social_auth')) {
                $company->social_auth_enabled = filter_var($request->input('enable_social_auth'), FILTER_VALIDATE_BOOL);
                $company->save();

                CompanyFeaturePreference::query()->updateOrCreate(
                    [
                        'company_id' => $company->company_id,
                        'feature' => FeaturePreference::SOCIAL_AUTH->value,
                    ],
                    [
                        'active' => filter_var($request->input('enable_social_auth'), FILTER_VALIDATE_BOOL),
                    ]
                );
            }

            $defaultCustomer = new User();
            $defaultCustomer->first_name = 'Walking';
            $defaultCustomer->last_name = 'Customer';
            $defaultCustomer->email = 'walking+' . uniqid() . '@example.com';
            $defaultCustomer->phone = '01' . random_int(100000000, 999999999);
            $defaultCustomer->role = 2;
            $defaultCustomer->status = 1;
            $defaultCustomer->is_default = 1;
            $defaultCustomer->company_id = $company->company_id;
            $defaultCustomer->password = Hash::make('12345678');
            $defaultCustomer->save();

            $posSetup = new PosSetting();
            $posSetup->company_id = $company->company_id;
            $posSetup->key = 'payment_methods';
            $paymentMethods = [
                ['name' => 'Cash', 'config' => [], 'enabled' => true],
                ['name' => 'Card', 'config' => ['last_digit_length' => [5, 6], 'require_last_digits' => false], 'enabled' => true],
                ['name' => 'QR Payment', 'config' => ['providers' => ['bKash', 'Nagad', 'Rocket', 'Upay']], 'enabled' => false],
                ['name' => 'Reward Points', 'config' => [], 'enabled' => false],
                ['name' => 'Cash Refund', 'config' => [], 'enabled' => false],
                ['name' => 'Refund to Card', 'config' => ['last_digit_length' => [5, 6], 'require_last_digits' => true], 'enabled' => false],
                ['name' => 'Refund to MF', 'config' => ['providers' => ['bKash', 'Nagad', 'Rocket', 'Upay']], 'enabled' => false],
            ];
            $posSetup->value = json_encode($paymentMethods, JSON_UNESCAPED_SLASHES);
            $posSetup->save();

            DB::commit();

            $this->notifyBackofficeCompanyRegistered($company, $user);

            SendTemplatedEmail::dispatch($user->email, 'welcome_email', [
                'name' => trim($user->first_name . ' ' . ($user->last_name ?? '')),
                'first_name' => (string) $user->first_name,
                'last_name' => (string) ($user->last_name ?? ''),
                'company_name' => (string) $company->name,
                'email' => (string) $user->email,
                'phone' => (string) $user->phone,
                'login_url' => rtrim((string) config('app.admin_login_url', rtrim(config('app.url') ?? url('/'), '/') . '/login'), '/'),
            ]);

            $token = JWTAuth::fromUser($user);

            return $this->buildAuthResponse($user, $token, 'Company registered successfully.');
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'status' => 0,
                'message' => 'Registration failed.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function registerCustomer(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'email' => 'required|email|unique:user,email',
            'phone' => 'required|max:20|unique:user,phone',
            'password' => 'required|string|min:6|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        DB::beginTransaction();

        try {
            $companyId = EcommerceCompanyContext::resolveCompanyIdForRequest($request);

            if (blank($companyId)) {
                return response()->json([
                    'status' => 0,
                    'errors' => [
                        'company' => ['Unable to resolve storefront company from this request.'],
                    ],
                ], 422);
            }

            $user = new User();
            $user->first_name = $request->first_name;
            $user->last_name = $request->last_name;
            $user->email = $request->email;
            $user->phone = $request->phone;
            $user->role = User::ECOMMERCE_USER_ROLE;
            $user->status = 1;
            $user->company_id = $companyId;
            $user->password = Hash::make($request->password);
            $user->save();

            DB::commit();

            $token = JWTAuth::fromUser($user);

            return $this->buildAuthResponse($user, $token, 'Account created successfully.');
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'status' => 0,
                'message' => 'Registration failed.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function googleRedirect(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'return_url' => 'required|url',
            'storefront_host' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $returnUrl = (string) $request->input('return_url');
        $storefrontHost = trim((string) $request->input('storefront_host', (string) parse_url($returnUrl, PHP_URL_HOST)));
        $companyId = $this->resolveCompanyIdFromHost($storefrontHost);

        if ($companyId && !$this->isSocialAuthEnabledForCompany($companyId)) {
            return response()->json([
                'status' => 0,
                'message' => 'Social authentication is disabled for this company.',
            ], 403);
        }

        $googleCredentials = $this->resolveGoogleCredentials($companyId);
        $clientId = (string) ($googleCredentials['client_id'] ?? '');
        $redirectUri = (string) ($googleCredentials['redirect_uri'] ?? '');

        if ($clientId === '' || $redirectUri === '') {
            return response()->json([
                'status' => 0,
                'message' => 'Google authentication is not configured for this company.',
            ], 500);
        }

        $state = Str::random(48);
        Cache::put($this->googleStateCacheKey($state), [
            'return_url' => $returnUrl,
            'storefront_host' => $storefrontHost,
            'company_id' => $companyId,
        ], now()->addMinutes($this->socialAuthStateExpiryMinutes));

        $authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'access_type' => 'offline',
            'prompt' => 'select_account',
            'state' => $state,
        ]);

        return redirect()->away($authorizationUrl);
    }

    public function googleCallback(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string',
            'state' => 'required|string',
        ]);

        if ($validator->fails()) {
            return redirect()->away($this->buildRedirectUrl($this->frontendSigninUrl(), [
                'auth_error' => 'Invalid Google authentication response.',
            ]));
        }

        $state = (string) $request->input('state');
        $statePayload = Cache::pull($this->googleStateCacheKey($state));

        if (!is_array($statePayload)) {
            return redirect()->away($this->buildRedirectUrl($this->frontendSigninUrl(), [
                'auth_error' => 'Google authentication session expired. Please try again.',
            ]));
        }

        $companyId = trim((string) ($statePayload['company_id'] ?? '')) ?: $this->resolveCompanyIdFromHost($statePayload['storefront_host'] ?? null);
        if ($companyId && !$this->isSocialAuthEnabledForCompany($companyId)) {
            return $this->socialAuthFailureRedirect($statePayload, 'Social authentication is disabled for this company.');
        }

        $googleCredentials = $this->resolveGoogleCredentials($companyId);
        $clientId = (string) ($googleCredentials['client_id'] ?? '');
        $clientSecret = (string) ($googleCredentials['client_secret'] ?? '');
        $redirectUri = (string) ($googleCredentials['redirect_uri'] ?? '');

        if ($clientId === '' || $clientSecret === '' || $redirectUri === '') {
            return $this->socialAuthFailureRedirect($statePayload, 'Google authentication is not configured for this company.');
        }

        $tokenResponse = Http::asForm()->post('https://oauth2.googleapis.com/token', [
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'code' => (string) $request->input('code'),
            'grant_type' => 'authorization_code',
            'redirect_uri' => $redirectUri,
        ]);

        if (!$tokenResponse->successful()) {
            return $this->socialAuthFailureRedirect($statePayload, 'Failed to complete Google authentication.');
        }

        $accessToken = (string) data_get($tokenResponse->json(), 'access_token', '');
        if ($accessToken === '') {
            return $this->socialAuthFailureRedirect($statePayload, 'Google did not return an access token.');
        }

        $profileResponse = Http::withToken($accessToken)
            ->acceptJson()
            ->get('https://openidconnect.googleapis.com/v1/userinfo');

        if (!$profileResponse->successful()) {
            return $this->socialAuthFailureRedirect($statePayload, 'Unable to fetch your Google profile.');
        }

        $profile = $profileResponse->json();
        $googleId = trim((string) data_get($profile, 'sub', ''));
        $email = strtolower(trim((string) data_get($profile, 'email', '')));

        if ($email === '') {
            return $this->socialAuthFailureRedirect($statePayload, 'Google account email is missing.');
        }

        $user = User::query()->where('email', $email)->first();

        if (!$user) {
            if (!$companyId) {
                return $this->socialAuthFailureRedirect($statePayload, 'Unable to resolve your company for social login.');
            }

            $user = new User();
            $user->first_name = trim((string) data_get($profile, 'given_name', '')) ?: trim((string) data_get($profile, 'name', '')) ?: 'Google';
            $user->last_name = trim((string) data_get($profile, 'family_name', ''));
            $user->email = $email;
            $user->google_id = $googleId !== '' ? $googleId : null;
            $user->phone = $this->googleFallbackPhone($googleId, $email);
            $user->role = User::ECOMMERCE_USER_ROLE;
            $user->status = 1;
            $user->company_id = $companyId;
            $user->password = Hash::make(Str::random(32));
            $user->save();
        } else {
            if ($googleId !== '') {
                $user->google_id = $googleId;
            }

            if ($companyId && empty($user->company_id)) {
                $user->company_id = $companyId;
            }

            if ((int) $user->role !== User::ECOMMERCE_USER_ROLE && $companyId) {
                $user->role = User::ECOMMERCE_USER_ROLE;
            }

            if ((int) $user->status !== 1) {
                $user->status = 1;
            }

            if (empty($user->phone)) {
                $user->phone = $this->googleFallbackPhone($googleId, $email);
            }

            $user->save();
        }

        $token = JWTAuth::fromUser($user);
        $returnUrl = (string) ($statePayload['return_url'] ?? $this->frontendSigninUrl());

        return redirect()->away($this->buildRedirectUrl($returnUrl, [
            'auth_token' => $token,
            'auth_source' => 'google',
        ]));
    }

    private function notifyBackofficeCompanyRegistered(Company $company, User $registeredUser): void
    {
        $superAdmins = User::query()
            ->where('is_super_admin', 1)
            ->orWhereIn('role', User::getSuperAdminRoles())
            ->get();

        if ($superAdmins->isEmpty()) {
            return;
        }

        $payload = [
            'event' => 'company_registered',
            'title' => 'New company registered',
            'message' => sprintf(
                '%s has registered with email %s.',
                (string) ($company->name ?: 'A company'),
                (string) ($registeredUser->email ?: '-')
            ),
            'company_id' => $company->company_id,
            'company_name' => $company->name,
            'contact_name' => trim((string) $company->contact_name),
            'email' => $registeredUser->email,
            'phone' => $registeredUser->phone,
            'created_at' => now()->toDateTimeString(),
        ];

        foreach ($superAdmins as $admin) {
            try {
                DB::table('notifications')->insert([
                    'id' => (string) Str::uuid(),
                    'type' => BackofficeCompanyRegistered::class,
                    'notifiable_type' => User::class,
                    'notifiable_id' => (string) $admin->getKey(),
                    'data' => json_encode($payload, JSON_UNESCAPED_UNICODE),
                    'read_at' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

            } catch (\Throwable $exception) {
                // Keep registration flow safe even if notification fails.
            }
        }
    }

    public function forgotPasswordRequest(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $email = strtolower(trim((string) $request->input('email')));
        $user = User::query()->where('email', $email)->first();
        $resendLimiterKey = 'forgot-password-resend:' . $email;

        if (!$user) {
            return response()->json([
                'status' => 0,
                'message' => 'No account found with this email address.',
            ], 200);
        }

        if (RateLimiter::tooManyAttempts($resendLimiterKey, 1)) {
            $remainingSeconds = max(1, RateLimiter::availableIn($resendLimiterKey));

            return response()->json([
                'status' => 0,
                'message' => "Please wait {$remainingSeconds} seconds before requesting another verification code.",
                'data' => [
                    'retry_after_seconds' => $remainingSeconds,
                ],
            ], 429);
        }

        $code = (string) random_int(100000, 999999);

        DB::table('password_resets')->updateOrInsert(
            ['email' => $email],
            [
                'token' => Hash::make($code),
                'created_at' => now(),
            ]
        );

        SendTemplatedEmail::dispatch(
            $email,
            'password_reset',
            [
                'name' => trim((string) ($user->first_name . ' ' . $user->last_name)) ?: 'User',
                'otp' => $code,
                'code' => $code,
                'expiry_minutes' => $this->passwordResetExpiryMinutes,
            ]
        );

        RateLimiter::hit($resendLimiterKey, 60);

        app(CompanySmsService::class)->sendOtpVerification(
            $user->company_id ? Company::query()->find($user->company_id) : null,
            $user->phone,
            $code,
            $this->passwordResetExpiryMinutes
        );

        return response()->json([
            'status' => 1,
            'message' => 'Verification code sent to your email.',
            'data' => [
                'resend_after_seconds' => 60,
            ],
        ], 200);
    }

    private function adminTransferCacheKey(string $code): string
    {
        return 'admin-auth-transfer:' . $code;
    }

    private function landingTransferCacheKey(string $code): string
    {
        return 'landing-auth-transfer:' . $code;
    }

    private function adminFrontendUrl(): string
    {
        return rtrim((string) config('app.admin_frontend_url', config('app.url') . ':3000'), '/');
    }

    private function buildAdminLoginUrl(string $code): string
    {
        return $this->adminFrontendUrl() . '/login?transfer_code=' . urlencode($code);
    }

    private function landingFrontendUrl(): string
    {
        return rtrim((string) config('app.frontend_url', config('app.url') . ':3001'), '/');
    }

    private function buildLandingLoginUrl(string $code): string
    {
        return $this->landingFrontendUrl() . '/login?transfer_code=' . urlencode($code);
    }

    private function ensureLoginEligible(User $user)
    {
        $user->loadMissing('currentCompany');

        if ($user->status != 1) {
            return response()->json([
                'status' => 0,
                'errors' => [
                    'account' => ['Your account is not active yet!'],
                ],
            ], 403);
        }

        if (!$user->isSuperAdmin() && !empty($user->company_id) && (int) ($user->currentCompany?->status ?? 0) !== 1) {
            return $this->inactiveCompanyResponse();
        }

        return null;
    }

    public function forgotPasswordVerify(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'code' => 'required|digits:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $email = strtolower(trim((string) $request->input('email')));
        $record = DB::table('password_resets')->where('email', $email)->first();

        if (!$record || $this->isPasswordResetExpired($record->created_at)) {
            return response()->json([
                'status' => 0,
                'message' => 'Verification code expired. Please request a new code.',
            ], 400);
        }

        if (!Hash::check((string) $request->input('code'), (string) $record->token)) {
            return response()->json([
                'status' => 0,
                'message' => 'Invalid verification code.',
            ], 422);
        }

        $resetToken = Str::random(64);

        DB::table('password_resets')->where('email', $email)->update([
            'token' => Hash::make($resetToken),
            'created_at' => now(),
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Email verified successfully.',
            'data' => [
                'reset_token' => $resetToken,
            ],
        ], 200);
    }

    public function forgotPasswordReset(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'reset_token' => 'required|string',
            'new_password' => 'required|string|min:6|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $email = strtolower(trim((string) $request->input('email')));

        $record = DB::table('password_resets')->where('email', $email)->first();
        if (!$record || $this->isPasswordResetExpired($record->created_at)) {
            return response()->json([
                'status' => 0,
                'message' => 'Reset session expired. Please verify again.',
            ], 400);
        }

        if (!Hash::check((string) $request->input('reset_token'), (string) $record->token)) {
            return response()->json([
                'status' => 0,
                'message' => 'Invalid reset session. Please verify email again.',
            ], 422);
        }

        $user = User::query()->where('email', $email)->first();
        if (!$user) {
            return response()->json([
                'status' => 0,
                'message' => 'No user found with this email.',
            ], 404);
        }

        $user->password = Hash::make((string) $request->input('new_password'));
        $user->save();
        DB::table('password_resets')->where('email', $email)->delete();

        return response()->json([
            'status' => 1,
            'message' => 'Password reset successfully. Please login with your new password.',
        ], 200);
    }

    private function isPasswordResetExpired($createdAt): bool
    {
        if (!$createdAt) {
            return true;
        }

        return now()->diffInMinutes($createdAt) > $this->passwordResetExpiryMinutes;
    }

    public function me()
    {
        try {
            if (!$user = JWTAuth::parseToken()->authenticate()) {
                return response()->json([
                    'status' => 0,
                    'message' => 'User not found.',
                ], 404);
            }
        } catch (TokenExpiredException $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Token has expired.',
            ], 401);
        } catch (TokenInvalidException $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Token is invalid.',
            ], 401);
        } catch (JWTException $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Token is missing.',
            ], 401);
        }

        $user->loadMissing('roles');

        return response()->json([
            'status' => 1,
            'user' => $user,
            'role_name' => $user->resolveRoleName(),
        ], 200);
    }

    public function getUserRights()
    {
        try {
            if (!$user = JWTAuth::parseToken()->authenticate()) {
                return response()->json([
                    'status' => 0,
                    'message' => 'User not found.',
                ], 404);
            }
        } catch (TokenExpiredException $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Token has expired.',
            ], 401);
        } catch (TokenInvalidException $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Token is invalid.',
            ], 401);
        } catch (JWTException $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Token is missing.',
            ], 401);
        }

        $user->loadMissing('currentCompany');
        if ($user->currentCompany && !$user->isSuperAdmin() && (int) $user->role !== User::ECOMMERCE_USER_ROLE) {
            $this->backofficeCompanyService->ensureCompanyAccessBootstrap($user->currentCompany, $user, 'Administrator');
            $user->unsetRelation('roles');
        }

        $user->loadMissing('roles');
        $resolvedRights = $this->backofficeCompanyService->resolveRightsForUser($user);

        return response()->json([
            'status' => 1,
            'user' => $user,
            'role' => $user->resolveRoleName(),
            'rights' => $resolvedRights,
        ], 200);
    }

    public function updateProfile(Request $request)
    {
        try {
            $user = JWTAuth::parseToken()->authenticate();
        } catch (TokenExpiredException $e) {
            return response()->json(['status' => 0, 'message' => 'Token has expired.'], 401);
        } catch (TokenInvalidException $e) {
            return response()->json(['status' => 0, 'message' => 'Token is invalid.'], 401);
        } catch (JWTException $e) {
            return response()->json(['status' => 0, 'message' => 'Token is missing.'], 401);
        }

        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'phone' => 'required',
            'first_name' => 'required|string',
            'last_name' => 'nullable|string',
            'image' => 'nullable|image|mimes:jpg,jpeg,png,gif,webp|max:2048',
            'printer_type' => 'nullable|in:normal,pos',
            'private_code' => 'nullable|string|min:4|max:100|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $user->first_name = $request->first_name;
        $user->last_name = $request->last_name;
        $user->email = $request->email;
        $user->phone = $request->phone;

        if ($request->has('printer_type')) {
            $user->printer_type = $request->printer_type;
        }
        if ($request->filled('private_code')) {
            $user->private_code = Hash::make($request->private_code);
        }

        if ($request->hasFile('image')) {
            $user->profile_image = ImageService::upload($request->file('image'), 'user-images', [
                'extensions' => ['jpg', 'jpeg', 'png', 'gif', 'webp'],
                'mime_types' => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
                'max_kb' => 2048,
                'field' => 'image',
            ]);
        }

        $user->save();

        return response()->json([
            'status' => 1,
            'message' => 'Profile updated successfully',
            'user' => $user,
        ], 200);
    }

    public function changePassword(Request $request)
    {
        try {
            $user = JWTAuth::parseToken()->authenticate();
        } catch (TokenExpiredException $e) {
            return response()->json(['status' => 0, 'message' => 'Token has expired.'], 401);
        } catch (TokenInvalidException $e) {
            return response()->json(['status' => 0, 'message' => 'Token is invalid.'], 401);
        } catch (JWTException $e) {
            return response()->json(['status' => 0, 'message' => 'Token is missing.'], 401);
        }

        $validator = Validator::make($request->all(), [
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:6|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'status' => 0,
                'message' => 'Current password is incorrect.',
            ], 403);
        }

        $user->password = Hash::make($request->new_password);
        $user->save();

        return response()->json([
            'status' => 1,
            'message' => 'Password changed successfully.',
        ], 200);
    }

    public function logout()
    {
        JWTAuth::invalidate(JWTAuth::getToken());

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function verifyToken()
    {
        try {
            if ($user = JWTAuth::parseToken()->authenticate()) {
                $user->loadMissing(['currentCompany.saasPlan']);
                if (!$user->isSuperAdmin() && !empty($user->company_id) && (int) ($user->currentCompany?->status ?? 0) !== 1) {
                    return $this->inactiveCompanyResponse();
                }
                $company = $user->currentCompany;
                $isEcommerceUser = (int) $user->role === User::ECOMMERCE_USER_ROLE;

                if ($company && !$user->isSuperAdmin() && !$isEcommerceUser) {
                    $this->backofficeCompanyService->ensureCompanyAccessBootstrap($company, $user, 'Administrator');
                    $this->companyPlanFeatureService->syncCompanyPreferencesToPlan($company->fresh('saasPlan'));
                    $user->unsetRelation('roles');
                    $user->unsetRelation('currentCompany');
                    $user->load(['roles', 'currentCompany.saasPlan']);
                    $company = $user->currentCompany;
                } else {
                    $user->loadMissing('roles');
                }

                $planAccess = $this->resolvePlanAccess($user, $company);

                $response = [
                    'status' => 1,
                    'msg' => 'Token is valid',
                    'user' => $user,
                    'role_name' => $user->resolveRoleName(),
                    'has_active_plan' => $planAccess['has_active_plan'],
                    'needs_plan_selection' => $planAccess['needs_plan_selection'],
                    'selected_plan_id' => $planAccess['has_active_plan'] ? $company?->saas_plan_id : null,
                    'selected_plan' => $planAccess['has_active_plan'] ? $company?->saasPlan : null,
                    'selected_plan_features' => $planAccess['has_active_plan'] ? ($company?->saasPlan?->effectiveFeatures() ?? []) : [],
                    'active_feature_codes' => $planAccess['has_active_plan'] ? $this->companyPlanFeatureService->effectiveFeatureCodes($company?->company_id) : [],
                    'needs_ecommerce_setup' => $planAccess['needs_ecommerce_setup'],
                    'needs_domain_setup' => $planAccess['needs_domain_setup'],
                    'next_step' => $planAccess['next_step'],
                    'next_step_url' => $planAccess['next_step_url'],
                    'selected_e_template_id' => $company?->selected_e_template_id,
                    'ecommerce_setup_completed_at' => optional($company?->ecommerce_setup_completed_at)->toDateTimeString(),
                ];
                return response()->json($response, 200);
            }
        } catch (TokenExpiredException $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Token has expired.',
            ], 401);
        } catch (TokenInvalidException $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Token is invalid.',
            ], 401);
        } catch (JWTException $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Token is missing.',
            ], 401);
        }
    }

    public function verifyRouteAccess(Request $request)
    {
        

        $validator = Validator::make($request->all(), [
            'private_code' => 'required|string',
            'route' => 'nullable|string|max:255',
            'permission' => 'nullable|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'matched' => false,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        try {
            $user = JWTAuth::parseToken()->authenticate();
        } catch (TokenExpiredException $e) {
            return response()->json([
                'status' => 0,
                'matched' => false,
                'message' => 'Token has expired.',
            ], 401);
        } catch (TokenInvalidException $e) {
            return response()->json([
                'status' => 0,
                'matched' => false,
                'message' => 'Token is invalid.',
            ], 401);
        } catch (JWTException $e) {
            return response()->json([
                'status' => 0,
                'matched' => false,
                'message' => 'Token is missing.',
            ], 401);
        }

        $inputCode = (string) $request->private_code;
        $matched = false;

        if (!empty($user->private_code)) {
            $matched = Hash::check($inputCode, (string) $user->private_code)
                || hash_equals((string) $user->private_code, $inputCode);
        }


        if (!$matched) {
            $matched = Hash::check($inputCode, (string) $user->password);
        }

        if (!$matched) {
            return response()->json([
                'status' => 0,
                'matched' => false,
                'message' => 'Invalid private code or password.',
            ], 403);
        }

        return response()->json([
            'status' => 1,
            'matched' => true,
            'message' => 'Route access verified.',
            'data' => [
                'route' => $request->route,
                'permission' => $request->permission,
            ],
        ], 200);
    }
}
