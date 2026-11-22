<?php

namespace App\Gateways;

use App\Contracts\PaymentGateway;
use App\Gateways\Lib\SslCommerz\SslCommerzNotification;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Http;


class SSLCommerz implements PaymentGateway
{
    private function validUrl(?string $url): ?string
    {
        if (!is_string($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
            return null;
        }

        return rtrim($url, '/');
    }

    private function isLocalHost(?string $host): bool
    {
        $normalizedHost = strtolower((string) $host);

        return in_array($normalizedHost, ['127.0.0.1', 'localhost'], true);
    }

    private function forceHttps(string $url): string
    {
        return preg_replace('/^http:/i', 'https:', $url) ?? $url;
    }

    private function callbackBaseUrl($payloads): string
    {
        $appUrl = $this->validUrl((string) config('app.url'));
        $frontendUrl = $this->validUrl(
            is_array($payloads->payment_payload ?? null) ? ($payloads->payment_payload['frontend_url'] ?? null) : null
        );

        $baseUrl = $appUrl;

        if ((!$baseUrl || $this->isLocalHost(parse_url($baseUrl, PHP_URL_HOST))) && $frontendUrl) {
            $baseUrl = $frontendUrl;
        }

        if (!$baseUrl) {
            $baseUrl = url('/');
        }

        $frontendHost = parse_url((string) $frontendUrl, PHP_URL_HOST);
        $baseHost = parse_url((string) $baseUrl, PHP_URL_HOST);
        $frontendScheme = parse_url((string) $frontendUrl, PHP_URL_SCHEME);

        if (
            $frontendScheme === 'https'
            && is_string($frontendHost)
            && is_string($baseHost)
            && strtolower($frontendHost) === strtolower($baseHost)
        ) {
            return $this->forceHttps($baseUrl);
        }

        if (!$this->isLocalHost($baseHost) && parse_url((string) $baseUrl, PHP_URL_SCHEME) === 'http') {
            return $this->forceHttps($baseUrl);
        }

        return $baseUrl;
    }

    private function resolveCallbackType(string $controller): string
    {
        return str_contains(ltrim($controller, '\\'), 'OrderPaymentController') ? 'order-payment' : 'plan-payment';
    }

    private function callbackUrl($payloads, string $status): string
    {
        return $this->callbackBaseUrl($payloads) . '/api/v1/landing/order-payments/' . urlencode((string) $payloads->trx) . '/' . $status;
    }

    private function configureGateway($payloads, $type): void
    {
        $successUrl = $type === 'order-payment'
            ? $this->callbackUrl($payloads, 'success')
            : route($type . '-success', $payloads->trx);
        $cancelUrl = $type === 'order-payment'
            ? $this->callbackUrl($payloads, 'cancel')
            : route($type . '-cancel', $payloads->trx);

        config([
            'sslcommerz.mode' => config('app.env') === 'local' ? 'sandbox' : 'live',
            'sslcommerz.apiCredentials.store_id' => $payloads->gateway->parameters['store_id'],
            'sslcommerz.apiCredentials.store_password' => $payloads->gateway->parameters['store_password'],
            'sslcommerz.apiDomain' => config('app.env') === 'local' ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com',
            'sslcommerz.connect_from_localhost' => config('app.env') === 'local' ? true : false,
            'sslcommerz.success_url' => $successUrl,
            'sslcommerz.failed_url' => $cancelUrl,
            'sslcommerz.cancel_url' => $cancelUrl,
            'sslcommerz.ipn_url' => $successUrl,
        ]);
    }

    function process($payloads, $type)
    {
        $storeId = $payloads->gateway->parameters['store_id'] ?? null;
        $storePassword = $payloads->gateway->parameters['store_password'] ?? null;

        if (!is_string($storeId) || trim($storeId) === '') {
            throw ValidationException::withMessages([
                'gateway' => ['SSLCommerz store id is missing. Please update the SSLCommerz gateway configuration.'],
            ]);
        }

        if (!is_string($storePassword) || trim($storePassword) === '') {
            throw ValidationException::withMessages([
                'gateway' => ['SSLCommerz store password is missing. Please update the SSLCommerz gateway configuration.'],
            ]);
        }

        $user = $payloads->user ?? $payloads->organizer ?? null;

        $amount = (float) ($payloads->payable_amount ?? $payloads->final_amount ?? 0);

        $post_data = [];
        $post_data['total_amount'] = $amount;
        $post_data['currency'] = strtoupper($payloads->gateway->currency->code);
        $post_data['tran_id'] = $payloads->trx;
        # CUSTOMER INFORMATION
        $post_data['cus_name'] = trim((string) ($user?->first_name . ' ' . $user?->last_name)) ?: 'Customer';
        $post_data['cus_email'] = $user?->email ?? 'customer@example.com';
        $post_data['cus_add1'] = '';
        $post_data['cus_add2'] = '';
        $post_data['cus_city'] = '';
        $post_data['cus_state'] = '';
        $post_data['cus_postcode'] = '';
        $post_data['cus_country'] = '';
        $post_data['cus_phone'] = $user?->phone ?? '123456';
        $post_data['cus_fax'] = '';

        # SHIPMENT INFORMATION
        $basicSettings = settings('basic');
        $post_data['ship_name'] = $basicSettings->sitename ?? config('app.name', 'stoqio');
        $post_data['ship_add1'] = 'Dhaka';
        $post_data['ship_add2'] = 'Dhaka';
        $post_data['ship_city'] = 'Dhaka';
        $post_data['ship_state'] = 'Dhaka';
        $post_data['ship_postcode'] = '';
        $post_data['ship_phone'] = '';
        $post_data['ship_country'] = 'Bangladesh';

        $post_data['shipping_method'] = 'NO';
        $post_data['product_name'] = 'Deposit';
        $post_data['product_category'] = 'Deposit';
        $post_data['product_profile'] = 'add Balance';

        $this->configureGateway($payloads, $type);
        $successUrl = $type === 'order-payment'
            ? $this->callbackUrl($payloads, 'success')
            : route($type . '-success', $payloads->trx);
        $cancelUrl = $type === 'order-payment'
            ? $this->callbackUrl($payloads, 'cancel')
            : route($type . '-cancel', $payloads->trx);
        
        $post_data['store_id']     = $storeId;
        $post_data['store_passwd'] = $storePassword;
        $post_data['success_url'] = $successUrl;
        $post_data['fail_url']    = $cancelUrl;
        $post_data['cancel_url']  = $cancelUrl;
        $post_data['ipn_url']     = $successUrl;

        
        $sslc = new SslCommerzNotification();
        
        $response = Http::asForm()->post(config('sslcommerz.apiDomain').'/gwprocess/v4/api.php', $post_data);

        $data = $response->json();
		
        
        if(($data['status'] ?? null) === 'SUCCESS'){
            return [
                'type' => 'redirect',
                'url' => $data['GatewayPageURL'],
            ];
        }
		
        if(($data['status'] ?? null) === 'FAILED'){
			 throw ValidationException::withMessages([
				'error' => $data['failedreason'] ?? '',
			]);
		}
        
         throw ValidationException::withMessages([
            'error' => config('app.debug')
                ? (($data['failedreason'] ?? $data['status'] ?? '') ?: 'SSLCommerz initialization failed.')
                : 'This payment method is temporarily unavailable. Please try another option.',
        ]);
        
    }

    function success($payloads, $controller) {
        if (!request()->isMethod('post')) {
            return ['status' => false, 'message' => 'SSLCommerz callback must be POSTed by the provider'];
        }

        if ((string) request()->input('tran_id') !== (string) $payloads->trx) {
            return ['status' => false, 'message' => 'SSLCommerz transaction reference mismatch'];
        }

        $this->configureGateway($payloads, $this->resolveCallbackType($controller));
        $sslc = new SslCommerzNotification();
        $isValid = $sslc->orderValidate(
            request()->post(),
            (string) $payloads->trx,
            (float) ($payloads->payable_amount ?? 0),
            strtoupper((string) ($payloads->gateway?->currency?->code ?? 'BDT'))
        );

        if ($isValid !== true) {
            return ['status' => false, 'message' => 'SSLCommerz payment verification failed'];
        }

        $paymentPayload = is_array($payloads->payment_payload) ? $payloads->payment_payload : [];
        $paymentPayload['provider_verification'] = [
            'gateway' => 'sslcommerz',
            'verified_at' => now()->toDateTimeString(),
            'status' => (string) request()->input('status', ''),
            'val_id' => (string) request()->input('val_id', ''),
            'bank_tran_id' => (string) request()->input('bank_tran_id', ''),
            'card_type' => (string) request()->input('card_type', ''),
        ];
        $payloads->payment_payload = $paymentPayload;
        $payloads->persistGatewayAttributes([
            'payment_payload' => $paymentPayload,
            'remarks' => 'SSLCommerz callback verified successfully.',
            'gateway_txn_id' => (string) request()->input('bank_tran_id', ''),
        ]);

        return $controller::operationsAfterCompletingPayment($payloads);
    }

    function cancel($payloads, $controller) {
        return $controller::redirectCancel($payloads);
    }
}
