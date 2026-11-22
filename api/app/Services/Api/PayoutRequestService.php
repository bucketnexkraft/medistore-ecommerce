<?php

namespace App\Services\Api;

use App\Models\PayoutRequest;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class PayoutRequestService
{
    public function customerIndex()
    {
        if (! Schema::hasTable('payout_requests')) {
            return response()->json([
                'status' => 1,
                'message' => 'Payout requests fetched successfully.',
                'data' => [],
                'summary' => $this->buildCustomerSummary(Auth::user(), collect()),
            ]);
        }

        $user = Auth::user();
        $requests = PayoutRequest::query()
            ->where('user_id', (string) $user->id)
            ->where('request_type', 'customer')
            ->latest('requested_at')
            ->latest('created_at')
            ->get();

        return response()->json([
            'status' => 1,
            'message' => 'Payout requests fetched successfully.',
            'data' => $requests->map(fn (PayoutRequest $request) => $this->formatPayoutRequest($request))->values(),
            'summary' => $this->buildCustomerSummary($user, $requests),
        ]);
    }

    public function customerStore(Request $request)
    {
        if (! Schema::hasTable('payout_requests') || ! Schema::hasColumn('user', 'wallet_balance')) {
            return response()->json([
                'status' => 0,
                'message' => 'Payout setup is not ready yet. Please run the latest migrations first.',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0.01',
            'description' => 'required|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        /** @var User $user */
        $user = Auth::user();
        $payload = $validator->validated();
        $amount = round((float) $payload['amount'], 2);

        $pendingAmount = (float) PayoutRequest::query()
            ->where('user_id', (string) $user->id)
            ->where('request_type', 'customer')
            ->where('status', 'pending')
            ->sum('amount');

        $walletBalance = round((float) ($user->wallet_balance ?? 0), 2);
        $requestableBalance = round(max($walletBalance - $pendingAmount, 0), 2);

        if ($requestableBalance <= 0) {
            return response()->json([
                'status' => 0,
                'message' => 'No payout balance is available right now.',
            ], 422);
        }

        if ($amount > $requestableBalance) {
            return response()->json([
                'status' => 0,
                'message' => sprintf('You can request up to %.2f only.', $requestableBalance),
            ], 422);
        }

        $payoutRequest = PayoutRequest::query()->create([
            'company_id' => ! empty($user->company_id) ? (string) $user->company_id : null,
            'user_id' => (string) $user->id,
            'request_type' => 'customer',
            'amount' => $amount,
            'description' => trim((string) $payload['description']),
            'status' => 'pending',
        ]);

        $requests = PayoutRequest::query()
            ->where('user_id', (string) $user->id)
            ->where('request_type', 'customer')
            ->latest('requested_at')
            ->latest('created_at')
            ->get();

        return response()->json([
            'status' => 1,
            'message' => 'Payout request submitted successfully.',
            'data' => $this->formatPayoutRequest($payoutRequest),
            'summary' => $this->buildCustomerSummary($user->fresh(), $requests),
        ]);
    }

    public function companyIndex(Request $request)
    {
        if (! Schema::hasTable('payout_requests')) {
            return response()->json([
                'status' => 1,
                'message' => 'Payout requests fetched successfully.',
                'data' => [],
                'summary' => $this->buildCompanySummary(collect()),
            ]);
        }

        $status = trim((string) $request->input('status', ''));

        $query = PayoutRequest::query()->with([
            'user:id,first_name,last_name,email,phone,wallet_balance',
        ]);

        if (! Auth::user()?->isSuperAdmin()) {
            $query->where('company_id', (string) Auth::user()?->company_id)
                ->where('request_type', 'customer');
        }

        if ($status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        $requests = $query
            ->latest('requested_at')
            ->latest('created_at')
            ->get();

        return response()->json([
            'status' => 1,
            'message' => 'Payout requests fetched successfully.',
            'data' => $requests->map(fn (PayoutRequest $request) => $this->formatPayoutRequest($request))->values(),
            'summary' => $this->buildCompanySummary($requests),
        ]);
    }

    public function companyApprove(string $id)
    {
        if (! Schema::hasTable('payout_requests') || ! Schema::hasColumn('user', 'wallet_balance')) {
            return response()->json([
                'status' => 0,
                'message' => 'Payout setup is not ready yet. Please run the latest migrations first.',
            ], 422);
        }

        $payoutRequest = $this->resolveCompanyPayoutRequest($id);

        if (! $payoutRequest) {
            return response()->json([
                'status' => 0,
                'message' => 'Payout request not found.',
            ], 404);
        }

        if ($payoutRequest->request_type === 'referral' && ! Auth::user()?->isSuperAdmin()) {
            return response()->json([
                'status' => 0,
                'message' => 'Only backoffice administrators can approve referral payouts.',
            ], 403);
        }

        if ((string) $payoutRequest->status !== 'pending') {
            return response()->json([
                'status' => 0,
                'message' => 'Only pending payout requests can be approved.',
            ], 422);
        }

        try {
            DB::transaction(function () use ($payoutRequest) {
                /** @var PayoutRequest $lockedRequest */
                $lockedRequest = PayoutRequest::query()
                    ->where('id', $payoutRequest->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                /** @var User $customer */
                $customer = User::query()
                    ->where('id', $lockedRequest->user_id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $amount = round((float) $lockedRequest->amount, 2);
                $walletBalance = round((float) ($customer->wallet_balance ?? 0), 2);

                if ($amount > $walletBalance) {
                    throw new \RuntimeException('Customer balance is no longer enough for this payout request.');
                }

                $customer->wallet_balance = round($walletBalance - $amount, 2);
                $customer->save();

                $lockedRequest->status = 'completed';
                $lockedRequest->processed_by = (string) Auth::id();
                $lockedRequest->rejection_reason = null;
                $lockedRequest->resolved_at = now();
                $lockedRequest->save();
            });
        } catch (\RuntimeException $exception) {
            return response()->json([
                'status' => 0,
                'message' => $exception->getMessage(),
            ], 422);
        }

        $payoutRequest = $this->resolveCompanyPayoutRequest($id);

        return response()->json([
            'status' => 1,
            'message' => 'Payout request approved successfully.',
            'data' => $this->formatPayoutRequest($payoutRequest),
        ]);
    }

    public function companyReject(Request $request, string $id)
    {
        if (! Schema::hasTable('payout_requests')) {
            return response()->json([
                'status' => 0,
                'message' => 'Payout setup is not ready yet. Please run the latest migrations first.',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'rejection_reason' => 'required|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $payoutRequest = $this->resolveCompanyPayoutRequest($id);

        if (! $payoutRequest) {
            return response()->json([
                'status' => 0,
                'message' => 'Payout request not found.',
            ], 404);
        }

        if ($payoutRequest->request_type === 'referral' && ! Auth::user()?->isSuperAdmin()) {
            return response()->json([
                'status' => 0,
                'message' => 'Only backoffice administrators can reject referral payouts.',
            ], 403);
        }

        if ((string) $payoutRequest->status !== 'pending') {
            return response()->json([
                'status' => 0,
                'message' => 'Only pending payout requests can be rejected.',
            ], 422);
        }

        $payoutRequest->status = 'rejected';
        $payoutRequest->processed_by = (string) Auth::id();
        $payoutRequest->rejection_reason = trim((string) $validator->validated()['rejection_reason']);
        $payoutRequest->resolved_at = now();
        $payoutRequest->save();
        $payoutRequest->load('user:id,first_name,last_name,email,phone,wallet_balance');

        return response()->json([
            'status' => 1,
            'message' => 'Payout request rejected successfully.',
            'data' => $this->formatPayoutRequest($payoutRequest),
        ]);
    }

    private function resolveCompanyPayoutRequest(string $id): ?PayoutRequest
    {
        if (! Schema::hasTable('payout_requests')) {
            return null;
        }

        $query = PayoutRequest::query()
            ->with('user:id,first_name,last_name,email,phone,wallet_balance')
            ->where('id', $id);

        if (! Auth::user()?->isSuperAdmin()) {
            $query->where('company_id', (string) Auth::user()?->company_id);
        }

        return $query->first();
    }

    public function referralIndex()
    {
        /** @var User $user */
        $user = Auth::user();
        $requests = PayoutRequest::query()
            ->where('user_id', (string) $user->id)
            ->where('request_type', 'referral')
            ->latest('requested_at')
            ->get();

        return response()->json([
            'status' => 1,
            'data' => $requests->map(fn (PayoutRequest $item) => $this->formatPayoutRequest($item))->values(),
            'summary' => $this->buildCustomerSummary($user, $requests),
            'settings' => $this->payoutSettings(),
        ]);
    }

    public function referralStore(Request $request)
    {
        $settings = $this->payoutSettings();
        if (! $settings['enabled']) {
            return response()->json(['status' => 0, 'message' => 'Referral payouts are currently disabled.'], 422);
        }

        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:' . $settings['minimum_amount'],
            'payout_method' => 'required|string|in:' . implode(',', $settings['methods']),
            'payout_details' => 'required|array|min:1',
            'description' => 'nullable|string|max:1000',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 0, 'errors' => $validator->errors()->all()], 422);
        }

        /** @var User $user */
        $user = Auth::user();
        $pending = PayoutRequest::query()
            ->where('user_id', (string) $user->id)
            ->where('request_type', 'referral')
            ->where('status', 'pending');

        if ((clone $pending)->count() >= $settings['max_pending_requests']) {
            return response()->json(['status' => 0, 'message' => 'Maximum pending payout request limit reached.'], 422);
        }

        $amount = round((float) $request->input('amount'), 2);
        if ($settings['maximum_amount'] !== null && $amount > $settings['maximum_amount']) {
            return response()->json(['status' => 0, 'message' => 'The amount exceeds the maximum payout limit.'], 422);
        }

        $available = round(max((float) $user->wallet_balance - (float) (clone $pending)->sum('amount'), 0), 2);
        if ($amount > $available) {
            return response()->json(['status' => 0, 'message' => sprintf('You can request up to %.2f only.', $available)], 422);
        }

        $item = PayoutRequest::query()->create([
            'company_id' => (string) $user->company_id,
            'user_id' => (string) $user->id,
            'request_type' => 'referral',
            'amount' => $amount,
            'payout_method' => (string) $request->input('payout_method'),
            'payout_details' => $request->input('payout_details'),
            'description' => trim((string) $request->input('description', 'Referral bonus payout')),
            'status' => 'pending',
        ]);

        return response()->json(['status' => 1, 'message' => 'Referral payout request submitted successfully.', 'data' => $this->formatPayoutRequest($item)], 201);
    }

    private function payoutSettings(): array
    {
        $raw = Setting::query()->where('key', 'payout_settings')->value('value');
        $data = is_array($raw) ? $raw : (json_decode((string) $raw, true) ?: []);

        return [
            'enabled' => (bool) ($data['enabled'] ?? false),
            'minimum_amount' => round((float) ($data['minimum_amount'] ?? 10), 2),
            'maximum_amount' => isset($data['maximum_amount']) ? round((float) $data['maximum_amount'], 2) : null,
            'max_pending_requests' => max(1, (int) ($data['max_pending_requests'] ?? 1)),
            'methods' => array_values($data['methods'] ?? ['Bank Transfer']),
            'instructions' => (string) ($data['instructions'] ?? ''),
        ];
    }

    private function buildCustomerSummary(User $user, $requests): array
    {
        $pendingAmount = round((float) $requests->where('status', 'pending')->sum('amount'), 2);
        $completedAmount = round((float) $requests->where('status', 'completed')->sum('amount'), 2);
        $walletBalance = round((float) ($user->wallet_balance ?? 0), 2);

        return [
            'wallet_balance' => $walletBalance,
            'pending_amount' => $pendingAmount,
            'completed_amount' => $completedAmount,
            'requestable_balance' => round(max($walletBalance - $pendingAmount, 0), 2),
        ];
    }

    private function buildCompanySummary($requests): array
    {
        return [
            'total_requests' => (int) $requests->count(),
            'pending_requests' => (int) $requests->where('status', 'pending')->count(),
            'completed_requests' => (int) $requests->where('status', 'completed')->count(),
            'rejected_requests' => (int) $requests->where('status', 'rejected')->count(),
            'total_amount' => round((float) $requests->sum('amount'), 2),
        ];
    }

    private function formatPayoutRequest(?PayoutRequest $request): ?array
    {
        if (! $request) {
            return null;
        }

        $customer = $request->user;
        $customerName = trim(implode(' ', array_filter([
            (string) ($customer->first_name ?? ''),
            (string) ($customer->last_name ?? ''),
        ])));

        return [
            'id' => (string) $request->id,
            'status' => (string) $request->status,
            'amount' => (float) $request->amount,
            'request_type' => (string) ($request->request_type ?: 'customer'),
            'payout_method' => $request->payout_method,
            'payout_details' => $request->payout_details ?: [],
            'description' => (string) $request->description,
            'rejection_reason' => $request->rejection_reason,
            'requested_at' => optional($request->requested_at ?? $request->created_at)?->toIso8601String(),
            'resolved_at' => optional($request->resolved_at)?->toIso8601String(),
            'customer' => $customer ? [
                'id' => (string) $customer->id,
                'name' => $customerName !== '' ? $customerName : ((string) ($customer->email ?: $customer->phone ?: 'Customer')),
                'email' => $customer->email,
                'phone' => $customer->phone,
                'wallet_balance' => (float) ($customer->wallet_balance ?? 0),
            ] : null,
        ];
    }
}
