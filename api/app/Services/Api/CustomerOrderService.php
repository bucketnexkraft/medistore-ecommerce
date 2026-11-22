<?php

namespace App\Services\Api;

use App\Enums\SalesChannel;
use App\Factory\PaymentGatewayFactory;
use App\Helpers\Helper;
use App\Models\Company;
use App\Models\CustomerOrder;
use App\Models\CustomerOrderItem;
use App\Models\DiscountHistory;
use App\Models\DiscountSetup;
use App\Models\Gateway;
use App\Models\GroupPurchase;
use App\Models\GroupPurchaseMember;
use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Models\OrderReturnRequest;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\RewordHistory;
use App\Models\RewordSetup;
use App\Models\SalesChannel as InventorySalesChannel;
use App\Models\User;
use App\Models\UserShipping;
use App\Services\CompanySmsService;
use App\Services\Api\CommissionSubscriptionService;
use App\Services\CompanyPlanFeatureService;
use App\Data\FeaturePreference;
use App\Utils\PermissionUtils;
use App\Support\EcommerceCompanyContext;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CustomerOrderService
{
    public function paymentGateways()
    {
        $company = $this->resolveCurrentCompany();
        if (! $company || ! PermissionUtils::isFeatureAccessible($company->company_id, FeaturePreference::PAYMENT_GATEWAY->value)) {
            return response()->json([
                'status' => 1,
                'message' => 'Payment gateways fetched successfully.',
                'data' => [],
            ]);
        }

        $gatewayAvailability = $this->resolveCompanyGatewayAvailability();
        $gateways = Gateway::query()
            ->with('currency:id,code')
            ->where('status', 1)
            ->where('gateway_type', '!=', 'manual')
            ->orderBy('name')
            ->get()
            ->filter(function (Gateway $gateway) use ($gatewayAvailability) {
                return $this->isGatewayEnabledForCompany($gateway, $gatewayAvailability);
            })
            ->map(function (Gateway $gateway) {
                return [
                    'id' => (string) $gateway->id,
                    'name' => (string) $gateway->name,
                    'gateway_type' => (string) $gateway->gateway_type,
                    'image_url' => $gateway->image_url,
                    'currency_code' => (string) ($gateway->currency?->code ?? 'USD'),
                    'description' => $gateway->description ? (string) $gateway->description : null,
                ];
            })
            ->values();

        return response()->json([
            'status' => 1,
            'message' => 'Payment gateways fetched successfully.',
            'data' => $gateways,
        ]);
    }

    public function checkoutSettings()
    {
        $company = $this->resolveCurrentCompany();
        $deliverySettings = is_array($company?->delivery_charge_settings) ? $company->delivery_charge_settings : [];
        $configuredDeliveryChargeMode = (string) ($deliverySettings['delivery_charge_mode'] ?? '');
        $deliveryChargeMode = in_array($configuredDeliveryChargeMode, ['inside_outside', 'free', 'zonal'], true)
            ? $configuredDeliveryChargeMode
            : (! empty($deliverySettings['specific_charges']) ? 'zonal' : 'inside_outside');
        $hasDeliveryConfiguration = ! empty(array_filter([
                  $deliverySettings['default_charge'] ?? null,
            $deliverySettings['delivery_charge_mode'] ?? null,
            $deliverySettings['inside_dhaka_charge'] ?? null,
            $deliverySettings['outside_dhaka_charge'] ?? null,
            $deliverySettings['cod_enabled'] ?? null,
            $deliverySettings['cod_mode'] ?? null,
            $deliverySettings['charge_scope'] ?? null,
            $deliverySettings['specific_charges'] ?? null,
        ], fn ($value) => ! (is_array($value) ? empty($value) : blank($value))));
        $paymentGatewaySupported = $company
            ? PermissionUtils::isFeatureAccessible($company->company_id, FeaturePreference::PAYMENT_GATEWAY->value)
            : false;
        $locationDeliverySupported = $company
            ? app(CompanyPlanFeatureService::class)->isFeatureAllowedByPlan($company->company_id, FeaturePreference::SHOP_DELIVERY_SUPPORT->value)
            : false;

        return response()->json([
            'status' => 1,
            'message' => 'Checkout settings fetched successfully.',
              'data' => [
                  'default_charge' => isset($deliverySettings['default_charge']) ? (float) $deliverySettings['default_charge'] : 0,
                  'delivery_charge_mode' => $deliveryChargeMode,
                  'inside_dhaka_charge' => isset($deliverySettings['inside_dhaka_charge']) ? (float) $deliverySettings['inside_dhaka_charge'] : null,
                  'outside_dhaka_charge' => isset($deliverySettings['outside_dhaka_charge']) ? (float) $deliverySettings['outside_dhaka_charge'] : null,
                  'cod_enabled' => (bool) ($deliverySettings['cod_enabled'] ?? true),
                  'cod_mode' => 'global',
                  'charge_scope' => (string) ($deliverySettings['charge_scope'] ?? 'default'),
                  'specific_charges' => array_values(array_filter($deliverySettings['specific_charges'] ?? [], fn ($item) => is_array($item))),
                  'payment_gateway_settings' => is_array($company?->payment_gateway_settings) ? $company->payment_gateway_settings : [],
                  'allow_guest_checkout' => $this->companyAllowsGuestCheckout($company),
                  'payment_gateway_supported' => $paymentGatewaySupported,
                  'delivery_supported' => $hasDeliveryConfiguration,
                  'location_delivery_supported' => $locationDeliverySupported,
              ],
          ]);
      }

    public function preview(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'coupon_code' => 'nullable|string|max:120',
            'items' => 'required|array|min:1',
            'items.*.slug' => 'required|string|max:255',
            'items.*.quantity' => 'required|numeric|min:1',
            'items.*.combination' => 'nullable|array',
            'shipping' => 'nullable|array',
            'shipping.city' => 'nullable|string|max:120',
            'shipping.division_name' => 'nullable|string|max:120',
            'shipping.district_name' => 'nullable|string|max:120',
            'shipping.upazila_name' => 'nullable|string|max:120',
            'delivery' => 'nullable|array',
            'delivery.delivery_charge' => 'nullable|numeric|min:0',
            'delivery.division_name' => 'nullable|string|max:120',
            'delivery.district_name' => 'nullable|string|max:120',
            'delivery.upazila_name' => 'nullable|string|max:120',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $payload = $validator->validated();

        try {
            $lineItems = $this->buildLineItems(collect($payload['items']));

            if ($lineItems->isEmpty()) {
                throw new \RuntimeException('No valid order items were provided.');
            }

            $pricing = $this->calculateCheckoutPricing($lineItems, $payload['coupon_code'] ?? null, $payload);

            return response()->json([
                'status' => 1,
                'message' => 'Checkout preview generated successfully.',
                'data' => [
                    'items' => $lineItems->map(fn (array $lineItem) => [
                        'id' => (string) $lineItem['product_id'],
                        'name' => (string) $lineItem['product_name'],
                        'slug' => (string) $lineItem['product_slug'],
                        'image' => (string) $lineItem['product_image'],
                        'brand_name' => (string) $lineItem['brand_name'],
                        'category_name' => (string) $lineItem['category_name'],
                        'quantity' => (float) $lineItem['quantity'],
                        'unit_price' => (float) $lineItem['unit_price'],
                        'tax_rate' => (float) $lineItem['tax_rate'],
                        'tax_amount' => (float) $lineItem['tax_amount'],
                        'line_subtotal' => (float) $lineItem['line_subtotal'],
                        'line_total' => (float) $lineItem['line_total'],
                        'available_quantity' => (float) $lineItem['available_quantity'],
                    ])->values(),
                    ...$pricing,
                ],
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'status' => 0,
                'message' => $exception->getMessage() ?: 'Checkout preview could not be generated.',
            ], 422);
        }
    }

    public function publicTrack(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'order_no' => 'required|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $payload = $validator->validated();
        $company = $this->resolveCurrentCompany();

        if (! $company) {
            return response()->json([
                'status' => 0,
                'message' => 'Storefront company context could not be resolved.',
            ], 404);
        }

        $orderNo = trim((string) $payload['order_no']);

        $order = CustomerOrder::query()
            ->where('company_id', $company->company_id)
            ->where('order_no', $orderNo)
            ->with([
                'user:id,first_name,last_name,email,phone',
                'shippingAddress:id,user_id,full_name,email,phone,address,division_name,district_name,upazila_name,city,country,postal_code',
                'items.inventoryItem',
                'items.inventory',
                'company',
                'groupPurchase',
            ])
            ->first();

        if (! $order) {
            return response()->json([
                'status' => 0,
                'message' => 'No order matched the provided order number.',
            ], 404);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Order tracking fetched successfully.',
            'data' => $this->formatOrder($order),
        ]);
    }

    public function handleGatewaySuccessCallback(Request $request, string $trx)
    {
        $order = CustomerOrder::query()
            ->where('order_no', $trx)
            ->with(['user', 'items'])
            ->first();

        if (! $order) {
            return response()->json([
                'status' => 0,
                'message' => 'Order not found.',
            ], 404);
        }

        if ((string) $order->payment_status === 'paid') {
            return response()->json([
                'status' => 1,
                'message' => 'Payment already confirmed.',
                'data' => [
                    'redirect_path' => '/order-success',
                    'order_id' => (string) $order->order_no,
                ],
            ]);
        }

        $gateway = Gateway::query()
            ->with('currency')
            ->whereRaw('LOWER(name) = ?', [strtolower((string) $order->payment_method)])
            ->first();

        if (! $gateway) {
            return response()->json([
                'status' => 0,
                'message' => 'Payment gateway not found for this order.',
            ], 404);
        }

        $order->setRelation('gateway', $gateway);
        $order->payable_amount = (float) $order->total_amount;
        $order->trx = (string) $order->order_no;
        $paymentPayload = is_array($order->payment_payload) ? $order->payment_payload : [];
        $frontendUrl = $this->sanitizeFrontendUrl($request->query('frontend_url'));
        if ($frontendUrl) {
            $paymentPayload['frontend_url'] = $frontendUrl;
        }
        $order->payment_payload = $paymentPayload;

        $response = PaymentGatewayFactory::create($gateway->name)->success($order, \App\Http\Controllers\OrderPaymentController::class);

        if (($response['status'] ?? false) === true) {
            return response()->json([
                'status' => 1,
                'message' => 'Payment confirmed successfully.',
                'data' => [
                    'redirect_path' => '/order-success',
                    'order_id' => (string) $order->order_no,
                ],
            ]);
        }

        $this->cancelGatewayOrderPayment($order);

        return response()->json([
            'status' => 0,
            'message' => $response['message'] ?? 'Payment verification failed.',
            'data' => [
                'redirect_path' => '/payment-failed',
            ],
        ], 422);
    }

    public function handleGatewayCancelCallback(string $trx)
    {
        $order = CustomerOrder::query()
            ->where('order_no', $trx)
            ->with(['user', 'items'])
            ->first();

        if (! $order) {
            return response()->json([
                'status' => 0,
                'message' => 'Order not found.',
            ], 404);
        }

        $gateway = Gateway::query()
            ->with('currency')
            ->whereRaw('LOWER(name) = ?', [strtolower((string) $order->payment_method)])
            ->first();

        if (! $gateway) {
            return response()->json([
                'status' => 0,
                'message' => 'Payment gateway not found for this order.',
            ], 404);
        }

        $order->setRelation('gateway', $gateway);
        $order->payable_amount = (float) $order->total_amount;
        $order->trx = (string) $order->order_no;

        $response = PaymentGatewayFactory::create($gateway->name)->cancel($order, \App\Http\Controllers\OrderPaymentController::class);

        if (($response['status'] ?? false) === true) {
            return response()->json([
                'status' => 1,
                'message' => 'Payment canceled.',
                'data' => [
                    'redirect_path' => '/payment-cancel',
                ],
            ]);
        }

        return response()->json([
            'status' => 0,
            'message' => $response['message'] ?? 'Payment cancellation failed.',
            'data' => [
                'redirect_path' => '/payment-failed',
            ],
        ], 422);
    }

    public function shippingAddresses()
    {
        $addresses = UserShipping::query()
            ->where('user_id', (string) Auth::id())
            ->orderByDesc('is_default')
            ->latest('updated_at')
            ->get()
            ->map(fn (UserShipping $address) => $this->formatShippingAddress($address))
            ->values();

        return response()->json([
            'status' => 1,
            'message' => 'Shipping addresses fetched successfully.',
            'data' => $addresses,
        ]);
    }

    public function storeShippingAddressFromProfile(Request $request)
    {
        $validator = Validator::make($request->all(), $this->shippingAddressRules());

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $payload = $validator->validated();
        $userId = (string) Auth::id();

        if (!empty($payload['is_default'])) {
            UserShipping::query()
                ->where('user_id', $userId)
                ->update(['is_default' => false]);
        }

        $address = UserShipping::query()->create([
            'user_id' => $userId,
            'full_name' => trim((string) $payload['full_name']),
            'email' => $payload['email'] ?? null,
            'phone' => $payload['phone'],
            'address' => $payload['address'],
            'division_name' => $payload['division_name'] ?? null,
            'district_name' => $payload['district_name'] ?? null,
            'upazila_name' => $payload['upazila_name'] ?? null,
            'city' => $payload['city'],
            'country' => $payload['country'],
            'postal_code' => $payload['postal_code'] ?? null,
            'is_default' => (bool) ($payload['is_default'] ?? false),
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Shipping address saved successfully.',
            'data' => $this->formatShippingAddress($address),
        ], 201);
    }

    public function updateShippingAddressFromProfile(Request $request, string $addressId)
    {
        $validator = Validator::make($request->all(), $this->shippingAddressRules());

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $address = UserShipping::query()
            ->where('id', $addressId)
            ->where('user_id', (string) Auth::id())
            ->first();

        if (!$address) {
            return response()->json([
                'status' => 0,
                'message' => 'Shipping address not found.',
            ], 404);
        }

        $payload = $validator->validated();

        if (!empty($payload['is_default'])) {
            UserShipping::query()
                ->where('user_id', (string) Auth::id())
                ->where('id', '!=', $address->id)
                ->update(['is_default' => false]);
        }

        $address->fill([
            'full_name' => trim((string) $payload['full_name']),
            'email' => $payload['email'] ?? null,
            'phone' => $payload['phone'],
            'address' => $payload['address'],
            'division_name' => $payload['division_name'] ?? null,
            'district_name' => $payload['district_name'] ?? null,
            'upazila_name' => $payload['upazila_name'] ?? null,
            'city' => $payload['city'],
            'country' => $payload['country'],
            'postal_code' => $payload['postal_code'] ?? null,
            'is_default' => (bool) ($payload['is_default'] ?? false),
        ]);
        $address->save();

        return response()->json([
            'status' => 1,
            'message' => 'Shipping address updated successfully.',
            'data' => $this->formatShippingAddress($address->fresh()),
        ]);
    }

    public function deleteShippingAddressFromProfile(string $addressId)
    {
        $address = UserShipping::query()
            ->where('id', $addressId)
            ->where('user_id', (string) Auth::id())
            ->first();

        if (!$address) {
            return response()->json([
                'status' => 0,
                'message' => 'Shipping address not found.',
            ], 404);
        }

        $wasDefault = (bool) $address->is_default;
        $address->delete();

        if ($wasDefault) {
            $nextDefault = UserShipping::query()
                ->where('user_id', (string) Auth::id())
                ->latest('updated_at')
                ->first();

            if ($nextDefault) {
                $nextDefault->is_default = true;
                $nextDefault->save();
            }
        }

        return response()->json([
            'status' => 1,
            'message' => 'Shipping address deleted successfully.',
        ]);
    }

    public function index(Request $request)
    {
        $status = trim((string) $request->query('status', ''));
        $returnFeatureReady = Schema::hasTable('order_return_requests');

        $orders = CustomerOrder::query()
            ->tap(fn ($query) => EcommerceCompanyContext::applyScope($query))
            ->where('user_id', (string) Auth::id())
            ->when($status !== '' && $status !== 'all', fn ($query) => $query->where('order_status', $status))
            ->with(array_filter([
                'items.product.returnSetup',
                $returnFeatureReady ? 'items.returnRequest' : null,
                'shippingAddress',
                'company',
                'groupPurchase',
            ]))
            ->latest('placed_at')
            ->latest('created_at')
            ->get()
            ->map(fn (CustomerOrder $order) => $this->formatOrder($order))
            ->values();

        return response()->json([
            'status' => 1,
            'message' => 'Orders fetched successfully.',
            'data' => $orders,
            'meta' => [
                'total' => $orders->count(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'payment_method' => 'required|string|in:cod,gateway',
            'gateway_id' => 'nullable|string',
            'frontend_url' => 'nullable|url|max:255',
            'group_purchase_id' => 'nullable|string|exists:group_purchases,id',
            'coupon_code' => 'nullable|string|max:120',
            'shipping.address_id' => 'nullable|string',
            'shipping.first_name' => 'required|string|max:100',
            'shipping.last_name' => 'nullable|string|max:100',
            'shipping.email' => 'nullable|email|max:255',
            'shipping.phone' => 'required|string|max:100',
            'shipping.address' => 'required|string|max:1000',
            'shipping.city' => 'required|string|max:120',
            'shipping.division_name' => 'nullable|string|max:120',
            'shipping.district_name' => 'nullable|string|max:120',
            'shipping.upazila_name' => 'nullable|string|max:120',
            'shipping.country' => 'required|string|max:120',
            'shipping.postal_code' => 'nullable|string|max:40',
            'delivery' => 'nullable|array',
            'delivery.division_name' => 'nullable|string|max:120',
            'delivery.district_name' => 'nullable|string|max:120',
            'delivery.upazila_name' => 'nullable|string|max:120',
            'delivery.delivery_charge' => 'nullable|numeric|min:0',
            'items' => 'required|array|min:1',
            'items.*.slug' => 'required|string|max:255',
            'items.*.quantity' => 'required|numeric|min:1',
            'items.*.combination' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $payload = $validator->validated();
        $user = Auth::guard('api')->user();
        $gateway = $this->resolveCheckoutGateway($payload);
        $isGatewayCheckout = $gateway !== null;

        try {
            $createdOrder = DB::transaction(function () use ($payload, $user, $gateway, $isGatewayCheckout) {
                $isAuthenticatedCustomer = $user !== null;
                $shipping = $payload['shipping'];
                $groupPurchaseId = trim((string) ($payload['group_purchase_id'] ?? ''));
                $groupPurchase = null;

                if ($groupPurchaseId !== '') {
                    if (! $isAuthenticatedCustomer) {
                        throw new \RuntimeException('Please sign in to complete a group purchase checkout.');
                    }

                    $groupPurchase = $this->resolveGroupPurchaseForOrder($groupPurchaseId, (string) $user->id);
                }

                $lineItems = $this->buildLineItems(collect($payload['items']), $groupPurchase);

                if ($lineItems->isEmpty()) {
                    throw new \RuntimeException('No valid order items were provided.');
                }

                if ($groupPurchase && filled($payload['coupon_code'] ?? null)) {
                    throw new \RuntimeException('Coupon codes cannot be applied to a group purchase checkout.');
                }

                $pricing = $this->calculateCheckoutPricing($lineItems, $payload['coupon_code'] ?? null, $payload);
                $subtotal = (float) $pricing['subtotal'];
                $taxAmount = (float) $pricing['tax'];
                $shippingAmount = (float) $pricing['shipping'];
                $totalAmount = (float) $pricing['total'];
                $companyId = $this->resolveOrderCompanyId($lineItems);
                $company = $companyId ? Company::query()->find($companyId) : null;

                if (! $isAuthenticatedCustomer && ! $this->companyAllowsGuestCheckout($company)) {
                    throw new \RuntimeException('Please sign in before placing this order.');
                }

                $shippingAddress = $this->storeShippingAddress($isAuthenticatedCustomer ? (string) $user->id : null, $shipping);

                $order = CustomerOrder::query()->create([
                    'user_id' => $isAuthenticatedCustomer ? (string) $user->id : null,
                    'user_shipping_id' => $shippingAddress->id,
                    'company_id' => $companyId,
                    'payment_method' => $gateway ? (string) $gateway->name : 'cod',
                    'payment_status' => 'pending',
                    'order_status' => $isGatewayCheckout ? 'pending' : 'processing',
                    'group_purchase_id' => $groupPurchase?->id,
                    'group_purchase_discount_status' => $groupPurchase ? 'pending' : 'none',
                    'group_discount_amount' => 0,
                    'subtotal' => $subtotal,
                    'tax_amount' => $taxAmount,
                    'shipping_amount' => $shippingAmount,
                    'total_amount' => $totalAmount,
                    'coupon_code' => $pricing['coupon_code'],
                    'coupon_discount_amount' => $pricing['coupon_discount_amount'],
                    'placed_at' => now(),
                ]);

                foreach ($lineItems as $lineItem) {
                    $allocation = $this->deductInventory(
                        (string) $lineItem['product_id'],
                        (float) $lineItem['quantity'],
                        $lineItem['combination'] ?? null,
                    );

                    CustomerOrderItem::query()->create([
                        'order_id' => $order->id,
                        'company_id' => $lineItem['company_id'],
                        'product_id' => $lineItem['product_id'],
                        'inventory_id' => $allocation['inventory_id'],
                        'inventory_item_id' => $allocation['inventory_item_id'],
                        'product_name' => $lineItem['product_name'],
                        'product_slug' => $lineItem['product_slug'],
                        'product_image' => $lineItem['product_image'],
                        'brand_name' => $lineItem['brand_name'],
                        'category_name' => $lineItem['category_name'],
                        'quantity' => $lineItem['quantity'],
                        'unit_price' => $lineItem['unit_price'],
                        'tax_rate' => $lineItem['tax_rate'],
                        'tax_amount' => $lineItem['tax_amount'],
                        'line_total' => $lineItem['line_total'],
                    ]);
                }

                if ($isAuthenticatedCustomer && $pricing['coupon_code'] && $pricing['coupon_setup_id']) {
                    DiscountHistory::query()->create([
                        'user_id' => $isAuthenticatedCustomer ? $user->id : null,
                        'invoice_id' => $order->id,
                        'invoice_amount' => $subtotal,
                        'discount_amount' => $pricing['coupon_discount_amount'],
                        'discount_type' => $pricing['coupon_discount_type'],
                        'created_by' => $isAuthenticatedCustomer ? $user->id : null,
                    ]);
                }

                if ($groupPurchase && !$isGatewayCheckout) {
                    $this->refreshGroupPurchaseAfterOrder($groupPurchase->id);
                    $order->refresh();
                }

                if ($isAuthenticatedCustomer && ! $isGatewayCheckout) {
                    $this->awardEcommerceOrderReward($order);
                }

                app(CommissionSubscriptionService::class)->registerOrderCharge($order);

                return $order->load(['items', 'shippingAddress', 'company', 'groupPurchase']);
            });
        } catch (\Throwable $exception) {
            return response()->json([
                'status' => 0,
                'message' => $exception->getMessage() ?: 'Order could not be placed.',
            ], 422);
        }

        if (!$isGatewayCheckout && $createdOrder->group_purchase_id) {
            app(GroupPurchaseService::class)->broadcastGroupUpdate((string) $createdOrder->group_purchase_id, 'purchase');
        }

        if (! $isGatewayCheckout) {
            app(CompanySmsService::class)->sendOrderConfirmation(
                $createdOrder->fresh(['company', 'shippingAddress', 'user']) ?? $createdOrder
            );
        }

        if ($isGatewayCheckout && $gateway) {
            $payment = $this->initializeGatewayPayment($createdOrder, $gateway, $payload['frontend_url'] ?? null);

            if (($payment['type'] ?? null) === 'failed') {
                return response()->json([
                    'status' => 0,
                    'message' => $payment['message'] ?? 'Gateway is currently unavailable. Please try another option.',
                ], 422);
            }

            return response()->json([
                'status' => 1,
                'message' => 'Continue with gateway payment.',
                'data' => [
                    ...$this->formatOrder($createdOrder->fresh(['items', 'shippingAddress', 'company', 'groupPurchase'])),
                    'payment' => [
                        'type' => $payment['type'] ?? 'redirect',
                        'redirect_url' => $payment['redirect_url'] ?? null,
                    ],
                ],
            ], 201);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Cash on delivery order placed successfully.',
            'data' => $this->formatOrder($createdOrder),
        ], 201);
    }

    public function completeGatewayOrderPayment(CustomerOrder $order): array
    {
        DB::beginTransaction();

        try {
            $lockedOrder = CustomerOrder::query()
                ->where('id', $order->id)
                ->with(['items', 'groupPurchase'])
                ->lockForUpdate()
                ->first();

            if (!$lockedOrder) {
                DB::rollBack();
                return ['status' => false, 'message' => 'Order not found'];
            }

            if ((string) $lockedOrder->payment_status === 'paid') {
                DB::rollBack();
                return ['status' => true, 'message' => 'Already processed'];
            }

            $lockedOrder->payment_status = 'paid';
            if ((string) $lockedOrder->order_status === 'pending') {
                $lockedOrder->order_status = 'processing';
            }
            $lockedOrder->save();

            $this->awardEcommerceOrderReward($lockedOrder);

            if ($lockedOrder->group_purchase_id) {
                $this->refreshGroupPurchaseAfterOrder((string) $lockedOrder->group_purchase_id);
            }

            DB::commit();

            app(CompanySmsService::class)->sendOrderConfirmation(
                $lockedOrder->fresh(['company', 'shippingAddress', 'user']) ?? $lockedOrder
            );

            if ($lockedOrder->group_purchase_id) {
                app(GroupPurchaseService::class)->broadcastGroupUpdate((string) $lockedOrder->group_purchase_id, 'purchase');
            }

            return ['status' => true, 'message' => 'Payment completed successfully'];
        } catch (\Throwable $exception) {
            DB::rollBack();
            return ['status' => false, 'message' => 'Payment processing failed'];
        }
    }

    public function cancelGatewayOrderPayment(CustomerOrder $order): array
    {
        DB::beginTransaction();

        try {
            $lockedOrder = CustomerOrder::query()
                ->where('id', $order->id)
                ->with(['items', 'groupPurchase'])
                ->lockForUpdate()
                ->first();

            if (!$lockedOrder) {
                DB::rollBack();
                return ['status' => false, 'message' => 'Order not found'];
            }

            if ((string) $lockedOrder->payment_status === 'paid') {
                DB::rollBack();
                return ['status' => false, 'message' => 'Paid orders cannot be cancelled automatically'];
            }

            if ($lockedOrder->relationLoaded('items') && $lockedOrder->items->isNotEmpty()) {
                $this->restoreInventoryFromOrder($lockedOrder);
            }

            $groupPurchaseId = $lockedOrder->group_purchase_id ? (string) $lockedOrder->group_purchase_id : null;

            if ($lockedOrder->relationLoaded('items') && $lockedOrder->items->isNotEmpty()) {
                $itemIds = $lockedOrder->items
                    ->pluck('id')
                    ->filter()
                    ->values()
                    ->all();

                if ($itemIds !== []) {
                    OrderReturnRequest::query()
                        ->whereIn('order_item_id', $itemIds)
                        ->delete();
                }
            }

            DiscountHistory::query()
                ->where('invoice_id', $lockedOrder->id)
                ->delete();

            app(CommissionSubscriptionService::class)->voidChargesForOrder($lockedOrder->id);

            CustomerOrderItem::query()
                ->where('order_id', $lockedOrder->id)
                ->delete();

            CustomerOrder::query()
                ->where('id', $lockedOrder->id)
                ->delete();

            if ($groupPurchaseId) {
                $this->refreshGroupPurchaseAfterOrder($groupPurchaseId);
            }

            DB::commit();

            if ($groupPurchaseId) {
                app(GroupPurchaseService::class)->broadcastGroupUpdate($groupPurchaseId, 'cancelled');
            }

            return ['status' => true, 'message' => 'Payment canceled and order rolled back'];
        } catch (\Throwable $exception) {
            DB::rollBack();
            return ['status' => false, 'message' => 'Payment cancellation failed'];
        }
    }

    private function awardEcommerceOrderReward(CustomerOrder $order): void
    {
        $userId = trim((string) ($order->user_id ?? ''));
        $companyId = trim((string) ($order->company_id ?? ''));

        if ($userId === '' || $companyId === '') {
            return;
        }

        $alreadyCredited = RewordHistory::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('invoice_id', (string) $order->id)
            ->where('type', 'credit')
            ->exists();

        if ($alreadyCredited) {
            return;
        }

        $reward = RewordSetup::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->latest('id')
            ->first();

        if (! $reward || (float) $reward->amount <= 0 || (float) $reward->reword_unit <= 0) {
            return;
        }

        if (blank($reward->form_date) || blank($reward->to_date)) {
            return;
        }

        $today = Carbon::today();
        $fromDate = Carbon::parse($reward->form_date)->startOfDay();
        $toDate = Carbon::parse($reward->to_date)->endOfDay();

        if (! $today->between($fromDate, $toDate, true)) {
            return;
        }

        $pointsEarned = floor((float) $order->subtotal / (float) $reward->amount) * (float) $reward->reword_unit;

        if ($pointsEarned <= 0) {
            return;
        }

        $customer = User::withoutGlobalScopes()
            ->whereKey($userId)
            ->lockForUpdate()
            ->first();

        if (! $customer) {
            return;
        }

        $customer->total_reword = (float) ($customer->total_reword ?? 0) + $pointsEarned;
        $customer->save();

        $history = new RewordHistory([
            'user_id' => $userId,
            'invoice_id' => (string) $order->id,
            'invoice_amount' => (float) $order->subtotal,
            'reword_amount' => $pointsEarned,
            'conversion_value' => (float) ($reward->reword_value ?? 0),
            'type' => 'credit',
        ]);
        $history->company_id = $companyId;
        $history->save();
    }

    public function downloadInvoice(string $orderId)
    {
        try {
            $order = CustomerOrder::query()
                ->tap(fn ($query) => EcommerceCompanyContext::applyScope($query))
                ->where('id', $orderId)
                ->where('user_id', (string) Auth::id())
                ->with(['items', 'shippingAddress', 'company'])
                ->first();

            if (! $order) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Order not found.',
                ], 404);
            }

            $pdf = Pdf::loadView('pdf.customer-order-invoice', [
                'order' => $order,
                'seller' => $order->company,
                'shippingAddress' => $order->shippingAddress,
                'companyInfo' => [
                    'name' => (string) ($order->company?->name ?: (Helper::getSettings('application_name') ?? 'Arcade')),
                    'email' => (string) ($order->company?->email ?: (Helper::getSettings('application_email') ?? 'contact@example.com')),
                    'phone' => (string) ($order->company?->phone_number ?: (Helper::getSettings('application_phone') ?? '')),
                    'address' => collect([
                        $order->company?->address,
                        $order->company?->city,
                        $order->company?->state,
                        $order->company?->post_code,
                        $order->company?->country,
                    ])->filter(fn ($value) => filled($value))->implode(', ') ?: (Helper::getSettings('application_address') ?? ''),
                    'logo' => (string) ($order->company?->website_logo ?: (Helper::getSettings('site_logo') ?? '')),
                ],
            ])->setPaper('a4');

            return $pdf->download('invoice-' . strtolower((string) $order->order_no) . '.pdf');
        } catch (\Throwable $exception) {
            return response()->json([
                'status' => 0,
                'message' => 'Failed to generate invoice PDF.',
                'error' => $exception->getMessage(),
            ], 500);
        }
    }

    public function storeReview(Request $request, string $orderId)
    {
        $validator = Validator::make($request->all(), [
            'product_id' => 'required|string',
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $payload = $validator->validated();

        $order = CustomerOrder::query()
            ->tap(fn ($query) => EcommerceCompanyContext::applyScope($query))
            ->where('id', $orderId)
            ->where('user_id', (string) Auth::id())
            ->with('items')
            ->first();

        if (! $order) {
            return response()->json([
                'status' => 0,
                'message' => 'Order not found.',
            ], 404);
        }

        if ((string) $order->order_status !== 'delivered') {
            return response()->json([
                'status' => 0,
                'message' => 'You can rate a product only after delivery.',
            ], 422);
        }

        $orderedItem = $order->items->firstWhere('product_id', (string) $payload['product_id']);

        if (! $orderedItem) {
            return response()->json([
                'status' => 0,
                'message' => 'This product does not belong to the selected order.',
            ], 422);
        }

        $review = ProductReview::withoutGlobalScopes()->updateOrCreate(
            [
                'order_id' => $order->id,
                'product_id' => (string) $payload['product_id'],
                'user_id' => (string) Auth::id(),
            ],
            [
                'company_id' => $order->company_id,
                'rating' => (int) $payload['rating'],
                'comment' => trim((string) ($payload['comment'] ?? '')) ?: null,
            ]
        );

        return response()->json([
            'status' => 1,
            'message' => 'Product review saved successfully.',
            'data' => $this->formatReview($review),
        ], 201);
    }

    public function storeReturnRequest(Request $request, string $orderId, string $itemId)
    {
        if (! Schema::hasTable('order_return_requests')) {
            return response()->json([
                'status' => 0,
                'message' => 'Return feature is not ready yet. Please contact the administrator.',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|min:3|max:2000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $order = CustomerOrder::query()
            ->tap(fn ($query) => EcommerceCompanyContext::applyScope($query))
            ->where('id', $orderId)
            ->where('user_id', (string) Auth::id())
            ->with(['items.product.returnSetup', 'items.returnRequest'])
            ->first();

        if (! $order) {
            return response()->json([
                'status' => 0,
                'message' => 'Order not found.',
            ], 404);
        }

        /** @var CustomerOrderItem|null $item */
        $item = $order->items->firstWhere('id', (int) $itemId);

        if (! $item) {
            return response()->json([
                'status' => 0,
                'message' => 'Order item not found.',
            ], 404);
        }

        $eligibility = $this->resolveReturnEligibility($order, $item);

        if (! $eligibility['can_request_return']) {
            return response()->json([
                'status' => 0,
                'message' => $eligibility['message'] ?: 'This item is not eligible for return right now.',
            ], 422);
        }

        $reason = trim((string) $validator->validated()['reason']);

        $returnRequest = OrderReturnRequest::query()->updateOrCreate(
            [
                'order_id' => $order->id,
                'order_item_id' => $item->id,
            ],
            [
                'company_id' => $order->company_id,
                'user_id' => (string) Auth::id(),
                'product_id' => (string) $item->product_id,
                'reason' => $reason,
                'status' => 'pending',
                'refund_amount' => round((float) $item->line_total, 2),
                'approved_by' => null,
                'rejection_reason' => null,
                'requested_at' => now(),
                'resolved_at' => null,
            ]
        );

        $item->setRelation('returnRequest', $returnRequest);

        return response()->json([
            'status' => 1,
            'message' => 'Return request submitted successfully.',
            'data' => $this->formatReturnRequest($returnRequest),
        ], 201);
    }

    private function storeShippingAddress(?string $userId, array $shipping): UserShipping
    {
        $normalizedShipping = $this->normalizeShippingPayload($shipping);
        $normalizedUserId = is_string($userId) ? trim($userId) : '';

        if ($normalizedUserId === '') {
            return UserShipping::query()->create([
                'user_id' => null,
                ...$normalizedShipping,
                'is_default' => false,
            ]);
        }

        $selectedAddressId = trim((string) ($shipping['address_id'] ?? ''));

        if ($selectedAddressId !== '') {
            $selectedAddress = UserShipping::query()
                ->where('id', $selectedAddressId)
                ->where('user_id', $normalizedUserId)
                ->first();

            if ($selectedAddress) {
                $this->markShippingAddressAsDefault($normalizedUserId, $selectedAddress);

                return $selectedAddress->fresh();
            }
        }

        $existingAddress = UserShipping::query()
            ->where('user_id', $normalizedUserId)
            ->where('full_name', $normalizedShipping['full_name'])
            ->where('phone', $normalizedShipping['phone'])
            ->where('address', $normalizedShipping['address'])
            ->where('city', $normalizedShipping['city'])
            ->where('country', $normalizedShipping['country'])
            ->where(function ($query) use ($normalizedShipping) {
                if ($normalizedShipping['email'] === null) {
                    $query->whereNull('email');
                } else {
                    $query->where('email', $normalizedShipping['email']);
                }
            })
            ->where(function ($query) use ($normalizedShipping) {
                if ($normalizedShipping['postal_code'] === null) {
                    $query->whereNull('postal_code');
                } else {
                    $query->where('postal_code', $normalizedShipping['postal_code']);
                }
            })
            ->first();

        if ($existingAddress) {
            $this->markShippingAddressAsDefault($normalizedUserId, $existingAddress);

            return $existingAddress->fresh();
        }

        UserShipping::query()
            ->where('user_id', $normalizedUserId)
            ->update(['is_default' => false]);

        return UserShipping::query()->create([
            'user_id' => $normalizedUserId,
            ...$normalizedShipping,
            'is_default' => true,
        ]);
    }

    private function normalizeShippingPayload(array $shipping): array
    {
        return [
            'full_name' => trim(($shipping['first_name'] ?? '') . ' ' . ($shipping['last_name'] ?? '')),
            'email' => filled($shipping['email'] ?? null) ? trim((string) $shipping['email']) : null,
            'phone' => trim((string) $shipping['phone']),
            'address' => trim((string) $shipping['address']),
            'division_name' => filled($shipping['division_name'] ?? null) ? trim((string) $shipping['division_name']) : null,
            'district_name' => filled($shipping['district_name'] ?? null) ? trim((string) $shipping['district_name']) : null,
            'upazila_name' => filled($shipping['upazila_name'] ?? null) ? trim((string) $shipping['upazila_name']) : null,
            'city' => trim((string) $shipping['city']),
            'country' => trim((string) $shipping['country']),
            'postal_code' => filled($shipping['postal_code'] ?? null) ? trim((string) $shipping['postal_code']) : null,
        ];
    }

    private function markShippingAddressAsDefault(string $userId, UserShipping $address): void
    {
        UserShipping::query()
            ->where('user_id', $userId)
            ->where('id', '!=', $address->id)
            ->update(['is_default' => false]);

        if (! $address->is_default) {
            $address->is_default = true;
            $address->save();
        }
    }

    private function shippingAddressRules(): array
    {
        return [
            'full_name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'required|string|max:100',
            'address' => 'required|string|max:1000',
            'division_name' => 'nullable|string|max:120',
            'district_name' => 'nullable|string|max:120',
            'upazila_name' => 'nullable|string|max:120',
            'city' => 'required|string|max:120',
            'country' => 'required|string|max:120',
            'postal_code' => 'nullable|string|max:40',
            'is_default' => 'nullable|boolean',
        ];
    }

    private function buildLineItems(Collection $requestedItems, ?GroupPurchase $groupPurchase = null): Collection
    {
        if ($groupPurchase) {
            if ($requestedItems->count() !== 1) {
                throw new \RuntimeException('Group purchase checkout accepts exactly one product.');
            }
        }

        return $requestedItems->map(function (array $item) use ($groupPurchase) {
            $slug = strtolower(trim((string) ($item['slug'] ?? '')));
            $quantity = (float) $item['quantity'];
            $combination = $this->normalizeCombination((array) ($item['combination'] ?? []));

            $product = Product::query()
                ->withoutGlobalScope('company')
                ->tap(fn ($query) => EcommerceCompanyContext::applyScope($query))
                ->where('status', 1)
                ->where('is_bundle', false)
                ->whereRaw('LOWER(slug) = ?', [$slug])
                ->with([
                    'category:id,title,slug',
                    'brand:id,title',
                    'inventory_items' => function ($query) use ($combination) {
                        EcommerceCompanyContext::applyScope($query->withoutGlobalScope('company'))
                            ->where('quantity', '>', 0)
                            ->with('salesChannels')
                            ->orderBy('created_at');

                        $this->constrainInventoryItemsToCombination($query, $combination);
                    },
                ])
                ->first();

            if (! $product) {
                throw new \RuntimeException('One or more products could not be found.');
            }

            $availableQuantity = $this->resolveAvailableQuantity($product);
            if ($availableQuantity < $quantity) {
                throw new \RuntimeException($product->name . ' does not have enough stock.');
            }

            $basePrice = (float) (
                optional($product->inventory_items->sortByDesc('created_at')->firstWhere('quantity', '>', 0))->price
                ?? optional($product->inventory_items->sortByDesc('created_at')->first())->price
                ?? 0
            );
            $unitPrice = $this->resolveStorefrontDiscountPricing($product, $basePrice)['price'];
            $taxRate = (float) ($product->vat ?? 0);
            if ($groupPurchase) {
                if ((string) $product->id !== (string) $groupPurchase->product_id) {
                    throw new \RuntimeException('This product does not match the selected group purchase.');
                }

                if ($quantity !== 1.0) {
                    throw new \RuntimeException('Group purchase checkout requires quantity 1 per member.');
                }

                $unitPrice = round((float) $groupPurchase->discounted_price, 2);
            }

            $lineSubtotal = round($unitPrice * $quantity, 2);
            $taxAmount = round($lineSubtotal * ($taxRate / 100), 2);

            return [
                'company_id' => $product->company_id,
                'product_id' => (string) $product->id,
                'brand_id' => blank($product->brand_id) ? null : (string) $product->brand_id,
                'category_id' => blank($product->category_id) ? null : (string) $product->category_id,
                'product_name' => (string) $product->name,
                'product_slug' => (string) $product->slug,
                'product_image' => (string) ($product->featured_image ?: $product->thumbnail ?: ''),
                'brand_name' => (string) ($product->brand?->title ?? ''),
                'category_name' => (string) ($product->category?->title ?? ''),
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'tax_rate' => $taxRate,
                'tax_amount' => $taxAmount,
                'line_subtotal' => $lineSubtotal,
                'line_total' => round($lineSubtotal + $taxAmount, 2),
                'available_quantity' => $availableQuantity,
                'combination' => $combination,
            ];
        });
    }

    private function resolveStorefrontDiscountSetup(Product $product): ?DiscountSetup
    {
        $companyId = EcommerceCompanyContext::currentCompanyId();

        return DiscountSetup::query()
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->where('type', 'discount')
            ->where('is_active', true)
            ->whereDate('form_date', '<=', now()->toDateString())
            ->whereDate('to_date', '>=', now()->toDateString())
            ->orderBy('to_date')
            ->orderByDesc('id')
            ->get()
            ->first(function (DiscountSetup $discount) use ($product) {
                $products = collect($discount->products ?? [])->map(fn ($value) => (string) $value)->filter()->values()->all();
                $categories = collect($discount->categories ?? [])->map(fn ($value) => (string) $value)->filter()->values()->all();
                $brands = collect($discount->brands ?? [])->map(fn ($value) => (string) $value)->filter()->values()->all();
                $warehouses = collect($discount->warehouses ?? [])->map(fn ($value) => (string) $value)->filter()->values()->all();
                $matchesExplicitProduct = in_array((string) $product->id, $products, true);
                $matchesCategoryOrBrand = in_array((string) $product->category_id, $categories, true)
                    || (!blank($product->brand_id) && in_array((string) $product->brand_id, $brands, true));
                $hasScope = $matchesExplicitProduct || $matchesCategoryOrBrand || !empty($warehouses);

                if (! $hasScope) {
                    return false;
                }

                if ($matchesExplicitProduct) {
                    return true;
                }

                if (! $matchesCategoryOrBrand) {
                    return false;
                }

                if (! empty($warehouses)) {
                    $productWarehouseIds = $product->relationLoaded('inventory_items')
                        ? collect($product->inventory_items)->pluck('warehouse_id')->filter()->map(fn ($value) => (string) $value)->values()->all()
                        : InventoryItem::query()
                            ->where('product_id', $product->id)
                            ->pluck('warehouse_id')
                            ->filter()
                            ->map(fn ($value) => (string) $value)
                            ->values()
                            ->all();

                    if (empty(array_intersect($warehouses, $productWarehouseIds))) {
                        return false;
                    }
                }

                return true;
            });
    }

    private function resolveStorefrontDiscountPricing(Product $product, float $basePrice): array
    {
        $setup = $this->resolveStorefrontDiscountSetup($product);

        if (! $setup || $basePrice <= 0) {
            return [
                'price' => round($basePrice, 2),
                'original_price' => null,
                'discount_percent' => 0,
            ];
        }

        $discountType = $this->normalizeStorefrontDiscountType($setup->discount_type);
        $discountValue = (float) ($setup->amount ?? 0);
        $discountAmount = $discountType === 'percent'
            ? ($basePrice * ($discountValue / 100))
            : $discountValue;
        $discountedPrice = round(max($basePrice - min(max($discountAmount, 0), $basePrice), 0), 2);
        $discountPercent = $basePrice > $discountedPrice
            ? (int) round((($basePrice - $discountedPrice) / $basePrice) * 100)
            : 0;

        return [
            'price' => $discountedPrice,
            'original_price' => round($basePrice, 2),
            'discount_percent' => $discountPercent,
        ];
    }

    private function calculateCheckoutPricing(Collection $lineItems, ?string $couponCode = null, array $payload = []): array
    {
        $subtotal = round((float) $lineItems->sum('line_subtotal'), 2);
        $baseTax = round((float) $lineItems->sum('tax_amount'), 2);
        $shipping = $this->resolveDeliveryCharge($payload);
        $coupon = $this->resolveApplicableCoupon($lineItems, $couponCode);
        $couponDiscountAmount = (float) ($coupon['discount_amount'] ?? 0);
        $tax = $baseTax;

        if (($coupon['tax_after_discount'] ?? false) === true && $couponDiscountAmount > 0) {
            $tax = round(max($baseTax - (float) ($coupon['tax_reduction_amount'] ?? 0), 0), 2);
        }

        $total = round(max($subtotal + $tax + $shipping - $couponDiscountAmount, 0), 2);

        return [
            'subtotal' => $subtotal,
            'tax' => $tax,
            'shipping' => $shipping,
            'total' => $total,
            'coupon_code' => $coupon['code'] ?? null,
            'coupon_discount_amount' => round($couponDiscountAmount, 2),
            'coupon_discount_type' => $coupon['discount_type'] ?? null,
            'coupon_setup_id' => $coupon['setup_id'] ?? null,
            'coupon' => $coupon['code'] ? [
                'code' => $coupon['code'],
                'name' => $coupon['name'],
                'discount_type' => $coupon['discount_type'],
                'discount_value' => (float) $coupon['discount_value'],
                'discount_amount' => round($couponDiscountAmount, 2),
                'eligible_subtotal' => round((float) $coupon['eligible_subtotal'], 2),
            ] : null,
        ];
    }

    private function resolveApplicableCoupon(Collection $lineItems, ?string $couponCode = null): array
    {
        $normalizedCode = strtoupper(trim((string) $couponCode));

        if ($normalizedCode === '') {
            return [
                'code' => null,
                'name' => null,
                'setup_id' => null,
                'discount_type' => null,
                'discount_value' => 0,
                'discount_amount' => 0,
                'eligible_subtotal' => 0,
                'tax_after_discount' => false,
                'tax_reduction_amount' => 0,
            ];
        }

        $companyId = EcommerceCompanyContext::currentCompanyId();
        $coupon = DiscountSetup::query()
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->whereRaw('UPPER(code) = ?', [$normalizedCode])
            ->where('type', 'coupon')
            ->where('is_active', true)
            ->whereDate('form_date', '<=', now()->toDateString())
            ->whereDate('to_date', '>=', now()->toDateString())
            ->first();

        if (! $coupon) {
            throw new \RuntimeException('Invalid or expired coupon code.');
        }

        $eligibleItems = $lineItems->filter(function (array $lineItem) use ($coupon) {
            $products = collect($coupon->products ?? [])->map(fn ($value) => (string) $value)->filter()->values()->all();
            $categories = collect($coupon->categories ?? [])->map(fn ($value) => (string) $value)->filter()->values()->all();
            $brands = collect($coupon->brands ?? [])->map(fn ($value) => (string) $value)->filter()->values()->all();
            $hasScope = ! empty($products) || ! empty($categories) || ! empty($brands);

            if (! $hasScope) {
                return true;
            }

            if (in_array((string) $lineItem['product_id'], $products, true)) {
                return true;
            }

            if (
                in_array((string) ($lineItem['category_id'] ?? ''), $categories, true)
                || in_array((string) ($lineItem['brand_id'] ?? ''), $brands, true)
            ) {
                return true;
            }

            return false;
        })->values();

        if ($eligibleItems->isEmpty()) {
            throw new \RuntimeException('This coupon is not applicable to the current cart items.');
        }

        $eligibleSubtotal = round((float) $eligibleItems->sum('line_subtotal'), 2);
        $discountType = $this->normalizeStorefrontDiscountType($coupon->discount_type);
        $discountValue = round((float) ($coupon->amount ?? 0), 2);
        $rawDiscountAmount = $discountType === 'percent'
            ? round($eligibleSubtotal * ($discountValue / 100), 2)
            : $discountValue;
        $discountAmount = round(min(max($rawDiscountAmount, 0), $eligibleSubtotal), 2);

        $taxAfterDiscount = (bool) $coupon->vat_applicable && (string) $coupon->vat_calculate_for === 'after_discount';
        $taxReductionAmount = 0.0;

        if ($taxAfterDiscount && $discountAmount > 0 && $eligibleSubtotal > 0) {
            $discountRatio = min($discountAmount / $eligibleSubtotal, 1);
            $taxReductionAmount = round((float) $eligibleItems->sum(function (array $lineItem) use ($discountRatio) {
                $discountedLineSubtotal = round((float) $lineItem['line_subtotal'] * $discountRatio, 2);
                return $discountedLineSubtotal * (((float) $lineItem['tax_rate']) / 100);
            }), 2);
        }

        return [
            'code' => (string) $coupon->code,
            'name' => (string) $coupon->name,
            'setup_id' => (string) $coupon->id,
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'discount_amount' => $discountAmount,
            'eligible_subtotal' => $eligibleSubtotal,
            'tax_after_discount' => $taxAfterDiscount,
            'tax_reduction_amount' => $taxReductionAmount,
        ];
    }

    private function normalizeStorefrontDiscountType($discountType): string
    {
        $normalizedType = strtolower(trim((string) $discountType));

        return in_array($normalizedType, ['percent', 'percentage'], true) ? 'percent' : 'fixed';
    }

    private function resolveGroupPurchaseForOrder(?string $groupPurchaseId, string $userId): ?GroupPurchase
    {
        if (! $groupPurchaseId) {
            return null;
        }

        $this->reconcileGroupPurchaseState($groupPurchaseId);

        $groupPurchase = GroupPurchase::query()
            ->lockForUpdate()
            ->find($groupPurchaseId);

        if (! $groupPurchase) {
            throw new \RuntimeException('Selected group purchase was not found.');
        }

        $isMember = GroupPurchaseMember::query()
            ->where('group_purchase_id', $groupPurchase->id)
            ->where('user_id', $userId)
            ->where('status', 'joined')
            ->exists();

        if (! $isMember) {
            throw new \RuntimeException('Join this group purchase before placing an order.');
        }

        $groupStatus = (string) $groupPurchase->status;
        $purchaseStatus = (string) ($groupPurchase->purchase_status ?? '');

        if ($groupStatus !== 'completed' || $purchaseStatus !== 'awaiting_purchases') {
            $joinedCount = GroupPurchaseMember::query()
                ->where('group_purchase_id', $groupPurchase->id)
                ->where('status', 'joined')
                ->count();
            $remainingMembers = max((int) $groupPurchase->minimum_users - $joinedCount, 0);

            if ($groupStatus === 'cancelled') {
                throw new \RuntimeException('This group purchase was cancelled.');
            }

            if ($purchaseStatus === 'awaiting_members' || $groupStatus === 'open') {
                if ($remainingMembers > 0) {
                    throw new \RuntimeException("This group still needs {$remainingMembers} more member".($remainingMembers > 1 ? 's' : '')." before checkout opens.");
                }

                throw new \RuntimeException('This group is still waiting for all required members to join.');
            }

            if ($purchaseStatus === 'discount_failed') {
                throw new \RuntimeException('This group purchase did not reach a valid checkout state, so member checkout is no longer available.');
            }

            if ($purchaseStatus === 'discount_unlocked') {
                throw new \RuntimeException('This group purchase has already been completed.');
            }

            throw new \RuntimeException('This group purchase is no longer accepting member orders.');
        }

        if ($groupPurchase->purchase_deadline_at && now()->greaterThan($groupPurchase->purchase_deadline_at)) {
            throw new \RuntimeException('This group purchase checkout window has expired.');
        }

        $existingOrder = CustomerOrder::query()
            ->where('group_purchase_id', $groupPurchase->id)
            ->where('user_id', $userId)
            ->where('order_status', '!=', 'cancelled')
            ->exists();

        if ($existingOrder) {
            throw new \RuntimeException('You have already placed your order for this group purchase.');
        }

        return $groupPurchase;
    }

    private function refreshGroupPurchaseAfterOrder(string $groupPurchaseId): void
    {
        $groupPurchase = GroupPurchase::query()
            ->lockForUpdate()
            ->find($groupPurchaseId);

        if (! $groupPurchase) {
            return;
        }

        $orders = CustomerOrder::query()
            ->where('group_purchase_id', $groupPurchase->id)
            ->where('order_status', '!=', 'cancelled')
            ->with(['items'])
            ->lockForUpdate()
            ->get();

        $eligibleOrders = $orders->filter(fn (CustomerOrder $order) => $this->isEligibleGroupPurchaseOrder($order));
        $purchaseCount = $eligibleOrders->pluck('user_id')->filter()->unique()->count();

        if ($groupPurchase->purchase_deadline_at && now()->greaterThan($groupPurchase->purchase_deadline_at) && $purchaseCount < (int) $groupPurchase->minimum_users) {
            $this->markGroupPurchaseAsFailed($groupPurchase, $orders);
            return;
        }

        $remainingRequiredOrders = max((int) $groupPurchase->minimum_users - $purchaseCount, 0);
        if ($remainingRequiredOrders > 0) {
            $product = Product::query()
                ->withoutGlobalScope('company')
                ->tap(fn ($query) => EcommerceCompanyContext::applyScope($query))
                ->with([
                    'inventory_items' => function ($query) {
                        EcommerceCompanyContext::applyScope($query->withoutGlobalScope('company'))
                            ->where('quantity', '>', 0)
                            ->with('salesChannels')
                            ->orderBy('created_at');
                    },
                ])
                ->find($groupPurchase->product_id);

            if ($product) {
                $availableQuantity = (int) floor($this->resolveAvailableQuantity($product));

                if ($availableQuantity < $remainingRequiredOrders) {
                    $this->markGroupPurchaseAsFailed($groupPurchase, $orders);
                    return;
                }
            }
        }

        if ($purchaseCount < (int) $groupPurchase->minimum_users) {
            return;
        }

        foreach ($eligibleOrders as $order) {
            $itemSubtotal = 0.0;
            $itemTaxTotal = 0.0;

            foreach ($order->items as $item) {
                $unitPrice = round((float) $groupPurchase->discounted_price, 2);
                $lineSubtotal = round($unitPrice * (float) $item->quantity, 2);
                $taxAmount = round($lineSubtotal * (((float) $item->tax_rate) / 100), 2);

                $item->unit_price = $unitPrice;
                $item->tax_amount = $taxAmount;
                $item->line_total = round($lineSubtotal + $taxAmount, 2);
                $item->save();

                $itemSubtotal += $lineSubtotal;
                $itemTaxTotal += $taxAmount;
            }

            $baseSubtotal = round((float) $groupPurchase->base_price, 2);
            $discountSubtotal = round((float) $itemSubtotal, 2);
            $groupDiscountAmount = max(round($baseSubtotal - $discountSubtotal, 2), 0);

            $order->subtotal = $discountSubtotal;
            $order->tax_amount = round($itemTaxTotal, 2);
            $order->total_amount = round($discountSubtotal + $itemTaxTotal + (float) $order->shipping_amount, 2);
            $order->group_discount_amount = $groupDiscountAmount;
            $order->group_purchase_discount_status = 'applied';
            $order->save();
        }

        $groupPurchase->purchase_status = 'discount_unlocked';
        $groupPurchase->discount_unlocked_at = now();
        $groupPurchase->save();
    }

    private function reconcileGroupPurchaseState(string $groupPurchaseId): void
    {
        $groupPurchase = GroupPurchase::query()
            ->lockForUpdate()
            ->find($groupPurchaseId);

        if (! $groupPurchase || (string) ($groupPurchase->purchase_status ?? '') !== 'awaiting_purchases') {
            return;
        }

        $orders = CustomerOrder::query()
            ->where('group_purchase_id', $groupPurchase->id)
            ->where('order_status', '!=', 'cancelled')
            ->with(['items'])
            ->lockForUpdate()
            ->get();

        $eligibleOrders = $orders->filter(fn (CustomerOrder $order) => $this->isEligibleGroupPurchaseOrder($order));
        $purchaseCount = $eligibleOrders->pluck('user_id')->filter()->unique()->count();

        if ($groupPurchase->purchase_deadline_at && now()->greaterThan($groupPurchase->purchase_deadline_at) && $purchaseCount < (int) $groupPurchase->minimum_users) {
            $this->markGroupPurchaseAsFailed($groupPurchase, $orders);
            return;
        }

        $remainingRequiredOrders = max((int) $groupPurchase->minimum_users - $purchaseCount, 0);
        if ($remainingRequiredOrders <= 0) {
            return;
        }

        $product = Product::query()
            ->withoutGlobalScope('company')
            ->tap(fn ($query) => EcommerceCompanyContext::applyScope($query))
            ->with([
                'inventory_items' => function ($query) {
                    EcommerceCompanyContext::applyScope($query->withoutGlobalScope('company'))
                        ->where('quantity', '>', 0)
                        ->with('salesChannels')
                        ->orderBy('created_at');
                },
            ])
            ->find($groupPurchase->product_id);

        if (! $product) {
            $this->markGroupPurchaseAsFailed($groupPurchase, $orders);
            return;
        }

        $availableQuantity = (int) floor($this->resolveAvailableQuantity($product));

        if ($availableQuantity < $remainingRequiredOrders) {
            $this->markGroupPurchaseAsFailed($groupPurchase, $orders);
        }
    }

    private function markGroupPurchaseAsFailed(GroupPurchase $groupPurchase, Collection $orders): void
    {
        foreach ($orders as $order) {
            if (! $order instanceof CustomerOrder) {
                continue;
            }

            if ((string) $order->order_status === 'pending' && (string) $order->payment_status !== 'paid') {
                $this->restoreInventoryFromOrder($order);
                $order->order_status = 'cancelled';
                $order->payment_status = 'failed';
                $order->group_purchase_discount_status = 'missed';
                $order->group_discount_amount = 0;
                $order->save();
                continue;
            }

            $itemSubtotal = 0.0;
            $itemTaxTotal = 0.0;

            foreach ($order->items as $item) {
                $unitPrice = round((float) $groupPurchase->base_price, 2);
                $lineSubtotal = round($unitPrice * (float) $item->quantity, 2);
                $taxAmount = round($lineSubtotal * (((float) $item->tax_rate) / 100), 2);

                $item->unit_price = $unitPrice;
                $item->tax_amount = $taxAmount;
                $item->line_total = round($lineSubtotal + $taxAmount, 2);
                $item->save();

                $itemSubtotal += $lineSubtotal;
                $itemTaxTotal += $taxAmount;
            }

            $order->subtotal = round($itemSubtotal, 2);
            $order->tax_amount = round($itemTaxTotal, 2);
            $order->total_amount = round($itemSubtotal + $itemTaxTotal + (float) $order->shipping_amount, 2);
            $order->group_discount_amount = 0;
            $order->group_purchase_discount_status = 'missed';
            $order->save();
        }

        $groupPurchase->purchase_status = 'discount_failed';
        $groupPurchase->discount_unlocked_at = null;
        $groupPurchase->save();
    }

    private function isEligibleGroupPurchaseOrder(CustomerOrder $order): bool
    {
        return (string) $order->order_status !== 'cancelled'
            && (string) $order->order_status !== 'pending';
    }

    private function resolveAvailableQuantity(Product $product): float
    {
        $inventoryItems = $product->inventory_items;
        $rawQuantity = (float) $inventoryItems->sum('quantity');

        $channelRows = $inventoryItems
            ->filter(fn ($item) => $item && $item->relationLoaded('salesChannels'))
            ->flatMap(fn ($item) => $item->salesChannels ?? collect())
            ->filter(fn ($channel) => strtoupper((string) $channel->channel_code) === SalesChannel::OnlineStore->value)
            ->values();

        if ($channelRows->isNotEmpty()) {
            return round(max((float) $channelRows->sum(fn ($channel) => (float) $channel->quantity), 0), 2);
        }

        if (Schema::hasTable('sales_channels')) {
            $channelQuantity = (float) InventorySalesChannel::query()
                ->where('channel_code', SalesChannel::OnlineStore->value)
                ->whereHas('inventoryItem', fn ($query) => $query->where('product_id', $product->id))
                ->sum('quantity');

            if ($channelQuantity > 0) {
                return round($channelQuantity, 2);
            }
        }

        $channels = is_array($product->sales_channel) ? $product->sales_channel : [];
        $onlinePercentage = (float) ($channels[SalesChannel::OnlineStore->value] ?? 100);

        if ($onlinePercentage <= 0) {
            return 0;
        }

        if ($onlinePercentage >= 100) {
            return round($rawQuantity, 2);
        }

        return round(($rawQuantity * $onlinePercentage) / 100, 2);
    }

    private function resolveOrderCompanyId(Collection $lineItems): ?string
    {
        $companyIds = $lineItems
            ->pluck('company_id')
            ->filter(fn ($companyId) => is_string($companyId) && trim($companyId) !== '')
            ->unique()
            ->values();

        return $companyIds->count() === 1 ? $companyIds->first() : null;
    }

    private function deductInventory(string $productId, float $quantity, ?array $combination = null): array
    {
        $remaining = $quantity;
        $normalizedCombination = $this->normalizeCombination((array) ($combination ?? []));
        $lastAllocation = [
            'inventory_id' => null,
            'inventory_item_id' => null,
        ];

        $inventoryItemsQuery = InventoryItem::query()
            ->withoutGlobalScope('company')
            ->tap(fn ($query) => EcommerceCompanyContext::applyScope($query))
            ->where('product_id', $productId)
            ->where('quantity', '>', 0);

        $this->constrainInventoryItemsToCombination($inventoryItemsQuery, $normalizedCombination);

        $hasOnlineChannelRows = Schema::hasTable('sales_channels')
            && $this->hasOnlineChannelRows($productId, $normalizedCombination);

        // When explicit online-channel rows exist, only those allocations are
        // sellable through this storefront. This keeps channel stock and item
        // stock from drifting apart during checkout.
        if ($hasOnlineChannelRows) {
            $inventoryItemsQuery->whereHas('salesChannels', function ($query) {
                $query->where('channel_code', SalesChannel::OnlineStore->value)
                    ->where('quantity', '>', 0);
            });
        }

        $inventoryItems = $inventoryItemsQuery
            ->orderBy('created_at')
            ->lockForUpdate()
            ->get();

        foreach ($inventoryItems as $inventoryItem) {
            if ($remaining <= 0) {
                break;
            }

            $available = (float) $inventoryItem->quantity;
            if ($available <= 0) {
                continue;
            }

            $deductQty = min($available, $remaining);

            // Keep the stock check in the UPDATE itself. The row lock handles
            // normal transactional databases, while this condition also makes
            // the decrement fail safely if another checkout changed the row.
            $updated = InventoryItem::query()
                ->withoutGlobalScope('company')
                ->tap(fn ($query) => EcommerceCompanyContext::applyScope($query))
                ->whereKey($inventoryItem->id)
                ->where('quantity', '>=', $deductQty)
                ->decrement('quantity', $deductQty);

            if ($updated !== 1) {
                continue;
            }

            $inventory = Inventory::query()
                ->withoutGlobalScope('company')
                ->tap(fn ($query) => EcommerceCompanyContext::applyScope($query))
                ->lockForUpdate()
                ->find($inventoryItem->inventory_id);

            if ($inventory) {
                $inventory->quantity = round(max(((float) $inventory->quantity) - $deductQty, 0), 2);
                $inventory->save();
            }

            if ($hasOnlineChannelRows) {
                $this->deductOnlineChannelQuantity($inventoryItem->id, $deductQty);
            }

            $remaining -= $deductQty;
            $lastAllocation = [
                'inventory_id' => $inventoryItem->inventory_id,
                'inventory_item_id' => $inventoryItem->id,
            ];
        }

        if ($remaining > 0) {
            throw new \RuntimeException('Inventory changed while placing the order. Please review your cart and try again.');
        }

        return $lastAllocation;
    }

    private function deductOnlineChannelQuantity(int|string $inventoryItemId, float $quantity): void
    {
        $remaining = $quantity;

        $channels = InventorySalesChannel::query()
            ->where('inventory_id', $inventoryItemId)
            ->where('channel_code', SalesChannel::OnlineStore->value)
            ->where('quantity', '>', 0)
            ->orderBy('created_at')
            ->lockForUpdate()
            ->get();

        foreach ($channels as $channel) {
            if ($remaining <= 0) {
                break;
            }

            $available = (float) $channel->quantity;
            $deductQty = min($available, $remaining);
            $updated = InventorySalesChannel::query()
                ->whereKey($channel->id)
                ->where('quantity', '>=', $deductQty)
                ->decrement('quantity', $deductQty);

            if ($updated !== 1) {
                continue;
            }

            $remaining -= $deductQty;
        }

        if ($remaining > 0) {
            throw new \RuntimeException('Online stock changed while placing the order. Please review your cart and try again.');
        }
    }

    private function hasOnlineChannelRows(string $productId, array $combination = []): bool
    {
        if (! Schema::hasTable('sales_channels')) {
            return false;
        }

        return InventorySalesChannel::query()
            ->where('channel_code', SalesChannel::OnlineStore->value)
            ->whereHas('inventoryItem', function ($query) use ($productId, $combination) {
                $query->withoutGlobalScope('company');
                EcommerceCompanyContext::applyScope($query);
                $query->where('product_id', $productId);
                $this->constrainInventoryItemsToCombination($query, $combination);
            })
            ->exists();
    }

    private function constrainInventoryItemsToCombination($query, array $combination): void
    {
        if ($combination === []) {
            return;
        }

        $combinationJson = json_encode($combination, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        $query->where(function ($variantQuery) use ($combination, $combinationJson) {
            $variantQuery->where('variant_id', $combinationJson)
                ->orWhereJsonContains('variant_id', $combination);
        });
    }

    private function normalizeCombination(array $combination): array
    {
        $normalized = [];

        foreach ($combination as $key => $value) {
            if ($value === null) {
                continue;
            }

            $normalized[(string) $key] = is_string($value) ? trim($value) : (string) $value;
        }

        ksort($normalized);

        return $normalized;
    }

    private function restoreInventoryFromOrder(CustomerOrder $order): void
    {
        foreach ($order->items as $item) {
            if ($item->inventory_item_id) {
                $inventoryItem = InventoryItem::query()
                    ->withoutGlobalScope('company')
                    ->tap(fn ($query) => EcommerceCompanyContext::applyScope($query))
                    ->lockForUpdate()
                    ->find($item->inventory_item_id);

                if ($inventoryItem) {
                    $inventoryItem->quantity = round((float) $inventoryItem->quantity + (float) $item->quantity, 2);
                    $inventoryItem->save();
                }
            }

            if ($item->inventory_id) {
                $inventory = Inventory::query()
                    ->withoutGlobalScope('company')
                    ->tap(fn ($query) => EcommerceCompanyContext::applyScope($query))
                    ->lockForUpdate()
                    ->find($item->inventory_id);

                if ($inventory) {
                    $inventory->quantity = round((float) $inventory->quantity + (float) $item->quantity, 2);
                    $inventory->save();
                }
            }

            if (Schema::hasTable('sales_channels') && $item->inventory_item_id) {
                $this->restoreOnlineChannelQuantity($item->inventory_item_id, (float) $item->quantity);
            }
        }
    }

    private function restoreOnlineChannelQuantity(int|string $inventoryItemId, float $quantity): void
    {
        $channel = InventorySalesChannel::query()
            ->where('inventory_id', $inventoryItemId)
            ->where('channel_code', SalesChannel::OnlineStore->value)
            ->lockForUpdate()
            ->first();

        if ($channel) {
            $channel->quantity = round((float) $channel->quantity + $quantity, 2);
            $channel->save();
            return;
        }

        InventorySalesChannel::query()->create([
            'id' => (string) Str::uuid(),
            'inventory_id' => (string) $inventoryItemId,
            'channel_code' => SalesChannel::OnlineStore->value,
            'quantity' => round($quantity, 2),
        ]);
    }

    private function resolveCheckoutGateway(array $payload): ?Gateway
    {
        if (($payload['payment_method'] ?? 'cod') !== 'gateway') {
            return null;
        }

        $company = $this->resolveCurrentCompany();
        if (! $company || ! PermissionUtils::isFeatureAccessible($company->company_id, FeaturePreference::PAYMENT_GATEWAY->value)) {
            throw new \RuntimeException('Selected payment gateway is not available.');
        }

        $gatewayId = (string) ($payload['gateway_id'] ?? '');
        if ($gatewayId === '') {
            throw new \RuntimeException('Please select an online payment gateway.');
        }

        $gatewayAvailability = $this->resolveCompanyGatewayAvailability();
        $gateway = Gateway::query()
            ->with('currency')
            ->where('id', $gatewayId)
            ->where('status', 1)
            ->where('gateway_type', '!=', 'manual')
            ->first();

        if (!$gateway || !$this->isGatewayEnabledForCompany($gateway, $gatewayAvailability)) {
            throw new \RuntimeException('Selected payment gateway is not available.');
        }

        return $gateway;
    }

    private function resolveCurrentCompany(): ?Company
    {
        $companyId = EcommerceCompanyContext::currentCompanyId();

        if (!$companyId) {
            return null;
        }

        return Company::query()->find($companyId);
    }

    private function companyAllowsGuestCheckout(?Company $company): bool
    {
        if (! $company || ! Schema::hasColumn('company', 'allow_guest_checkout')) {
            return false;
        }

        return (bool) ($company->allow_guest_checkout ?? false);
    }

    private function resolveCompanyGatewayAvailability(): ?Collection
    {
        $company = $this->resolveCurrentCompany();
        $settings = $company?->payment_gateway_settings;

        if (!is_array($settings) || empty($settings)) {
            return null;
        }

        return collect($settings)
            ->filter(fn ($item) => is_array($item))
            ->map(function (array $item) {
                return [
                    'id' => isset($item['id']) ? (string) $item['id'] : null,
                    'name' => isset($item['name']) ? strtolower(trim((string) $item['name'])) : null,
                    'enabled' => filter_var($item['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN),
                ];
            });
    }

    private function isGatewayEnabledForCompany(Gateway $gateway, ?Collection $gatewayAvailability): bool
    {
        if ($gatewayAvailability === null) {
            return true;
        }

        $match = $gatewayAvailability->first(function (array $item) use ($gateway) {
            return (!empty($item['id']) && $item['id'] === (string) $gateway->id)
                || (!empty($item['name']) && $item['name'] === strtolower(trim((string) $gateway->name)));
        });

        return $match ? (bool) ($match['enabled'] ?? false) : false;
    }

    private function resolveDeliveryCharge(array $payload = []): float
    {
        $company = $this->resolveCurrentCompany();
        $settings = $company?->delivery_charge_settings;

        if (
            ! $company
            || !is_array($settings)
            || empty($settings)
        ) {
            return 0.0;
        }

        $defaultCharge = round((float) ($settings['default_charge'] ?? 0), 2);
        $deliveryChargeMode = strtolower(trim((string) ($settings['delivery_charge_mode'] ?? 'inside_outside')));
        if ($deliveryChargeMode === 'free') {
            return 0.0;
        }
        $supportsLocationDelivery = app(CompanyPlanFeatureService::class)->isFeatureAllowedByPlan(
            $company->company_id,
            FeaturePreference::SHOP_DELIVERY_SUPPORT->value
        );

        $isZonalDelivery = $deliveryChargeMode === 'zonal';
        if ($isZonalDelivery && ! $supportsLocationDelivery) {
            return $defaultCharge;
        }
        if (! $isZonalDelivery && $deliveryChargeMode !== 'inside_outside') {
            return $defaultCharge;
        }

        $delivery = is_array($payload['delivery'] ?? null) ? $payload['delivery'] : [];
        $shipping = is_array($payload['shipping'] ?? null) ? $payload['shipping'] : [];
        $requestedDivision = strtolower(trim((string) ($delivery['division_name'] ?? $shipping['division_name'] ?? '')));
        $requestedUpazila = strtolower(trim((string) ($delivery['upazila_name'] ?? $shipping['upazila_name'] ?? $shipping['city'] ?? '')));
        $requestedDistrict = strtolower(trim((string) ($delivery['district_name'] ?? $shipping['district_name'] ?? '')));

        if (! $isZonalDelivery) {
            if (str_contains($requestedDistrict, 'dhaka')) {
                return round((float) ($settings['inside_dhaka_charge'] ?? $defaultCharge), 2);
            }

            return $requestedDistrict !== ''
                ? round((float) ($settings['outside_dhaka_charge'] ?? $defaultCharge), 2)
                : $defaultCharge;
        }

        $matchedSpecificCharge = collect($settings['specific_charges'] ?? [])
            ->filter(fn ($item) => is_array($item))
            ->first(function (array $item) use ($requestedDivision, $requestedDistrict, $requestedUpazila) {
                $scope = strtolower(trim((string) ($item['scope'] ?? '')));
                $zone = strtolower(trim((string) ($item['zone'] ?? '')));

                if (in_array($scope, ['upazila', 'thana'], true)) {
                    return $requestedUpazila !== '' && $zone === $requestedUpazila;
                }

                if ($scope === 'district') {
                    return $requestedDistrict !== '' && $zone === $requestedDistrict;
                }

                 if ($scope === 'division') {
                    return $requestedDivision !== '' && $zone === $requestedDivision;
                }

                return false;
            });

        if ($matchedSpecificCharge) {
            return round((float) ($matchedSpecificCharge['price'] ?? 0), 2);
        }

        return $defaultCharge;
    }

    private function initializeGatewayPayment(CustomerOrder $order, Gateway $gateway, ?string $frontendUrl): array
    {
        try {
            $order->loadMissing(['user', 'items']);
            $order->setRelation('gateway', $gateway->loadMissing('currency'));
            $order->payable_amount = (float) $order->total_amount;
            $order->trx = (string) $order->order_no;
            $paymentPayload = [
                'frontend_url' => $this->sanitizeFrontendUrl($frontendUrl),
            ];
            $order->payment_payload = $paymentPayload;
            $order->persistGatewayAttributes([
                'payment_payload' => $paymentPayload,
                'payable_amount' => (float) $order->total_amount,
                'trx' => (string) $order->order_no,
            ]);

            $response = PaymentGatewayFactory::create($gateway->name)->process($order, 'order-payment');

            if (($response['type'] ?? null) === 'redirect' && !empty($response['url'])) {
                return [
                    'type' => 'redirect',
                    'redirect_url' => $response['url'],
                ];
            }
        } catch (ValidationException $exception) {
            $this->cancelGatewayOrderPayment($order);

            return [
                'type' => 'failed',
                'message' => collect($exception->errors())->flatten()->filter()->first() ?: 'Gateway is currently unavailable. Please try another option.',
            ];
        } catch (\Throwable $exception) {
            $this->cancelGatewayOrderPayment($order);

            return [
                'type' => 'failed',
                'message' => $exception->getMessage() ?: 'Gateway initialization failed.',
            ];
        }

        return [
            'type' => 'redirect',
            'redirect_url' => route('order-payment-success', $order->order_no),
        ];
    }

    private function sanitizeFrontendUrl(?string $url): ?string
    {
        if (!is_string($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
            return null;
        }

        return rtrim($url, '/');
    }

    private function formatShippingAddress(UserShipping $address): array
    {
        return [
            'id' => (string) $address->id,
            'full_name' => (string) $address->full_name,
            'email' => $address->email,
            'phone' => (string) $address->phone,
            'address' => (string) $address->address,
            'division_name' => $address->division_name ? (string) $address->division_name : null,
            'district_name' => $address->district_name ? (string) $address->district_name : null,
            'upazila_name' => $address->upazila_name ? (string) $address->upazila_name : null,
            'city' => (string) $address->city,
            'country' => (string) $address->country,
            'postal_code' => $address->postal_code,
            'is_default' => (bool) $address->is_default,
        ];
    }

    private function formatOrder(CustomerOrder $order): array
    {
        if ($order->group_purchase_id) {
            $this->reconcileGroupPurchaseState((string) $order->group_purchase_id);
            $order = $order->fresh(['items', 'shippingAddress', 'company', 'groupPurchase']) ?? $order;
        }

        $status = (string) $order->order_status;
        $reviewsByProduct = ProductReview::withoutGlobalScopes()
            ->where('order_id', $order->id)
            ->where('user_id', $order->user_id)
            ->get()
            ->keyBy('product_id');

        return [
            'id' => (string) $order->id,
            'order_id' => (string) $order->order_no,
            'status' => $status,
            'status_label' => $this->formatStatusLabel($status),
            'payment_method' => (string) $order->payment_method,
            'payment_status' => (string) $order->payment_status,
            'date' => optional($order->placed_at ?? $order->created_at)?->format('M j, Y'),
            'placed_at' => optional($order->placed_at ?? $order->created_at)?->toIso8601String(),
            'subtotal' => (float) $order->subtotal,
            'tax_amount' => (float) $order->tax_amount,
            'shipping_amount' => (float) $order->shipping_amount,
            'delivery_charge' => (float) $order->shipping_amount,
            'total_amount' => (float) $order->total_amount,
            'group_discount_amount' => (float) ($order->group_discount_amount ?? 0),
            'coupon_code' => $order->coupon_code ? (string) $order->coupon_code : null,
            'coupon_discount_amount' => (float) ($order->coupon_discount_amount ?? 0),
            'group_purchase_discount_status' => (string) ($order->group_purchase_discount_status ?? 'none'),
            'estimated_delivery' => $this->estimatedDelivery($order),
            'tracking_note' => $this->trackingNote($status),
            'tracking_steps' => $this->trackingSteps($status),
            'shipping' => $order->shippingAddress ? $this->formatShippingAddress($order->shippingAddress) : null,
            'seller' => [
                'name' => (string) ($order->company?->name ?: 'Seller support'),
                'contact_name' => (string) ($order->company?->contact_name ?: 'Support Team'),
                'email' => $order->company?->email,
                'phone' => $order->company?->phone_number,
                'address' => $order->company?->address,
            ],
            'group_purchase' => $order->groupPurchase ? [
                'id' => (string) $order->groupPurchase->id,
                'status' => (string) $order->groupPurchase->status,
                'purchase_status' => (string) ($order->groupPurchase->purchase_status ?? 'awaiting_members'),
                'discounted_price' => (float) $order->groupPurchase->discounted_price,
                'purchase_deadline_at' => optional($order->groupPurchase->purchase_deadline_at)?->toIso8601String(),
                'discount_unlocked_at' => optional($order->groupPurchase->discount_unlocked_at)?->toIso8601String(),
            ] : null,
            'items' => $order->items->map(fn (CustomerOrderItem $item) => [
                'return_info' => $this->formatItemReturnInfo($order, $item),
                'id' => (string) $item->id,
                'product_id' => (string) $item->product_id,
                'name' => (string) $item->product_name,
                'slug' => (string) ($item->product_slug ?? ''),
                'image' => (string) ($item->product_image ?: asset('images/placeholder.jpg')),
                'brand_name' => (string) ($item->brand_name ?? ''),
                'category_name' => (string) ($item->category_name ?? ''),
                'quantity' => (float) $item->quantity,
                'price' => (float) $item->unit_price,
                'tax_rate' => (float) $item->tax_rate,
                'tax_amount' => (float) $item->tax_amount,
                'line_total' => (float) $item->line_total,
                'variant_label' => $this->resolveOrderItemVariantLabel($item),
                'variant_selection' => $this->resolveOrderItemVariantSelection($item),
                'review' => $reviewsByProduct->has((string) $item->product_id)
                    ? $this->formatReview($reviewsByProduct->get((string) $item->product_id))
                    : null,
            ])->values(),
        ];
    }

    private function formatReview(ProductReview $review): array
    {
        return [
            'id' => (string) $review->id,
            'rating' => (int) $review->rating,
            'comment' => $review->comment,
            'created_at' => optional($review->created_at)?->toIso8601String(),
        ];
    }

    private function resolveOrderItemVariantSelection(CustomerOrderItem $item): ?array
    {
        $variant = $item->inventoryItem?->variant_id ?? $item->inventory?->variant_id ?? null;

        return is_array($variant) && ! empty($variant) ? $variant : null;
    }

    private function resolveOrderItemVariantLabel(CustomerOrderItem $item): ?string
    {
        $variant = $this->resolveOrderItemVariantSelection($item);

        if (! is_array($variant) || empty($variant)) {
            return null;
        }

        $label = collect($variant)
            ->filter(fn ($value) => filled($value))
            ->map(fn ($value, $key) => ucfirst(str_replace(['-', '_'], ' ', (string) $key)) . ': ' . $value)
            ->implode(', ');

        return $label !== '' ? $label : null;
    }

    private function formatStatusLabel(string $status): string
    {
        return match ($status) {
            'pending' => 'Pending',
            'processing' => 'Processing',
            'shipped' => 'Shipped',
            'delivered' => 'Delivered',
            'cancelled' => 'Cancelled',
            'returned' => 'Returned',
            default => ucfirst(str_replace('_', ' ', $status)),
        };
    }

    private function trackingSteps(string $status): array
    {
        $statusOrder = [
            'pending' => 1,
            'processing' => 2,
            'shipped' => 3,
            'delivered' => 4,
            'returned' => 5,
            'cancelled' => 0,
        ];

        $currentStep = $statusOrder[$status] ?? 2;

        return collect([
            ['id' => 1, 'label' => 'Order Placed'],
            ['id' => 2, 'label' => 'Processing'],
            ['id' => 3, 'label' => 'Shipped'],
            ['id' => 4, 'label' => 'Delivered'],
        ])->map(function (array $step) use ($currentStep, $status) {
            return [
                ...$step,
                'completed' => $status !== 'cancelled' && $step['id'] <= $currentStep,
                'current' => $status !== 'cancelled' && $step['id'] === $currentStep,
            ];
        })->values()->all();
    }

    private function estimatedDelivery(CustomerOrder $order): ?string
    {
        $baseDate = $order->placed_at ?? $order->created_at;
        if (! $baseDate instanceof Carbon) {
            return null;
        }

        if ((string) $order->order_status === 'delivered') {
            return $baseDate->copy()->format('M j, Y');
        }

        return $baseDate->copy()->addDays(5)->format('M j, Y');
    }

    private function trackingNote(string $status): string
    {
        return match ($status) {
            'pending' => 'Your order has been received and is waiting for seller confirmation.',
            'processing' => 'The seller is preparing your order for shipment.',
            'shipped' => 'Your package is on the way. Tracking progress will update after the next scan.',
            'delivered' => 'This order has been delivered successfully.',
            'cancelled' => 'This order was cancelled before shipment.',
            'returned' => 'This order has been marked as returned.',
            default => 'Order status updates will appear here.',
        };
    }

    private function formatItemReturnInfo(CustomerOrder $order, CustomerOrderItem $item): array
    {
        if (! Schema::hasTable('order_return_requests')) {
            return [
                'return_enabled' => false,
                'return_day' => null,
                'return_condition' => [],
                'can_request_return' => false,
                'message' => '',
                'expires_at' => null,
                'request' => null,
            ];
        }

        $eligibility = $this->resolveReturnEligibility($order, $item);
        $returnRequest = $item->returnRequest;
        $returnSetup = $item->product?->returnSetup;

        return [
            'return_enabled' => (bool) ($returnSetup?->return_enabled ?? false),
            'return_day' => $returnSetup?->return_day !== null ? (int) $returnSetup->return_day : null,
            'return_condition' => $returnSetup?->return_condition ?? [],
            'can_request_return' => (bool) $eligibility['can_request_return'],
            'message' => (string) ($eligibility['message'] ?? ''),
            'expires_at' => $eligibility['expires_at'],
            'request' => $returnRequest ? $this->formatReturnRequest($returnRequest) : null,
        ];
    }

    private function resolveReturnEligibility(CustomerOrder $order, CustomerOrderItem $item): array
    {
        $returnSetup = $item->product?->returnSetup;
        $returnRequest = $item->returnRequest;

        if (! $returnSetup || ! $returnSetup->return_enabled) {
            return [
                'can_request_return' => false,
                'message' => 'Return is not enabled for this product.',
                'expires_at' => null,
            ];
        }

        if ($returnRequest) {
            return [
                'can_request_return' => false,
                'message' => match ((string) $returnRequest->status) {
                    'approved' => 'Return has already been approved for this item.',
                    'rejected' => 'A return request for this item was already reviewed.',
                    default => 'A return request for this item is already pending.',
                },
                'expires_at' => null,
            ];
        }

        $returnDay = max((int) ($returnSetup->return_day ?? 0), 0);
        if ($returnDay <= 0) {
            return [
                'can_request_return' => false,
                'message' => 'Return window is not configured for this product.',
                'expires_at' => null,
            ];
        }

        $baseDate = $order->placed_at ?? $order->created_at;
        if (! $baseDate instanceof Carbon) {
            return [
                'can_request_return' => false,
                'message' => 'Return window could not be calculated.',
                'expires_at' => null,
            ];
        }

        $expiresAt = $baseDate->copy()->addDays($returnDay)->endOfDay();

        if (now()->greaterThan($expiresAt)) {
            return [
                'can_request_return' => false,
                'message' => 'The return window for this item has expired.',
                'expires_at' => $expiresAt->toIso8601String(),
            ];
        }

        if (in_array((string) $order->order_status, ['cancelled', 'returned'], true)) {
            return [
                'can_request_return' => false,
                'message' => 'Return is not available for this order status.',
                'expires_at' => $expiresAt->toIso8601String(),
            ];
        }

        return [
            'can_request_return' => true,
            'message' => 'Return is available for this item.',
            'expires_at' => $expiresAt->toIso8601String(),
        ];
    }

    private function formatReturnRequest(OrderReturnRequest $request): array
    {
        return [
            'id' => (string) $request->id,
            'status' => (string) $request->status,
            'reason' => (string) $request->reason,
            'refund_amount' => (float) $request->refund_amount,
            'rejection_reason' => $request->rejection_reason,
            'requested_at' => optional($request->requested_at ?? $request->created_at)?->toIso8601String(),
            'resolved_at' => optional($request->resolved_at)?->toIso8601String(),
        ];
    }
}
