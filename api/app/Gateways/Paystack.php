<?php
namespace App\Gateways;
use Illuminate\Validation\ValidationException;
use App\Contracts\PaymentGateway;
use Illuminate\Support\Facades\Http;

class Paystack implements PaymentGateway
{
    function process($payloads, $type)
    {
        if (!$payloads->gateway->parameters) {
            throw ValidationException::withMessages([
                'error' => 'No Api key Found',
            ]);
        }

        $method = $payloads->gateway;
        $secretKey = $method->parameters['secret_key'] ?? null;

        if (!$secretKey) {
            throw ValidationException::withMessages([
                'gateway' => ['Paystack secret key is missing.'],
            ]);
        }

        $exchangeRate = (float) ($method?->currency?->exchange_rate ?? 1);
        if ($exchangeRate <= 0) {
            $exchangeRate = 1;
        }

        $amount = (int) round(((float) ($payloads->payable_amount ?? $payloads->final_amount ?? 0) * $exchangeRate) * 100);

        if ($amount < 1) {
            throw ValidationException::withMessages([
                'gateway' => ['Invalid Paystack amount. Please verify plan price and gateway currency exchange rate.'],
            ]);
        }

        try {
            $response = Http::withToken($secretKey)->post('https://api.paystack.co/transaction/initialize', [
                'email' => $payloads->user?->email ?? 'customer@example.com',
                'amount' => $amount,
                'currency' => strtoupper($method->currency->code ?? 'NGN'),
                'reference' => $payloads->trx,
                'callback_url' => route($type . '-success', $payloads->trx),
                'metadata' => [
                    'payment_log_id' => $payloads->id ?? null,
                    'company_id' => $payloads->company_id ?? null,
                    'cancel_action' => route($type . '-cancel', $payloads->trx),
                ],
            ]);
        } catch (\Throwable $th) {
            throw ValidationException::withMessages([
                'gateway' => [config('app.debug')
                    ? ($th->getMessage() ?: 'Paystack initialization failed.')
                    : 'This payment method is temporarily unavailable. Please try another option.'],
            ]);
        }

        $data = $response->json();
        $authorizationUrl = $data['data']['authorization_url'] ?? null;

        if (!$response->successful() || empty($authorizationUrl)) {
            $message = $data['message'] ?? 'This payment method is temporarily unavailable. Please try another option.';
            if (str_contains(strtolower((string) $message), 'currency not supported')) {
                $message = sprintf(
                    '%s Current Paystack gateway currency is %s. Update Paystack gateway currency to a currency supported by this merchant account.',
                    $message,
                    strtoupper($method->currency->code ?? 'N/A')
                );
            }

            throw ValidationException::withMessages([
                'gateway' => [$message],
            ]);
        }

        return ['type' => 'redirect', 'url' => $authorizationUrl];
    }

    function paymentCheck($method, $request)
    {
        $secret_key = $method->parameters['secret_key'];

        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => "https://api.paystack.co/transaction/verify/$request->reference",
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_ENCODING => '',
            CURLOPT_MAXREDIRS => 10,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_SSL_VERIFYPEER => 1,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_CUSTOMREQUEST => 'GET',
            CURLOPT_HTTPHEADER => ["Authorization: Bearer $secret_key", 'Cache-Control: no-cache'],
        ]);
        $response = curl_exec($curl);
        $err = curl_error($curl);
        curl_close($curl);

        $final_data = json_decode($response);

        return $final_data;
    }

    function cancel($payloads, $controller)
    {
        return $controller::redirectCancel($payloads);
    }

    function success($payloads, $controller)
    {
        $reference = request()->query('reference', $payloads->trx);
        if ((string) $reference !== (string) $payloads->trx) {
            return ['status' => false, 'message' => 'Paystack payment reference mismatch'];
        }

        $response = $this->paymentCheck($payloads->gateway, (object) ['reference' => $reference]);
        $exchangeRate = (float) ($payloads->gateway?->currency?->exchange_rate ?? 1);
        if ($exchangeRate <= 0) {
            $exchangeRate = 1;
        }

        $expectedAmount = (int) round(((float) ($payloads->payable_amount ?? 0) * $exchangeRate) * 100);
        $expectedCurrency = strtoupper((string) ($payloads->gateway?->currency?->code ?? 'NGN'));

        if (
            ($response->status ?? false) !== true
            || ($response->data->status ?? null) !== 'success'
            || (string) ($response->data->reference ?? '') !== (string) $payloads->trx
            || (int) ($response->data->amount ?? -1) !== $expectedAmount
            || strtoupper((string) ($response->data->currency ?? '')) !== $expectedCurrency
        ) {
            return ['status' => false, 'message' => 'Paystack payment verification failed'];
        }

        $paymentPayload = is_array($payloads->payment_payload) ? $payloads->payment_payload : [];
        $paymentPayload['provider_verification'] = [
            'gateway' => 'paystack',
            'verified_at' => now()->toDateTimeString(),
            'reference' => (string) ($response->data->reference ?? ''),
            'status' => (string) ($response->data->status ?? ''),
            'paid_at' => (string) ($response->data->paid_at ?? ''),
            'channel' => (string) ($response->data->channel ?? ''),
        ];
        $payloads->payment_payload = $paymentPayload;
        $payloads->persistGatewayAttributes([
            'payment_payload' => $paymentPayload,
            'remarks' => 'Paystack verification succeeded.',
            'gateway_txn_id' => (string) ($response->data->reference ?? ''),
        ]);

        return $controller::operationsAfterCompletingPayment($payloads);
    }
}
