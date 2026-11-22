<?php

namespace App\Factory;

use App\Contracts\PaymentGateway;
use App\Gateways\Bank;
use App\Gateways\Flutterwave;
use App\Gateways\Paypal;
use App\Gateways\Paytm;
use App\Gateways\SSLCommerz;
use App\Gateways\Stripe;
use App\Gateways\Paystack;
class PaymentGatewayFactory
{
    public static function create(string $gateway): PaymentGateway
    {
        $class = match (strtolower($gateway)) {
            'stripe' => Stripe::class,
            'sslcommerz' => SSLCommerz::class,
            'paypal' => Paypal::class,
            'bank' => Bank::class,
            'paystack' => Paystack::class,
            'flutterwave' => Flutterwave::class,
            default => throw new \InvalidArgumentException("Payment gateway [{$gateway}] not found."),
        };

        $instance = new $class();

        if (!($instance instanceof PaymentGateway)) {
            throw new \RuntimeException("Gateway [{$gateway}] must implement PaymentGateway interface.");
        }

        return $instance;
    }
}
