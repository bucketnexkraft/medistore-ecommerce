<?php

namespace App\Gateways;

use App\Contracts\PaymentGateway;

class Bank implements PaymentGateway
{
    public function process($payloads, $type, $data = [])
    {

        $gateway = $payloads->gateway;
        
        if ($type === 'organizer.payment') {
            $payloads->payment_status = 'pending';
            $payloads->save();
            notify_admin('A new payment request has been made', route('admin.subscriptions'), $payloads->organizer);
            return [
                'type' => 'redirect',
                'url' => route('organizer.dashboard'),
            ];
        }

        if ($type === 'payment') {
            $payloads->status = 'pending';
            $payloads->payment_proof = $data;
            $payloads->save();
            notify_admin('A new payment request has been made', route('admin.payments.index'), $payloads->user);
            return [
                'type' => 'redirect',
                'url' => route('payment-complete', $payloads->trx),
            ];
        }
    }

    function success($payloads, $controller)
    {
        return $controller::operationsAfterCompletingPayment($payloads);
    }
    function cancel($payloads, $controller)
    {
        return $controller::redirectCancel($payloads);
    }
}
