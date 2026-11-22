<?php

namespace App\Http\Controllers;

use App\Factory\PaymentGatewayFactory;
use App\Models\Company;
use App\Models\CompanyETemplateAccess;
use App\Models\Gateway;
use App\Models\PlanPaymentLog;
use App\Models\User;
use App\Services\Api\EcommerceDemoDataSyncService;
use App\Services\Api\ReferralService;
use App\Services\Api\StorefrontHomeBuilderService;
use App\Services\BackofficeCompanyService;
use App\Services\CompanyPlanFeatureService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Http\Request;

class PlanPaymentController extends Controller
{
    public function paymentSuccess(string $trx)
    {
        $payment = PlanPaymentLog::query()->where('trx', $trx)->with('gateway')->firstOrFail();

        if ($payment->status === 'approved') {
            $redirectPath = $this->successRedirectPath($payment);
            $separator = str_contains($redirectPath, '?') ? '&' : '?';

            return redirect($this->frontendUrl($redirectPath . $separator . 'status=already_paid', $payment));
        }

        $response = PaymentGatewayFactory::create($payment->gateway->name)->success($payment, static::class);

        if (($response['status'] ?? false) === true) {
            return redirect($this->frontendUrl($this->successRedirectPath($payment), $payment));
        }

        return redirect($this->frontendUrl('/plans?plan_payment=failed', $payment));
    }

    public function paymentCancel(string $trx)
    {
        $payment = PlanPaymentLog::query()->where('trx', $trx)->with('gateway')->firstOrFail();

        $response = PaymentGatewayFactory::create($payment->gateway->name)->cancel($payment, static::class);

        if (($response['status'] ?? false) === true) {
            return redirect($this->frontendUrl('/plans?plan_payment=canceled', $payment));
        }

        return redirect($this->frontendUrl('/plans?plan_payment=failed', $payment));
    }

    public function stripeWebhook(Request $request, string $gatewayId)
    {
        $gateway = Gateway::query()->with('currency')->find($gatewayId);

        if (!$gateway || strtolower(trim((string) $gateway->name)) !== 'stripe') {
            return response()->json(['message' => 'Stripe gateway not found.'], 404);
        }

        $parameters = is_array($gateway->parameters) ? $gateway->parameters : [];
        $webhookSecret = trim((string) ($parameters['webhook_secret'] ?? config('services.stripe.webhook_secret')));
        $signature = (string) $request->header('Stripe-Signature', '');

        if ($webhookSecret === '' || $signature === '') {
            return response()->json(['message' => 'Stripe webhook configuration is incomplete.'], 503);
        }

        try {
            $event = \Stripe\Webhook::constructEvent(
                $request->getContent(),
                $signature,
                $webhookSecret,
            );
        } catch (\UnexpectedValueException) {
            return response()->json(['message' => 'Invalid Stripe webhook payload.'], 400);
        } catch (\Stripe\Exception\SignatureVerificationException) {
            return response()->json(['message' => 'Invalid Stripe webhook signature.'], 400);
        }

        $eventType = (string) ($event->type ?? '');
        if (!in_array($eventType, ['checkout.session.completed', 'checkout.session.async_payment_succeeded'], true)) {
            return response()->json(['received' => true]);
        }

        $session = $event->data->object ?? null;
        if (!$session || (string) ($session->payment_status ?? '') !== 'paid') {
            return response()->json(['received' => true]);
        }

        $metadata = $session->metadata ?? null;
        $trx = trim((string) (
            $session->client_reference_id
            ?? data_get($metadata, 'trx')
            ?? data_get($metadata, 'order_no')
            ?? ''
        ));

        $payment = $trx === ''
            ? null
            : PlanPaymentLog::query()->where('trx', $trx)->where('gateway_id', $gateway->id)->first();

        if (!$payment) {
            Log::warning('Stripe webhook payment log was not found.', [
                'gateway_id' => $gateway->id,
                'transaction' => $trx,
                'event_id' => (string) ($event->id ?? ''),
            ]);

            return response()->json(['received' => true]);
        }

        if ($payment->status === 'approved') {
            return response()->json(['received' => true, 'processed' => true]);
        }

        $exchangeRate = (float) ($gateway->currency?->exchange_rate ?? 1);
        $exchangeRate = $exchangeRate > 0 ? $exchangeRate : 1;
        $expectedAmount = (int) round((float) $payment->payable_amount * $exchangeRate * 100);
        $actualAmount = (int) ($session->amount_total ?? -1);
        $expectedCurrency = strtolower((string) ($gateway->currency?->code ?? 'usd'));
        $actualCurrency = strtolower((string) ($session->currency ?? ''));
        $metadataPaymentLogId = (string) data_get($metadata, 'payment_log_id', '');
        $matchesReference =
            (string) ($session->client_reference_id ?? '') === (string) $payment->trx
            || $metadataPaymentLogId === (string) $payment->id;

        if (!$matchesReference || abs($actualAmount - $expectedAmount) > 1 || $actualCurrency !== $expectedCurrency) {
            Log::warning('Stripe webhook payment verification failed.', [
                'payment_log_id' => $payment->id,
                'event_id' => (string) ($event->id ?? ''),
                'expected_amount' => $expectedAmount,
                'actual_amount' => $actualAmount,
                'expected_currency' => $expectedCurrency,
                'actual_currency' => $actualCurrency,
            ]);

            return response()->json(['message' => 'Stripe payment verification failed.'], 422);
        }

        $paymentPayload = is_array($payment->payment_payload) ? $payment->payment_payload : [];
        $paymentPayload['provider_verification'] = [
            'gateway' => 'stripe',
            'verified_at' => now()->toDateTimeString(),
            'event_id' => (string) ($event->id ?? ''),
            'session_id' => (string) ($session->id ?? ''),
            'payment_intent' => (string) ($session->payment_intent ?? ''),
            'payment_status' => (string) ($session->payment_status ?? ''),
        ];
        $payment->persistGatewayAttributes([
            'payment_payload' => $paymentPayload,
            'remarks' => 'Stripe webhook payment verified successfully.',
            'gateway_txn_id' => (string) ($session->payment_intent ?? $session->id ?? ''),
        ]);
        $payment->setRelation('gateway', $gateway);

        $result = self::operationsAfterCompletingPayment($payment);

        return response()->json([
            'received' => true,
            'processed' => (bool) ($result['status'] ?? false),
        ], ($result['status'] ?? false) ? 200 : 500);
    }

    public static function operationsAfterCompletingPayment(PlanPaymentLog $payment): array
    {
        DB::beginTransaction();
        try {
            $payment = PlanPaymentLog::query()->where('id', $payment->id)->lockForUpdate()->first();
            if (!$payment) {
                DB::rollBack();
                return ['status' => false, 'message' => 'Payment not found'];
            }

            if ($payment->status === 'approved') {
                DB::rollBack();
                return ['status' => true, 'message' => 'Already processed'];
            }

            $payment->status = 'approved';
            $payment->remarks = 'Gateway callback success.';
            $payment->save();

            $company = Company::query()->where('company_id', $payment->company_id)->first();
            if ($company) {
                $payload = is_array($payment->payment_payload) ? $payment->payment_payload : [];
                $company->loadMissing('saasPlan');
                $hasActivePlan = !empty($company->saas_plan_id)
                    && !empty($company->plan_subscribed_at)
                    && !empty($company->saasPlan)
                    && (bool) ($company->saasPlan->status ?? false);

                if (($payload['purchase_type'] ?? null) !== 'template' || !$hasActivePlan) {
                    $company->saas_plan_id = (int) $payment->saas_plan_id;
                    $company->plan_subscribed_at = now();
                }

                if (($payload['purchase_type'] ?? null) === 'template') {
                    CompanyETemplateAccess::query()->updateOrCreate(
                        ['company_id' => $company->company_id, 'template_id' => (int) ($payload['template_id'] ?? 0)],
                        ['plan_payment_log_id' => $payment->id, 'amount' => (float) ($payload['template_amount'] ?? 0)]
                    );
                    $company->selected_e_template_id = !empty($payload['template_id'])
                        ? (int) $payload['template_id']
                        : $company->selected_e_template_id;

                    if (!empty($payload['category_id'])) {
                        $company->ecommerce_category_id = (int) $payload['category_id'];
                    }
                }

                if (($payload['purchase_type'] ?? null) === 'plan') {
                    $templatePrices = is_array($payload['template_prices'] ?? null) ? $payload['template_prices'] : [];
                    $templateIds = collect($payload['template_ids'] ?? [])
                        ->filter(fn ($id) => is_numeric($id))
                        ->map(fn ($id) => (int) $id)
                        ->unique()
                        ->values();

                    foreach ($templateIds as $templateId) {
                        CompanyETemplateAccess::query()->updateOrCreate(
                            ['company_id' => $company->company_id, 'template_id' => $templateId],
                            ['plan_payment_log_id' => $payment->id, 'amount' => (float) ($templatePrices[(string) $templateId] ?? 0)]
                        );
                    }

                    if ($templateIds->isNotEmpty()) {
                        $company->selected_e_template_id = $templateIds->first();
                        if (!empty($payload['category_id'])) {
                            $company->ecommerce_category_id = (int) $payload['category_id'];
                        }
                        $company->ecommerce_setup_completed_at = now();
                        $company->save();
                        app(StorefrontHomeBuilderService::class)->materializeSelectedTemplateForCompany($company);
                    }
                }

                $company->save();
                if (($payload['purchase_type'] ?? null) === 'template') {
                    app(StorefrontHomeBuilderService::class)->materializeSelectedTemplateForCompany($company);
                }
                if (
                    filter_var($payload['seed_demo_data'] ?? false, FILTER_VALIDATE_BOOLEAN)
                    && !empty($company->selected_e_template_id)
                    && !empty($company->ecommerce_category_id)
                ) {
                    app(EcommerceDemoDataSyncService::class)->syncForCompanyAndCategory(
                        (int) $company->ecommerce_category_id,
                        $company->company_id
                    );
                }
                app(CompanyPlanFeatureService::class)->syncCompanyPreferencesToPlan($company->fresh('saasPlan'));
                app(BackofficeCompanyService::class)->ensureDefaultRights($company);
                if (($payload['purchase_type'] ?? null) !== 'template' || !$hasActivePlan) {
                    app(ReferralService::class)->awardActivationRewards($company->fresh(), $payment, (float) $payment->amount);
                }
            }

            self::notifyBackofficePlanPaymentStatus($payment, 'approved');

            DB::commit();
            return ['status' => true, 'message' => 'Payment completed successfully'];
        } catch (\Throwable $exception) {
            DB::rollBack();

            Log::error('Plan payment post-processing failed.', [
                'payment_log_id' => $payment->id ?? null,
                'trx' => $payment->trx ?? null,
                'company_id' => $payment->company_id ?? null,
                'exception' => $exception,
            ]);

            return ['status' => false, 'message' => 'Payment processing failed'];
        }
    }

    public static function redirectCancel(PlanPaymentLog $payment): array
    {
        $payment->status = 'rejected';
        $payment->remarks = 'Gateway callback canceled.';
        $payment->save();

        self::notifyBackofficePlanPaymentStatus($payment, 'rejected');

        return ['status' => true, 'message' => 'Payment canceled'];
    }

    private static function notifyBackofficePlanPaymentStatus(PlanPaymentLog $payment, string $status): void
    {
        $payment->loadMissing(['company:company_id,name', 'plan:id,name']);

        $superAdmins = User::query()
            ->where('is_super_admin', 1)
            ->orWhereIn('role', User::getSuperAdminRoles())
            ->get();

        if ($superAdmins->isEmpty()) {
            return;
        }

        $title = $status === 'approved'
            ? 'Plan payment approved'
            : 'Plan payment canceled';

        $message = sprintf(
            '%s payment for %s has been %s.',
            (string) ($payment->company?->name ?: 'A company'),
            (string) ($payment->plan?->name ?: 'selected plan'),
            $status === 'approved' ? 'approved' : 'canceled'
        );

        $payload = [
            'event' => 'plan_payment_' . $status,
            'title' => $title,
            'message' => $message,
            'payment_log_id' => $payment->id,
            'trx' => $payment->trx,
            'company_id' => $payment->company_id,
            'company_name' => $payment->company?->name,
            'plan_name' => $payment->plan?->name,
            'gateway_name' => $payment->gateway_name,
            'payable_amount' => (float) $payment->payable_amount,
            'status' => (string) $payment->status,
            'created_at' => now()->toDateTimeString(),
        ];

        foreach ($superAdmins as $admin) {
            try {
                DB::table('notifications')->insert([
                    'id' => (string) Str::uuid(),
                    'type' => 'App\\Notifications\\BackofficePlanPaymentSubmitted',
                    'notifiable_type' => User::class,
                    'notifiable_id' => (string) $admin->getKey(),
                    'data' => json_encode($payload, JSON_UNESCAPED_UNICODE),
                    'read_at' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } catch (\Throwable $exception) {
                // Keep payment callback flow safe.
            }
        }
    }

    private function frontendUrl(string $path, ?PlanPaymentLog $payment = null): string
    {
        $payloadFrontend = $payment?->payment_payload['frontend_url'] ?? null;
        $configuredFrontend = env('APP_FRONTEND_URL');
        $frontend = $this->validFrontendUrl($payloadFrontend)
            ?? $this->validFrontendUrl($configuredFrontend)
            ?? rtrim((string) config('app.url'), '/');

        return $frontend . $path;
    }

    private function successRedirectPath(PlanPaymentLog $payment): string
    {
        $payload = is_array($payment->payment_payload) ? $payment->payment_payload : [];

        $requestedPath = $this->sanitizeFrontendPath($payload['post_payment_redirect'] ?? null);
        if ($requestedPath) {
            if (str_starts_with($requestedPath, '/store-setup')) {
                return '/subscription/overview?plan_payment=success';
            }

            return $requestedPath;
        }

        $company = Company::query()
            ->select(['company_id', 'selected_e_template_id', 'ecommerce_setup_completed_at'])
            ->where('company_id', $payment->company_id)
            ->first();

        if ($company && ($company->selected_e_template_id || $company->ecommerce_setup_completed_at)) {
            return '/subscription/overview?plan_payment=success';
        }

        $seedDemoData = filter_var($payload['seed_demo_data'] ?? false, FILTER_VALIDATE_BOOLEAN) ? '1' : '0';

        return '/onboarding/ecommerce-template?plan_payment=success&seed_demo_data=' . $seedDemoData;
    }

    private function sanitizeFrontendPath(?string $path): ?string
    {
        if (!is_string($path)) {
            return null;
        }

        $path = trim($path);

        if (
            $path === ''
            || !str_starts_with($path, '/')
            || str_starts_with($path, '//')
            || str_contains($path, '\\')
            || preg_match('/[\r\n]/', $path)
            || filter_var($path, FILTER_VALIDATE_URL)
        ) {
            return null;
        }

        return $path;
    }

    private function validFrontendUrl(?string $url): ?string
    {
        if (!is_string($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
            return null;
        }

        return rtrim($url, '/');
    }
}
