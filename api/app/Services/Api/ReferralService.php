<?php

namespace App\Services\Api;

use App\Jobs\SendReferralRewardEmail;
use App\Data\FeaturePreference;
use App\Models\Company;
use App\Models\CompanyReferralEarning;
use App\Models\PlanPaymentLog;
use App\Models\Setting;
use App\Models\User;
use App\Services\CompanyPlanFeatureService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ReferralService
{
    private const DEFAULT_SIGNUP_BONUS = 25.00;
    private const DEFAULT_LEVEL_PERCENTAGES = [
        1 => 10,
        2 => 5,
        3 => 2,
    ];
    private const MAX_REFERRAL_LEVELS = 20;

    public function __construct(private readonly CompanyPlanFeatureService $companyPlanFeatureService)
    {
    }

    public function dashboard(Request $request): array
    {
        $company = $this->resolveCurrentCompany();

        if (! $company) {
            return [
                'status' => 0,
                'message' => 'Company not found.',
                'code' => 404,
            ];
        }

        $this->ensureReferralCode($company);
        $company->refresh();

        $company->loadMissing(['user:id,first_name,last_name,email,phone,wallet_balance', 'referrerCompany', 'referralChildren']);
        $treeDepth = max(1, min((int) $request->input('depth', 3), $this->maxReferralLevels()));

        $earningsQuery = CompanyReferralEarning::query()
            ->where('company_id', $company->company_id)
            ->with([
                'sourceCompany:company_id,name,referral_code',
                'planPaymentLog:id,trx,payable_amount,status',
            ])
            ->orderByDesc('credited_at')
            ->orderByDesc('created_at');

        $earnings = $earningsQuery->paginate((int) $request->input('perPage', 10));

        $directChildren = $company->referralChildren()
            ->with(['user:id,first_name,last_name,email,phone,wallet_balance'])
            ->orderByDesc('created_at')
            ->get();

        $descendants = $this->buildDescendants($company->company_id, $treeDepth);
        $uplines = $this->buildUplineChain($company->company_id);

        $walletBalance = (float) ($company->user?->wallet_balance ?? 0);
        $totalEarnings = round((float) CompanyReferralEarning::query()
            ->where('company_id', $company->company_id)
            ->sum('amount'), 2);

        return [
            'status' => 1,
            'message' => 'Referral dashboard fetched successfully.',
            'data' => [
                'enabled' => true,
                'referral_code' => (string) ($company->referral_code ?? ''),
                'referral_link' => $this->buildReferralLink((string) ($company->referral_code ?? '')),
                'wallet_balance' => $walletBalance,
                'overview' => [
                    'direct_referrals' => (int) $directChildren->count(),
                    'total_downlines' => (int) $this->countDescendants($company->company_id),
                    'active_downlines' => (int) $this->countActiveDescendants($this->collectDescendantIds($company->company_id)),
                    'wallet_balance' => $walletBalance,
                    'total_earnings' => $totalEarnings,
                'pending_earnings' => 0.0,
                'max_levels' => $this->maxReferralLevels(),
            ],
                'levels' => $this->levelSummary(),
                'rules' => $this->normalizedReferralRules(),
                'tree' => $descendants,
                'uplines' => $uplines,
                'recent_earnings' => $earnings->getCollection()->map(fn (CompanyReferralEarning $earning) => $this->formatEarning($earning))->values(),
                'pagination' => [
                    'current_page' => $earnings->currentPage(),
                    'last_page' => $earnings->lastPage(),
                    'per_page' => $earnings->perPage(),
                    'total' => $earnings->total(),
                ],
            ],
        ];
    }

    public function attachReferrerFromCode(Company $company, ?string $referralCode): ?Company
    {
        $code = strtoupper(trim((string) $referralCode));
        if ($code === '') {
            return null;
        }

        $referrer = Company::withoutGlobalScopes()
            ->whereRaw('UPPER(referral_code) = ?', [$code])
            ->first();

        if (! $referrer || (string) $referrer->company_id === (string) $company->company_id) {
            return null;
        }

        $company->ancestor_id = (string) $referrer->company_id;

        return $referrer;
    }

    public function awardActivationRewards(Company $sourceCompany, ?PlanPaymentLog $paymentLog = null, ?float $baseAmount = null): array
    {
        $baseAmount = round((float) ($baseAmount ?? $paymentLog?->payable_amount ?? $paymentLog?->amount ?? 0), 2);
        if ($baseAmount <= 0) {
            $baseAmount = $this->signupBonusAmount();
        }

        $awards = [];
        $currentCompany = $sourceCompany->loadMissing('referrerCompany');
        $sourceReference = $paymentLog
            ? 'plan-payment:' . (string) $paymentLog->id
            : 'plan-activation:' . (string) $sourceCompany->company_id . ':' . (string) ($sourceCompany->saas_plan_id ?? '0');

        DB::transaction(function () use ($baseAmount, $currentCompany, $paymentLog, $sourceReference, &$awards) {
            $levelPercentages = $this->levelPercentages();
            $ancestor = $currentCompany->referrerCompany;
            $level = 1;

            while ($ancestor && $level <= count($levelPercentages)) {
                if (! $this->companyPlanFeatureService->isFeatureAllowedByPlan($ancestor->company_id, FeaturePreference::REFERRAL_SYSTEM->value)) {
                    $ancestor = $ancestor->loadMissing('referrerCompany')->referrerCompany;
                    $level++;
                    continue;
                }

                $percentage = $levelPercentages[$level] ?? 0;
                $amount = round($baseAmount * ($percentage / 100), 2);

                if ($amount > 0) {
                    $referenceKey = $sourceReference . ':level:' . $level . ':to:' . $ancestor->company_id;

                    $record = CompanyReferralEarning::query()->firstOrCreate(
                        [
                            'reference_key' => $referenceKey,
                        ],
                        [
                            'company_id' => (string) $ancestor->company_id,
                            'source_company_id' => (string) $currentCompany->company_id,
                            'plan_payment_log_id' => $paymentLog?->id,
                            'level' => $level,
                            'reward_type' => $paymentLog ? 'plan' : 'signup',
                            'amount' => $amount,
                            'status' => 'credited',
                            'notes' => sprintf(
                                'Level %d referral reward from %s',
                                $level,
                                (string) ($currentCompany->name ?: $currentCompany->company_id)
                            ),
                            'credited_at' => now(),
                        ]
                    );

                    if ($record->wasRecentlyCreated) {
                        $ancestorOwner = $ancestor->user()->first();
                        if ($ancestorOwner && Schema::hasColumn('user', 'wallet_balance')) {
                            $ancestorOwner->wallet_balance = round((float) ($ancestorOwner->wallet_balance ?? 0) + $amount, 2);
                            $ancestorOwner->save();
                        }

                        if ($ancestorOwner?->email) {
                            SendReferralRewardEmail::dispatch(
                                (string) $ancestorOwner->email,
                                trim((string) $ancestorOwner->first_name . ' ' . (string) ($ancestorOwner->last_name ?? '')) ?: (string) ($ancestor->name ?: 'Referral partner'),
                                (string) ($currentCompany->name ?: 'Unnamed company'),
                                (string) ($currentCompany->referral_code ?? ''),
                                $level,
                                $amount,
                                (string) ($paymentLog ? 'plan' : 'signup'),
                                $this->referralDashboardUrl()
                            );
                        }

                        $awards[] = $this->formatEarning($record->fresh(['sourceCompany', 'planPaymentLog']));
                    }
                }

                $ancestor = $ancestor->loadMissing('referrerCompany')->referrerCompany;
                $level++;
            }
        });

        return $awards;
    }

    private function resolveCurrentCompany(): ?Company
    {
        $user = Auth::user();
        if (! $user || ! $user->company_id) {
            return null;
        }

        return Company::query()->with('user:id,first_name,last_name,email,phone,wallet_balance')->find($user->company_id);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildDescendants(string $companyId, int $depth, int $currentLevel = 1): array
    {
        if ($depth <= 0) {
            return [];
        }

        $children = Company::withoutGlobalScopes()
            ->where('ancestor_id', $companyId)
            ->with(['user:id,first_name,last_name,email,phone,wallet_balance'])
            ->orderByDesc('created_at')
            ->get();

        return $children->map(function (Company $child) use ($depth, $currentLevel) {
            return [
                'company_id' => (string) $child->company_id,
                'company_name' => (string) ($child->name ?: 'Unnamed company'),
                'referral_code' => (string) ($child->referral_code ?? ''),
                'level' => $currentLevel,
                'wallet_balance' => (float) ($child->user?->wallet_balance ?? 0),
                'direct_referrals' => (int) Company::withoutGlobalScopes()->where('ancestor_id', $child->company_id)->count(),
                'children' => $this->buildDescendants((string) $child->company_id, $depth - 1, $currentLevel + 1),
            ];
        })->values()->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildUplineChain(string $companyId): array
    {
        $chain = [];
        $current = Company::withoutGlobalScopes()->with(['user:id,first_name,last_name,email,phone,wallet_balance'])->find($companyId);
        $level = 1;

        while ($current?->ancestor_id && $level <= $this->maxReferralLevels()) {
            $parent = Company::withoutGlobalScopes()
                ->with(['user:id,first_name,last_name,email,phone,wallet_balance'])
                ->find($current->ancestor_id);

            if (! $parent) {
                break;
            }

            $chain[] = [
                'company_id' => (string) $parent->company_id,
                'company_name' => (string) ($parent->name ?: 'Unnamed company'),
                'referral_code' => (string) ($parent->referral_code ?? ''),
                'level' => $level,
                'wallet_balance' => (float) ($parent->user?->wallet_balance ?? 0),
            ];

            $current = $parent;
            $level++;
        }

        return $chain;
    }

    private function countDescendants(string $companyId): int
    {
        $count = 0;
        $queue = [$companyId];

        while ($queue !== []) {
            $currentCompanyId = array_shift($queue);

            $children = Company::withoutGlobalScopes()
                ->where('ancestor_id', $currentCompanyId)
                ->pluck('company_id')
                ->values()
                ->all();

            $count += count($children);
            $queue = array_merge($queue, $children);
        }

        return $count;
    }

    /**
     * @param array<int, string> $companyIds
     */
    private function countActiveDescendants(array $companyIds): int
    {
        if ($companyIds === []) {
            return 0;
        }

        return Company::withoutGlobalScopes()
            ->whereIn('company_id', $companyIds)
            ->where('status', 1)
            ->count();
    }

    /**
     * @return array<int, string>
     */
    private function collectDescendantIds(string $companyId): array
    {
        $ids = [];
        $queue = [$companyId];

        while ($queue !== []) {
            $currentCompanyId = array_shift($queue);

            $children = Company::withoutGlobalScopes()
                ->where('ancestor_id', $currentCompanyId)
                ->pluck('company_id')
                ->values()
                ->all();

            $ids = array_merge($ids, $children);
            $queue = array_merge($queue, $children);
        }

        return array_values(array_unique($ids));
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function levelSummary(): array
    {
        return $this->normalizedLevelRules();
    }

    private function referralRules(): array
    {
        $record = Setting::query()->where('key', 'referral_rules')->first();
        $decoded = json_decode((string) ($record?->getRawOriginal('value') ?? '{}'), true);

        return is_array($decoded) ? $decoded : [];
    }

    private function maxReferralLevels(): int
    {
        $rules = $this->referralRules();
        $levels = (int) ($rules['max_levels'] ?? 0);

        if ($levels < 1 && isset($rules['levels']) && is_array($rules['levels'])) {
            $levels = count($rules['levels']);
        }

        if ($levels < 1) {
            $levels = count(self::DEFAULT_LEVEL_PERCENTAGES);
        }

        return max(1, min($levels, self::MAX_REFERRAL_LEVELS));
    }

    /**
     * @return array<int, array{level:int, percentage:float}>
     */
    private function normalizedLevelRules(): array
    {
        $rules = $this->referralRules();
        $levels = $this->maxReferralLevels();
        $rows = [];

        if (isset($rules['levels']) && is_array($rules['levels'])) {
            foreach ($rules['levels'] as $index => $row) {
                if (! is_array($row)) {
                    continue;
                }

                $level = (int) ($row['level'] ?? ($index + 1));
                if ($level < 1 || $level > $levels) {
                    continue;
                }

                $rows[$level] = [
                    'level' => $level,
                    'percentage' => round((float) ($row['percentage'] ?? 0), 2),
                ];
            }
        }

        for ($level = 1; $level <= $levels; $level++) {
            if (isset($rows[$level])) {
                continue;
            }

            $defaultPercentage = self::DEFAULT_LEVEL_PERCENTAGES[$level] ?? 0;
            $legacyKey = "level{$level}_percentage";
            $rows[$level] = [
                'level' => $level,
                'percentage' => round((float) ($rules[$legacyKey] ?? $defaultPercentage), 2),
            ];
        }

        ksort($rows);

        return array_values($rows);
    }

    /**
     * @return array<int, float>
     */
    private function levelPercentages(): array
    {
        $percentages = [];

        foreach ($this->normalizedLevelRules() as $row) {
            $percentages[(int) $row['level']] = (float) $row['percentage'];
        }

        return $percentages;
    }

    private function signupBonusAmount(): float
    {
        $rules = $this->referralRules();

        return round((float) ($rules['signup_bonus'] ?? self::DEFAULT_SIGNUP_BONUS), 2);
    }

    private function normalizedReferralRules(): array
    {
        $rules = $this->referralRules();
        $rules['max_levels'] = $this->maxReferralLevels();
        $rules['signup_bonus'] = $this->signupBonusAmount();
        $rules['levels'] = $this->normalizedLevelRules();

        return $rules;
    }

    private function buildReferralLink(string $referralCode): string
    {
        $code = trim($referralCode);
        if ($code === '') {
            return '';
        }

        $baseUrl = rtrim((string) config('app.frontend_url', config('app.url')), '/');

        return $baseUrl . '/register?ref=' . urlencode($code);
    }

    private function referralDashboardUrl(): string
    {
        $baseUrl = rtrim((string) config('app.frontend_url', config('app.url')), '/');

        return $baseUrl . '/seller-dashboard/referrals';
    }

    private function ensureReferralCode(Company $company): void
    {
        if (trim((string) ($company->referral_code ?? '')) !== '') {
            return;
        }

        do {
            $generatedCode = strtoupper(Str::random(8));
        } while (Company::withoutGlobalScopes()
            ->where('referral_code', $generatedCode)
            ->exists());

        $company->forceFill([
            'referral_code' => $generatedCode,
        ])->save();
    }

    private function formatEarning(CompanyReferralEarning $earning): array
    {
        return [
            'id' => (string) $earning->id,
            'company_id' => (string) $earning->company_id,
            'source_company_id' => (string) $earning->source_company_id,
            'reference_key' => (string) $earning->reference_key,
            'level' => (int) $earning->level,
            'reward_type' => (string) $earning->reward_type,
            'amount' => (float) $earning->amount,
            'status' => (string) $earning->status,
            'notes' => $earning->notes,
            'credited_at' => optional($earning->credited_at ?? $earning->created_at)?->toIso8601String(),
            'source_company' => $earning->sourceCompany ? [
                'company_id' => (string) $earning->sourceCompany->company_id,
                'name' => (string) ($earning->sourceCompany->name ?: 'Unnamed company'),
                'referral_code' => (string) ($earning->sourceCompany->referral_code ?? ''),
            ] : null,
            'plan_payment' => $earning->planPaymentLog ? [
                'id' => (string) $earning->planPaymentLog->id,
                'trx' => (string) ($earning->planPaymentLog->trx ?? ''),
                'amount' => (float) ($earning->planPaymentLog->payable_amount ?? 0),
                'status' => (string) ($earning->planPaymentLog->status ?? ''),
            ] : null,
        ];
    }
}
