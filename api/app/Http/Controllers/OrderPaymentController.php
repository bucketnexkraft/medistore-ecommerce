<?php

namespace App\Http\Controllers;

use App\Factory\PaymentGatewayFactory;
use App\Models\CustomerOrder;
use App\Models\Gateway;
use App\Services\Api\CustomerOrderService;

class OrderPaymentController extends Controller
{
    public function __construct(private readonly CustomerOrderService $customerOrderService)
    {
    }

    public function paymentSuccess(string $trx)
    {
        $order = $this->findOrderByTransaction($trx);

        if ($order->payment_status === 'paid') {
            return redirect($this->frontendUrl($order, '/order-success'));
        }

        $gateway = $this->resolveGateway($order);
        $this->hydrateGatewayOrderContext($order, $gateway);

        $response = PaymentGatewayFactory::create($gateway->name)->success($order, static::class);

        if (($response['status'] ?? false) === true) {
            return redirect($this->frontendUrl($order, '/order-success'));
        }

        return redirect($this->frontendUrl($order, '/payment-failed'));
    }

    public function paymentCancel(string $trx)
    {
        $order = $this->findOrderByTransaction($trx);
        $gateway = $this->resolveGateway($order);
        $this->hydrateGatewayOrderContext($order, $gateway);

        $response = PaymentGatewayFactory::create($gateway->name)->cancel($order, static::class);

        if (($response['status'] ?? false) === true) {
            return redirect($this->frontendUrl($order, '/payment-cancel'));
        }

        return redirect($this->frontendUrl($order, '/payment-failed'));
    }

    public static function operationsAfterCompletingPayment(CustomerOrder $order): array
    {
        return app(CustomerOrderService::class)->completeGatewayOrderPayment($order);
    }

    public static function redirectCancel(CustomerOrder $order): array
    {
        return app(CustomerOrderService::class)->cancelGatewayOrderPayment($order);
    }

    private function findOrderByTransaction(string $trx): CustomerOrder
    {
        return CustomerOrder::query()
            ->where('order_no', $trx)
            ->with(['user', 'items'])
            ->firstOrFail();
    }

    private function resolveGateway(CustomerOrder $order): Gateway
    {
        return Gateway::query()
            ->with('currency')
            ->whereRaw('LOWER(name) = ?', [strtolower((string) $order->payment_method)])
            ->firstOrFail();
    }

    private function hydrateGatewayOrderContext(CustomerOrder $order, Gateway $gateway): void
    {
        $order->setRelation('gateway', $gateway);
        $order->payable_amount = (float) $order->total_amount;
        $order->trx = (string) $order->order_no;
        $paymentPayload = is_array($order->payment_payload) ? $order->payment_payload : [];
        $paymentPayload['frontend_url'] = $this->resolveFrontendBaseUrl($order);
        $order->payment_payload = $paymentPayload;
    }

    private function frontendUrl(CustomerOrder $order, string $path): string
    {
        $frontend = $this->resolveFrontendBaseUrl($order)
            ?? rtrim((string) config('app.url'), '/');

        return $frontend . $path;
    }

    private function resolveFrontendBaseUrl(CustomerOrder $order): ?string
    {
        $paymentPayload = is_array($order->payment_payload) ? $order->payment_payload : [];
        $storedFrontend = $this->validFrontendUrl($paymentPayload['frontend_url'] ?? null);

        if ($storedFrontend) {
            return $storedFrontend;
        }

        return $this->validFrontendUrl(env('APP_FRONTEND_URL'));
    }

    private function validFrontendUrl(?string $url): ?string
    {
        if (!is_string($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
            return null;
        }

        return rtrim($url, '/');
    }
}
