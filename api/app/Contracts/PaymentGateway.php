<?php
namespace App\Contracts;

interface PaymentGateway {
    public function process($payloads, $type);
    public function success($payloads, $controller);
    public function cancel($payloads, $controller);
}
