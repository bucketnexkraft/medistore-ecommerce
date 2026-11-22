<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomerOrder;
use App\Services\Api\CustomerOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CustomerOrderController extends Controller
{
    public function __construct(private readonly CustomerOrderService $service)
    {
    }

    public function shippingAddresses()
    {
        return $this->service->shippingAddresses();
    }

    public function paymentGateways()
    {
        return $this->service->paymentGateways();
    }

    public function checkoutSettings()
    {
        return $this->service->checkoutSettings();
    }

    public function preview(Request $request)
    {
        return $this->service->preview($request);
    }

    public function publicTrack(Request $request)
    {
        return $this->service->publicTrack($request);
    }

    public function paymentSuccess(Request $request, string $trx)
    {
        $response = $this->service->handleGatewaySuccessCallback($request, $trx);

        return $this->respondToGatewayBrowserCallback($request, $trx, $response, '/order-success');
    }

    public function paymentCancel(Request $request, string $trx)
    {
        $response = $this->service->handleGatewayCancelCallback($trx);

        return $this->respondToGatewayBrowserCallback($request, $trx, $response, '/payment-cancel');
    }

    public function storeShippingAddress(Request $request)
    {
        return $this->service->storeShippingAddressFromProfile($request);
    }

    public function updateShippingAddress(Request $request, string $addressId)
    {
        return $this->service->updateShippingAddressFromProfile($request, $addressId);
    }

    public function deleteShippingAddress(string $addressId)
    {
        return $this->service->deleteShippingAddressFromProfile($addressId);
    }

    public function index(Request $request)
    {
        return $this->service->index($request);
    }

    public function downloadInvoice(string $orderId)
    {
        return $this->service->downloadInvoice($orderId);
    }

    public function store(Request $request)
    {
        return $this->service->store($request);
    }

    public function storeReview(Request $request, string $orderId)
    {
        return $this->service->storeReview($request, $orderId);
    }

    public function storeReturnRequest(Request $request, string $orderId, string $itemId)
    {
        return $this->service->storeReturnRequest($request, $orderId, $itemId);
    }

    private function respondToGatewayBrowserCallback(Request $request, string $trx, JsonResponse $response, string $fallbackPath): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson()) {
            return $response;
        }

        $payload = $response->getData(true);
        $order = CustomerOrder::query()->where('order_no', $trx)->first();
        $frontendBaseUrl = $this->resolveFrontendBaseUrl($order);
        $redirectPath = (string) ($payload['data']['redirect_path'] ?? $fallbackPath);

        if (($payload['status'] ?? 0) === 1 && $redirectPath === '/order-success' && !empty($payload['data']['order_id'])) {
            $redirectPath .= '?method=' . urlencode('gateway') . '&orderId=' . urlencode((string) $payload['data']['order_id']);
        }

        if ($frontendBaseUrl) {
            return redirect($frontendBaseUrl . $redirectPath);
        }

        return redirect($redirectPath);
    }

    private function resolveFrontendBaseUrl(?CustomerOrder $order): ?string
    {
        $paymentPayload = is_array($order?->payment_payload) ? $order->payment_payload : [];
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
