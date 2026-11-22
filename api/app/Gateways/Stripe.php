<?php
namespace App\Gateways;

use App\Contracts\PaymentGateway;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;
use Stripe\Stripe as StripePayment;

class Stripe implements PaymentGateway
{
    public function process($payloads, $type)
    {
        $gateway = $payloads->gateway;
        $apiKey = $gateway->parameters['api_key'] ?? null;
        $paymentPayload = is_array($payloads->payment_payload ?? null) ? $payloads->payment_payload : [];
        $frontendBaseUrl = $this->resolveFrontendBaseUrl($paymentPayload['frontend_url'] ?? null);

        if (!is_string($apiKey) || trim($apiKey) === '') {
            throw ValidationException::withMessages([
                'gateway' => ['Stripe API key is missing. Please update the Stripe gateway configuration.'],
            ]);
        }

        StripePayment::setApiKey($apiKey);
        
        $baseAmount = (float) ($payloads->payable_amount ?? 0);
        $exchangeRate = (float) ($payloads->gateway?->currency?->exchange_rate ?? 1);
        if ($exchangeRate <= 0) {
            $exchangeRate = 1;
        }
        $convertedAmount = $baseAmount * $exchangeRate;
        $amount = (int) round($convertedAmount * 100);

        if ($amount < 1) {
            throw ValidationException::withMessages([
                'gateway' => ['Invalid Stripe amount. Please verify plan price and gateway currency exchange rate.']
            ]);
        }

        try {
            $isOrderPayment = $type === 'order-payment';
            $successUrl = $frontendBaseUrl && $isOrderPayment
                ? rtrim($frontendBaseUrl, '/') . '/order-payment-success/' . urlencode((string) $payloads->trx) . '?session_id={CHECKOUT_SESSION_ID}'
                : route($type.'-success', $payloads->trx) . '?session_id={CHECKOUT_SESSION_ID}';
            $cancelUrl = $frontendBaseUrl && $isOrderPayment
                ? rtrim($frontendBaseUrl, '/') . '/order-payment-cancel/' . urlencode((string) $payloads->trx)
                : route($type.'-cancel', $payloads->trx);
            $productName = $isOrderPayment ? 'Order Payment' : 'Plan Subscription';

            $session = \Stripe\Checkout\Session::create([
                'payment_method_types' => ['card'],
                'client_reference_id' => $payloads->trx,
                'metadata' => [
                    'payment_log_id' => (string) ($payloads->id ?? ''),
                    'order_id' => (string) ($payloads->id ?? ''),
                    'order_no' => (string) $payloads->trx,
                    'trx' => (string) $payloads->trx,
                    'company_id' => (string) ($payloads->company_id ?? ''),
                    'saas_plan_id' => (string) ($payloads->saas_plan_id ?? ''),
                ],
                'line_items' => [
                    [
                        'price_data' => [
                            'currency' => strtolower((string) ($gateway->currency->code ?? 'usd')),
                            'product_data' => [
                                'name' => $productName,
                            ],
                            'unit_amount' => $amount,
                        ],
                        'quantity' => 1,
                    ],
                ],
                'mode' => 'payment',
                'success_url' => $successUrl,
                'cancel_url' => $cancelUrl,
            ]);
        } catch (\Throwable $th) {
            throw ValidationException::withMessages([
                'gateway' => [config('app.debug')
                    ? ($th->getMessage() ?: 'Stripe checkout session could not be created.')
                    : 'This payment method is temporarily unavailable. Please try another option.']
            ]);
        }


        return [
            'type' => 'redirect',
            'url' => $session->url,
        ];
    }

    function success($payloads, $controller){
        $sessionId = trim((string) request()->query('session_id', ''));
        $apiKey = $payloads->gateway->parameters['api_key'] ?? null;

        if ($sessionId === '' || !$apiKey) {
            return ['status' => false, 'message' => 'Stripe session verification data is missing'];
        }

        try {
            StripePayment::setApiKey($apiKey);
            $session = \Stripe\Checkout\Session::retrieve($sessionId);
        } catch (\Throwable $th) {
            return ['status' => false, 'message' => 'Stripe session verification failed'];
        }

        $exchangeRate = (float) ($payloads->gateway?->currency?->exchange_rate ?? 1);
        if ($exchangeRate <= 0) {
            $exchangeRate = 1;
        }

        $expectedAmount = (int) round((float) ($payloads->payable_amount ?? 0) * $exchangeRate * 100);
        $expectedCurrency = strtolower((string) ($payloads->gateway?->currency?->code ?? 'usd'));
        $metadata = (array) ($session->metadata ?? []);
        $metadataOrderId = (string) Arr::get($metadata, 'order_id', '');
        $metadataPaymentLogId = (string) Arr::get($metadata, 'payment_log_id', '');
        $metadataOrderNo = (string) Arr::get($metadata, 'order_no', '');
        $metadataTransaction = (string) Arr::get($metadata, 'trx', '');
        $matchesKnownOrderReference =
            $metadataPaymentLogId === (string) $payloads->id
            || $metadataOrderId === (string) $payloads->id
            || $metadataOrderNo === (string) $payloads->trx
            || $metadataTransaction === (string) $payloads->trx;
        $matchesClientReference = (string) ($session->client_reference_id ?? '') === (string) $payloads->trx;
        $actualAmount = (int) ($session->amount_total ?? -1);
        $actualCurrency = strtolower((string) ($session->currency ?? ''));
        $failureReasons = [];

        if (($session->payment_status ?? null) !== 'paid') {
            $failureReasons[] = 'payment status is not paid';
        }

        if (! $matchesClientReference) {
            $failureReasons[] = 'transaction reference did not match';
        }

        if (! $matchesKnownOrderReference && ! $matchesClientReference) {
            $failureReasons[] = 'metadata order reference did not match';
        }

        if (abs($actualAmount - $expectedAmount) > 1) {
            $failureReasons[] = "amount mismatch (expected {$expectedAmount}, got {$actualAmount})";
        }

        if ($actualCurrency !== $expectedCurrency) {
            $failureReasons[] = "currency mismatch (expected {$expectedCurrency}, got {$actualCurrency})";
        }

        if ($failureReasons !== []) {
            return [
                'status' => false,
                'message' => 'Stripe session verification failed: ' . implode('; ', $failureReasons),
            ];
        }

        $paymentPayload = is_array($payloads->payment_payload) ? $payloads->payment_payload : [];
        $paymentPayload['provider_verification'] = [
            'gateway' => 'stripe',
            'verified_at' => now()->toDateTimeString(),
            'session_id' => (string) $session->id,
            'payment_intent' => (string) ($session->payment_intent ?? ''),
            'payment_status' => (string) ($session->payment_status ?? ''),
            'status' => (string) ($session->status ?? ''),
        ];
        $payloads->payment_payload = $paymentPayload;
        $payloads->persistGatewayAttributes([
            'payment_payload' => $paymentPayload,
            'remarks' => 'Stripe session verified successfully.',
            'gateway_txn_id' => (string) ($session->payment_intent ?? $session->id ?? ''),
        ]);

        return $controller::operationsAfterCompletingPayment($payloads);
    }

    function cancel($payloads, $controller){
        return $controller::redirectCancel($payloads);
    }

    private function resolveFrontendBaseUrl(?string $url): ?string
    {
        if (! is_string($url) || ! filter_var($url, FILTER_VALIDATE_URL)) {
            return null;
        }

        return rtrim($url, '/');
    }
}
