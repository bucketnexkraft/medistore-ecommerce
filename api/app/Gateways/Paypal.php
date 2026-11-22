<?php

namespace App\Gateways;

use App\Contracts\PaymentGateway;
use Illuminate\Validation\ValidationException;
use Srmklive\PayPal\Services\PayPal as PayPalClient;
class Paypal implements PaymentGateway
{
    private function resolveSuccessRoute(string $controller, string $trx): string
    {
        $callbackType = str_contains(ltrim($controller, '\\'), 'OrderPaymentController') ? 'order-payment' : 'plan-payment';

        return route($callbackType . '-success', $trx);
    }

    function process($payloads, $type)
    {
        $gateway = $payloads->gateway;

        $exchangeRate = (float) ($payloads->gateway?->currency?->exchange_rate ?? 1);
        if ($exchangeRate <= 0) {
            $exchangeRate = 1;
        }

        $amount = (float) ($payloads->payable_amount ?? $payloads->final_amount ?? 0) * $exchangeRate;

        $amount = number_format((float) $amount, 2, '.', '');

        $this->configurePaypal($gateway, route($type . '-success', $payloads->trx));


        try {
            $provider = new PayPalClient();
    
            $paypalToken = $provider->getAccessToken();
    
    
            $response = $provider->createOrder([
                'intent' => 'CAPTURE',
                'application_context' => [
                    'return_url' => route($type . '-success', $payloads->trx),
                    'cancel_url' => route($type . '-cancel', $payloads->trx),
                ],
                'purchase_units' => [
                    0 => [
                        'amount' => [
                            'currency_code' => strtoupper($gateway->currency->code),
                            'value' => $amount,
                        ],
                    ],
                ],
            ]);
    
    
    
            if (isset($response['id']) && $response['id'] != null) {
                foreach ($response['links'] as $links) {
                    if ($links['rel'] == 'approve') {
                        return [
                            'type' => 'redirect',
                            'url' => $links['href'],
                        ];
                    }
                }
            }

            throw ValidationException::withMessages([
                'gateway' => ['PayPal approval link could not be created. Please verify the PayPal gateway configuration.']
            ]);
        } catch (\Throwable $th) {
            throw ValidationException::withMessages([
                'gateway' => [config('app.debug')
                    ? ($th->getMessage() ?: 'PayPal initialization failed.')
                    : 'This payment method is temporarily unavailable. Please try another option.']
            ]);
        }
    }

    function success($payloads, $controller)
    {
        $orderId = request()->query('token');

        if (!$orderId) {
            return ['status' => false, 'message' => 'PayPal order token missing'];
        }

        try {
            $this->configurePaypal($payloads->gateway, $this->resolveSuccessRoute($controller, (string) $payloads->trx));
            $provider = new PayPalClient();
            $provider->getAccessToken();
            $response = $provider->capturePaymentOrder($orderId);

            if (($response['status'] ?? null) !== 'COMPLETED') {
                return ['status' => false, 'message' => 'PayPal payment was not completed'];
            }
        } catch (\Throwable $th) {
            return ['status' => false, 'message' => 'PayPal payment verification failed'];
        }

        return $controller::operationsAfterCompletingPayment($payloads);
    }

    function cancel($payloads, $controller)
    {
        return $controller::redirectCancel($payloads);
    }

    private function configurePaypal($gateway, string $notifyUrl): void
    {
        config([
            'paypal.mode' => config('app.env') === 'local' ? 'sandbox' : 'live',
            'paypal.sandbox.client_id' => $gateway->parameters['client_id'] ?? '',
            'paypal.sandbox.client_secret' => $gateway->parameters['secret'] ?? '',
            'paypal.live.client_id' => $gateway->parameters['client_id'] ?? '',
            'paypal.live.client_secret' => $gateway->parameters['secret'] ?? '',
            'paypal.sandbox.app_id' => 'APP-80W284485P519543T',
            'paypal.payment_action' => 'Sale',
            'paypal.currency' => $gateway->currency->code ?? 'USD',
            'paypal.notify_url' => $notifyUrl,
            'paypal.locale' => 'en_US',
            'paypal.validate_ssl' => true,
        ]);
    }
}
