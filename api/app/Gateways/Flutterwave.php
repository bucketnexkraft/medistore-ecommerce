<?php

namespace App\Gateways;

use App\Contracts\PaymentGateway;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Http;

class Flutterwave implements PaymentGateway
{
    function process($payloads, $type)
    {
        if(!$payloads->gateway->parameters){
            throw ValidationException::withMessages([
                'error' => 'No Api key Found',
            ]);
        }

        $method = $payloads->gateway;
        $secretKey = $method->parameters['secret_key'] ?? null;

        if (!$secretKey) {
            throw ValidationException::withMessages([
                'gateway' => ['Flutterwave secret key is missing.'],
            ]);
        }

        $exchangeRate = (float) ($method?->currency?->exchange_rate ?? 1);
        if ($exchangeRate <= 0) {
            $exchangeRate = 1;
        }

        $amount = number_format((float) ($payloads->payable_amount ?? $payloads->final_amount ?? 0) * $exchangeRate, 2, '.', '');

        if ((float) $amount <= 0) {
            throw ValidationException::withMessages([
                'gateway' => ['Invalid Flutterwave amount. Please verify plan price and gateway currency exchange rate.'],
            ]);
        }

        $user = $payloads->user;
        $name = trim((string) ($user?->first_name . ' ' . $user?->last_name)) ?: 'Customer';

        try {
            $response = Http::withToken($secretKey)->post('https://api.flutterwave.com/v3/payments', [
                'tx_ref' => $payloads->trx,
                'amount' => $amount,
                'currency' => strtoupper($method->currency->code ?? 'USD'),
                'redirect_url' => route($type . '-success', $payloads->trx),
                'customer' => [
                    'email' => $user?->email ?? 'customer@example.com',
                    'phonenumber' => $user?->phone ?? '',
                    'name' => $name,
                ],
                'customizations' => [
                    'title' => 'Plan Payment',
                    'description' => 'SaaS plan payment',
                ],
                'meta' => [
                    'payment_log_id' => $payloads->id ?? null,
                    'company_id' => $payloads->company_id ?? null,
                    'cancel_url' => route($type . '-cancel', $payloads->trx),
                ],
            ]);
        } catch (\Throwable $th) {
            throw ValidationException::withMessages([
                'gateway' => [config('app.debug')
                    ? ($th->getMessage() ?: 'Flutterwave initialization failed.')
                    : 'This payment method is temporarily unavailable. Please try another option.'],
            ]);
        }

        $data = $response->json();
        $paymentLink = $data['data']['link'] ?? null;

        if (!$response->successful() || empty($paymentLink)) {
            throw ValidationException::withMessages([
                'gateway' => [$data['message'] ?? 'This payment method is temporarily unavailable. Please try another option.'],
            ]);
        }

        return ['type' => 'redirect', 'url' => $paymentLink];
    }

    function paymentCheck($payloads, $request)
    {
        $curl = curl_init();
        $tnx_id = $request->tnx_id;
        $url = "https://api.flutterwave.com/v3/transactions/$tnx_id/verify";
        $token = $payloads->gateway->parameters['secret_key'] ?? null;
        curl_setopt_array($curl, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_ENCODING => '',
            CURLOPT_MAXREDIRS => 10,
            CURLOPT_TIMEOUT => 0,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_CUSTOMREQUEST => 'GET',
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', "Authorization: Bearer $token"],
        ]);

        $response = curl_exec($curl);

        curl_close($curl);

        $response = json_decode($response);

        return $response;
    }

    function success($payloads, $controller)
    {
       $transactionId = request()->query('transaction_id') ?: request()->query('tx_ref');
       if (!$transactionId) {
           return ['status' => false, 'message' => 'Flutterwave transaction id missing'];
       }

       $response = $this->paymentCheck($payloads, (object) ['tnx_id' => $transactionId]);
       if (($response->status ?? null) !== 'success' || ($response->data->status ?? null) !== 'successful') {
           return ['status' => false, 'message' => 'Flutterwave payment verification failed'];
       }

       return $controller::operationsAfterCompletingPayment($payloads);
    }

    function cancel($payloads, $controller)
    {
        return $controller::redirectCancel($payloads);
    }
}
