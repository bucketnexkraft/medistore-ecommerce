<?php

namespace App\Services\Api;

use App\Models\CustomerOrder;
use App\Models\Company;
use App\Models\CustomerOrderItem;
use App\Models\GroupPurchase;
use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Models\OrderReturnRequest;
use App\Models\SalesChannel;
use App\Models\User;
use App\Models\UserShipping;
use App\Services\CompanySmsService;
use App\Services\Api\CommissionSubscriptionService;
use Carbon\Carbon;
use Milon\Barcode\Facades\DNS2DFacade as DNS2D;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CompanyOrderService
{
    private function applyCompanyFilter($query, ?string $companyId)
    {
        if ($companyId === null || $companyId === '') {
            return $query;
        }

        return $query->whereRaw(
            $query->getModel()->qualifyColumn('company_id') . ' COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci',
            [$companyId]
        );
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'order_no' => 'nullable|string|max:40',
            'customer_name' => 'required|string|max:255',
            'customer_phone' => 'required|string|max:100',
            'customer_email' => 'nullable|email|max:255',
            'customer_address' => 'required|string|max:1000',
            'customer_city' => 'required|string|max:120',
            'customer_country' => 'required|string|max:120',
            'postal_code' => 'nullable|string|max:40',
            'courier_partner' => 'required|string|max:60',
            'payment_method' => 'required|string|in:cod,gateway',
            'payment_status' => 'nullable|string|in:pending,paid,failed,refunded',
            'order_status' => 'nullable|string|in:pending,processing,shipped,delivered,cancelled,returned',
            'amount' => 'required|numeric|min:0',
            'shipping_fee' => 'nullable|numeric|min:0',
            'discount' => 'nullable|numeric|min:0',
            'coupon_code' => 'nullable|string|max:120',
            'service_level' => 'nullable|string|max:60',
            'priority' => 'nullable|string|max:40',
            'items_count' => 'nullable|integer|min:1',
            'note' => 'nullable|string|max:2000',
            'item_weight' => 'nullable|numeric|min:0.5|max:10',
            'item_type' => 'nullable|integer|in:1,2',
            'delivery_type' => 'nullable|integer|in:12,48',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $payload = $validator->validated();
        $authUser = Auth::user();
        $companyId = (string) ($authUser?->company_id ?? '');

        try {
            $order = DB::transaction(function () use ($payload, $companyId) {
                $customer = $this->resolveDraftCustomer($payload, $companyId);
                $shipping = $this->storeShippingAddress((string) $customer->id, [
                    'first_name' => trim((string) $payload['customer_name']),
                    'last_name' => '',
                    'email' => filled($payload['customer_email'] ?? null) ? trim((string) $payload['customer_email']) : null,
                    'phone' => trim((string) $payload['customer_phone']),
                    'address' => trim((string) $payload['customer_address']),
                    'city' => trim((string) $payload['customer_city']),
                    'country' => trim((string) $payload['customer_country']),
                    'postal_code' => filled($payload['postal_code'] ?? null) ? trim((string) $payload['postal_code']) : null,
                ]);

                $subtotal = round((float) ($payload['amount'] ?? 0), 2);
                $shippingAmount = round((float) ($payload['shipping_fee'] ?? 0), 2);
                $discountAmount = round((float) ($payload['discount'] ?? 0), 2);
                $totalAmount = round(max(0, $subtotal + $shippingAmount - $discountAmount), 2);

                $order = CustomerOrder::query()->create([
                    'order_no' => filled($payload['order_no'] ?? null) ? trim((string) $payload['order_no']) : null,
                    'user_id' => (string) $customer->id,
                    'user_shipping_id' => $shipping->id,
                    'company_id' => $companyId !== '' ? $companyId : null,
                    'payment_method' => (string) $payload['payment_method'],
                    'payment_status' => (string) ($payload['payment_status'] ?? 'pending'),
                    'order_status' => (string) ($payload['order_status'] ?? 'pending'),
                    'subtotal' => $subtotal,
                    'tax_amount' => 0,
                    'shipping_amount' => $shippingAmount,
                    'total_amount' => $totalAmount,
                    'group_discount_amount' => 0,
                    'coupon_code' => filled($payload['coupon_code'] ?? null) ? trim((string) $payload['coupon_code']) : null,
                    'coupon_discount_amount' => $discountAmount,
                    'remarks' => trim(sprintf(
                        'Courier partner: %s | Service level: %s | Priority: %s | Note: %s',
                        (string) $payload['courier_partner'],
                        (string) ($payload['service_level'] ?? 'standard'),
                        (string) ($payload['priority'] ?? 'normal'),
                        trim((string) ($payload['note'] ?? ''))
                    )),
                    'trx' => 'CRT-' . now()->format('YmdHis'),
                    'placed_at' => now(),
                ]);

                return $order->load([
                    'user:id,first_name,last_name,email,phone',
                    'shippingAddress:id,full_name,email,phone,address,division_name,district_name,upazila_name,city,country,postal_code',
                    'items',
                    'groupPurchase.product:id,name,slug,featured_image,thumbnail',
                ]);
            });
        } catch (\Throwable $exception) {
            return response()->json([
                'status' => 0,
                'message' => $exception->getMessage() ?: 'Order could not be created.',
            ], 422);
        }

        if (strtolower((string) $payload['courier_partner']) === 'pathao') {
            $company = Company::query()->find($companyId);

            if (! $company) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Company was not found for Pathao submission.',
                    'data' => $this->formatOrderDetails($order),
                ], 422);
            }

            try {
                $pathaoResult = app(PathaoCourierService::class)->createOrder($company, [
                    'merchant_order_id' => (string) $order->order_no,
                    'recipient_name' => (string) $payload['customer_name'],
                    'recipient_phone' => (string) $payload['customer_phone'],
                    'recipient_address' => trim(implode(', ', array_filter([
                        $payload['customer_address'],
                        $payload['customer_city'],
                        $payload['postal_code'] ?? null,
                    ]))),
                    'delivery_type' => (int) ($payload['delivery_type'] ?? 48),
                    'item_type' => (int) ($payload['item_type'] ?? 2),
                    'special_instruction' => (string) ($payload['note'] ?? ''),
                    'item_quantity' => (int) ($payload['items_count'] ?? 1),
                    'item_weight' => (float) ($payload['item_weight'] ?? 0.5),
                    'item_description' => trim((string) ($payload['note'] ?? '')) ?: 'Order ' . (string) $order->order_no,
                    'amount_to_collect' => (string) $payload['payment_method'] === 'cod' ? (float) $order->total_amount : 0,
                ]);

                $order->payment_payload = array_merge($order->payment_payload ?? [], [
                    'courier' => [
                        'partner' => 'pathao',
                        ...$pathaoResult,
                        'submitted_at' => now()->toIso8601String(),
                    ],
                ]);
                $order->save();
            } catch (\Throwable $exception) {
                $order->payment_payload = array_merge($order->payment_payload ?? [], [
                    'courier' => [
                        'partner' => 'pathao',
                        'status' => 'submission_failed',
                        'message' => $exception->getMessage(),
                        'failed_at' => now()->toIso8601String(),
                    ],
                ]);
                $order->save();

                return response()->json([
                    'status' => 0,
                    'message' => 'Local order was saved, but Pathao rejected the shipment: ' . $exception->getMessage(),
                    'data' => $this->formatOrderDetails($order),
                ], 422);
            }
        }

        return response()->json([
            'status' => 1,
            'message' => strtolower((string) $payload['courier_partner']) === 'pathao'
                ? 'Courier order created and submitted to Pathao successfully.'
                : 'Courier order created successfully.',
            'data' => $this->formatOrderDetails($order),
        ], 201);
    }

    public function index(Request $request)
    {
        $perPage = max(1, min((int) $request->input('perPage', 10), 100));
        $page = max(1, (int) $request->input('page', 1));
        $search = trim((string) $request->input('search', ''));
        $status = trim((string) $request->input('status', ''));
        $paymentStatus = trim((string) $request->input('payment_status', ''));
        $type = trim((string) $request->input('type', ''));
        $sortField = (string) $request->input('sortField', 'placed_at');
        $sortOrder = strtolower((string) $request->input('sortOrder', 'desc')) === 'asc' ? 'asc' : 'desc';

        $allowedSortFields = ['placed_at', 'created_at', 'order_no', 'order_status', 'payment_status', 'total_amount'];
        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'placed_at';
        }

        $query = CustomerOrder::query()
            ->with([
                'user:id,first_name,last_name,email,phone',
                'shippingAddress:id,full_name,email,phone,address,division_name,district_name,upazila_name,city,country,postal_code',
                'items',
                'groupPurchase.product:id,name,slug,featured_image,thumbnail',
            ]);

        if (! Auth::user()?->isSuperAdmin()) {
            $this->applyCompanyFilter($query, (string) Auth::user()?->company_id);
        }

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder->where('order_no', 'like', '%' . $search . '%')
                    ->orWhereRaw(
                        'EXISTS (
                            SELECT 1
                            FROM `user`
                            WHERE `orders`.`user_id` COLLATE utf8mb4_unicode_ci = `user`.`id` COLLATE utf8mb4_unicode_ci
                              AND (`first_name` LIKE ? OR `last_name` LIKE ? OR `email` LIKE ? OR `phone` LIKE ?)
                        )',
                        array_fill(0, 4, '%' . $search . '%')
                    )
                    ->orWhereRaw(
                        'EXISTS (
                            SELECT 1
                            FROM `order_items`
                            WHERE `orders`.`id` COLLATE utf8mb4_unicode_ci = `order_items`.`order_id` COLLATE utf8mb4_unicode_ci
                              AND (`product_name` LIKE ? OR `product_slug` LIKE ?)
                        )',
                        ['%' . $search . '%', '%' . $search . '%']
                    );
            });
        }

        if ($status !== '' && $status !== 'all') {
            $query->where('order_status', $status);
        }

        if ($paymentStatus !== '' && $paymentStatus !== 'all') {
            $query->where('payment_status', $paymentStatus);
        }

        if ($type === 'group') {
            $query->whereNotNull('group_purchase_id');
        } elseif ($type === 'regular') {
            $query->whereNull('group_purchase_id');
        }

        $query->orderBy($sortField, $sortOrder)->orderByDesc('created_at');

        /** @var LengthAwarePaginator $orders */
        $orders = $query->paginate($perPage, ['*'], 'page', $page);

        $orders->setCollection(
            $orders->getCollection()->map(fn (CustomerOrder $order) => $this->formatOrderSummary($order))
        );

        $statsQuery = CustomerOrder::query();
        if (! Auth::user()?->isSuperAdmin()) {
            $this->applyCompanyFilter($statsQuery, (string) Auth::user()?->company_id);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Company orders fetched successfully.',
            'data' => $orders->items(),
            'meta' => [
                'current_page' => $orders->currentPage(),
                'per_page' => $orders->perPage(),
                'total' => $orders->total(),
                'last_page' => $orders->lastPage(),
            ],
            'others_data' => [
                'summary' => [
                    'total_orders' => (clone $statsQuery)->count(),
                    'group_orders' => (clone $statsQuery)->whereNotNull('group_purchase_id')->count(),
                    'pending_orders' => (clone $statsQuery)->whereIn('order_status', ['pending', 'processing'])->count(),
                    'delivered_orders' => (clone $statsQuery)->where('order_status', 'delivered')->count(),
                ],
            ],
        ]);
    }

    public function show(string $id)
    {
        $order = $this->resolveCompanyOrder($id);

        if (! $order) {
            return response()->json([
                'status' => 0,
                'message' => 'Order not found.',
            ], 404);
        }

        $order->loadMissing([
            'user:id,first_name,last_name,email,phone',
            'shippingAddress:id,full_name,email,phone,address,division_name,district_name,upazila_name,city,country,postal_code',
            'items',
            'groupPurchase.product:id,name,slug,featured_image,thumbnail',
        ]);
        $order = $this->syncPathaoStatus($order);

        return response()->json([
            'status' => 1,
            'message' => 'Order fetched successfully.',
            'data' => $this->formatOrderDetails($order),
        ]);
    }

    public function dispatchToPathao(string $id)
    {
        $order = $this->resolveCompanyOrder($id);

        if (! $order) {
            return response()->json(['status' => 0, 'message' => 'Order not found.'], 404);
        }

        $existingConsignmentId = data_get($order->payment_payload, 'courier.consignment_id');
        if (filled($existingConsignmentId)) {
            return response()->json([
                'status' => 1,
                'message' => 'This order is already submitted to Pathao.',
                'data' => $this->formatOrderDetails($order),
            ]);
        }

        $order->loadMissing(['user', 'shippingAddress', 'items', 'company']);
        $shipping = $order->shippingAddress;
        $customer = $order->user;

        if (! $order->company || ! $shipping) {
            return response()->json(['status' => 0, 'message' => 'Company or shipping address is missing.'], 422);
        }

        try {
            $pathaoResult = app(PathaoCourierService::class)->createOrder($order->company, [
                'merchant_order_id' => (string) $order->order_no,
                'recipient_name' => (string) ($shipping->full_name ?: trim(($customer?->first_name ?? '') . ' ' . ($customer?->last_name ?? ''))),
                'recipient_phone' => (string) ($shipping->phone ?: $customer?->phone),
                'recipient_address' => trim(implode(', ', array_filter([
                    $shipping->address,
                    $shipping->city,
                    $shipping->postal_code,
                ]))),
                'delivery_type' => 48,
                'item_type' => 2,
                'special_instruction' => (string) ($order->remarks ?? ''),
                'item_quantity' => max(1, (int) $order->items->sum('quantity')),
                'item_weight' => 0.5,
                'item_description' => 'Order ' . (string) $order->order_no,
                'amount_to_collect' => strtolower((string) $order->payment_method) === 'cod' ? (float) $order->total_amount : 0,
            ]);

            $order->payment_payload = array_merge($order->payment_payload ?? [], [
                'courier' => [
                    'partner' => 'pathao',
                    ...$pathaoResult,
                    'submitted_at' => now()->toIso8601String(),
                ],
            ]);
            $order->save();
        } catch (\Throwable $exception) {
            return response()->json([
                'status' => 0,
                'message' => 'Pathao rejected the shipment: ' . $exception->getMessage(),
            ], 422);
        }

        try {
            $order = $this->syncPathaoStatus($order, true);
        } catch (\Throwable $exception) {
            return response()->json([
                'status' => 0,
                'message' => 'Pathao status could not be refreshed: ' . $exception->getMessage(),
            ], 422);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Order submitted to Pathao successfully.',
            'data' => $this->formatOrderDetails($order),
        ]);
    }

    public function trackByOrderNumber(Request $request)
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

        $orderNo = trim((string) $validator->validated()['order_no']);

        $query = CustomerOrder::query()
            ->where('order_no', $orderNo)
            ->with([
                'user:id,first_name,last_name,email,phone',
                'shippingAddress:id,full_name,email,phone,address,division_name,district_name,upazila_name,city,country,postal_code',
                'items',
                'groupPurchase.product:id,name,slug,featured_image,thumbnail',
            ]);

        if (! Auth::user()?->isSuperAdmin()) {
            $this->applyCompanyFilter($query, (string) Auth::user()?->company_id);
        }

        $order = $query->first();

        if (! $order) {
            return response()->json([
                'status' => 0,
                'message' => 'No order found for this order number.',
            ], 404);
        }

        try {
            $order = $this->syncPathaoStatus($order, true);
        } catch (\Throwable $exception) {
            return response()->json([
                'status' => 0,
                'message' => 'Pathao status could not be refreshed: ' . $exception->getMessage(),
            ], 422);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Order tracking fetched successfully.',
            'data' => $this->formatOrderTrackingDetails($order),
        ]);
    }

    public function updateStatus(Request $request, string $id)
    {
        $order = $this->resolveCompanyOrder($id);

        if (! $order) {
            return response()->json([
                'status' => 0,
                'message' => 'Order not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'order_status' => 'required|string|in:pending,processing,shipped,delivered,cancelled,returned',
            'payment_status' => 'nullable|string|in:pending,paid,failed,refunded',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $payload = $validator->validated();
        $previousStatus = (string) $order->order_status;
        $order->order_status = $payload['order_status'];

        if (array_key_exists('payment_status', $payload) && $payload['payment_status'] !== null) {
            $order->payment_status = $payload['payment_status'];
        }

        $order->save();

        if (in_array((string) $order->order_status, ['cancelled', 'returned'], true)) {
            app(CommissionSubscriptionService::class)->voidChargesForOrder(
                (string) $order->id,
                'Order status changed to ' . (string) $order->order_status . '.'
            );
        }

        $order->loadMissing([
            'user:id,first_name,last_name,email,phone',
            'shippingAddress:id,full_name,email,phone,address,division_name,district_name,upazila_name,city,country,postal_code',
            'items',
            'company',
            'groupPurchase.product:id,name,slug,featured_image,thumbnail',
        ]);

        if ($previousStatus !== (string) $order->order_status) {
            $smsService = app(CompanySmsService::class);

            if ((string) $order->order_status === 'shipped') {
                $smsService->sendOrderShipped($order);
            } elseif ((string) $order->order_status === 'delivered') {
                $smsService->sendOrderDelivered($order);
            }
        }

        return response()->json([
            'status' => 1,
            'message' => 'Order status updated successfully.',
            'data' => $this->formatOrderDetails($order),
        ]);
    }

    private function resolveDraftCustomer(array $payload, string $companyId): User
    {
        $fullName = trim((string) $payload['customer_name']);
        [$firstName, $lastName] = $this->splitName($fullName);
        $email = filled($payload['customer_email'] ?? null) ? trim((string) $payload['customer_email']) : null;
        $phone = trim((string) $payload['customer_phone']);

        $query = User::query()->where(function ($builder) use ($email, $phone) {
            if ($email !== null) {
                $builder->where('email', $email)->orWhere('phone', $phone);
            } else {
                $builder->where('phone', $phone);
            }
        });

        if ($companyId !== '') {
            $this->applyCompanyFilter($query, $companyId);
        }

        $customer = $query->first() ?: new User();
        $customer->first_name = $firstName;
        $customer->last_name = $lastName;
        $customer->email = $email;
        $customer->phone = $phone;
        $customer->company_id = $companyId !== '' ? $companyId : null;
        $customer->role = User::ECOMMERCE_USER_ROLE;
        $customer->status = 1;

        if (empty($customer->password)) {
            $customer->password = Hash::make(Str::random(24));
        }

        $customer->save();

        return $customer;
    }

    private function splitName(string $name): array
    {
        $parts = preg_split('/\s+/', trim($name), 2);

        return [
            trim((string) ($parts[0] ?? '')),
            trim((string) ($parts[1] ?? '')),
        ];
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

    public function returnRequests(Request $request)
    {
        if (! Schema::hasTable('order_return_requests')) {
            return response()->json([
                'status' => 1,
                'message' => 'Return requests fetched successfully.',
                'data' => [],
            ]);
        }

        $status = trim((string) $request->input('status', ''));

        $query = OrderReturnRequest::query()
            ->with([
                'order.user:id,first_name,last_name,email,phone',
                'order.shippingAddress:id,full_name,email,phone,address,division_name,district_name,upazila_name,city,country,postal_code',
                'orderItem',
                'user:id,first_name,last_name,email,phone',
            ]);

        if (! Auth::user()?->isSuperAdmin()) {
            $this->applyCompanyFilter($query, (string) Auth::user()?->company_id);
        }

        if ($status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        $returns = $query
            ->latest('requested_at')
            ->latest('created_at')
            ->get()
            ->map(fn (OrderReturnRequest $returnRequest) => $this->formatReturnRequest($returnRequest))
            ->values();

        return response()->json([
            'status' => 1,
            'message' => 'Return requests fetched successfully.',
            'data' => $returns,
        ]);
    }

    public function approveReturnRequest(Request $request, string $id)
    {
        if (! Schema::hasTable('order_return_requests') || ! Schema::hasColumn('user', 'wallet_balance')) {
            return response()->json([
                'status' => 0,
                'message' => 'Return refund setup is not ready yet. Please run the latest migrations first.',
            ], 422);
        }

        $returnRequest = $this->resolveReturnRequest($id);

        if (! $returnRequest) {
            return response()->json([
                'status' => 0,
                'message' => 'Return request not found.',
            ], 404);
        }

        if ((string) $returnRequest->status !== 'pending') {
            return response()->json([
                'status' => 0,
                'message' => 'Only pending return requests can be approved.',
            ], 422);
        }

        $approvalResult = DB::transaction(function () use ($returnRequest) {
            $lockedReturnRequest = OrderReturnRequest::query()
                ->where('id', $returnRequest->id)
                ->lockForUpdate()
                ->first();

            if (! $lockedReturnRequest) {
                return ['error' => 'Return request no longer exists.'];
            }

            $order = CustomerOrder::query()
                ->where('id', $lockedReturnRequest->order_id)
                ->with(['items', 'returnRequests'])
                ->lockForUpdate()
                ->first();

            if (! $order) {
                return ['error' => 'The order linked to this return request was not found.'];
            }

            /** @var CustomerOrderItem $orderItem */
            $orderItem = CustomerOrderItem::query()
                ->where('id', $lockedReturnRequest->order_item_id)
                ->where('order_id', $order->id)
                ->lockForUpdate()
                ->first();

            if (! $orderItem) {
                return ['error' => 'The returned order item was not found.'];
            }

            $customer = User::query()
                ->where('id', $lockedReturnRequest->user_id ?: $order->user_id)
                ->lockForUpdate()
                ->first();

            if (! $customer) {
                return ['error' => 'The customer linked to this return request was not found.'];
            }

            $refundAmount = round((float) $lockedReturnRequest->refund_amount, 2);

            $lockedReturnRequest->status = 'approved';
            $lockedReturnRequest->approved_by = (string) Auth::id();
            $lockedReturnRequest->resolved_at = now();
            $lockedReturnRequest->rejection_reason = null;
            $lockedReturnRequest->save();

            $customer->wallet_balance = round((float) ($customer->wallet_balance ?? 0) + $refundAmount, 2);
            $customer->save();

            $this->restoreInventoryForItem($orderItem);
            $this->syncOrderReturnState($order->fresh(['items', 'returnRequests']));

            return ['error' => null];
        });

        if ($approvalResult['error']) {
            return response()->json([
                'status' => 0,
                'message' => $approvalResult['error'],
            ], 422);
        }

        $returnRequest->refresh();
        $returnRequest->load(['order.user:id,first_name,last_name,email,phone', 'user:id,first_name,last_name,email,phone', 'order.shippingAddress:id,full_name,email,phone,address,division_name,district_name,upazila_name,city,country,postal_code', 'orderItem']);

        return response()->json([
            'status' => 1,
            'message' => 'Return request approved and customer balance updated successfully.',
            'data' => $this->formatReturnRequest($returnRequest),
        ]);
    }

    public function rejectReturnRequest(Request $request, string $id)
    {
        if (! Schema::hasTable('order_return_requests')) {
            return response()->json([
                'status' => 0,
                'message' => 'Return feature is not ready yet. Please run the latest migrations first.',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'rejection_reason' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $returnRequest = $this->resolveReturnRequest($id);

        if (! $returnRequest) {
            return response()->json([
                'status' => 0,
                'message' => 'Return request not found.',
            ], 404);
        }

        if ((string) $returnRequest->status !== 'pending') {
            return response()->json([
                'status' => 0,
                'message' => 'Only pending return requests can be rejected.',
            ], 422);
        }

        $returnRequest->status = 'rejected';
        $returnRequest->approved_by = (string) Auth::id();
        $returnRequest->rejection_reason = trim((string) ($validator->validated()['rejection_reason'] ?? '')) ?: null;
        $returnRequest->resolved_at = now();
        $returnRequest->save();

        $returnRequest->load(['order.user:id,first_name,last_name,email,phone', 'order.shippingAddress:id,full_name,email,phone,address,division_name,district_name,upazila_name,city,country,postal_code', 'orderItem']);

        return response()->json([
            'status' => 1,
            'message' => 'Return request rejected successfully.',
            'data' => $this->formatReturnRequest($returnRequest),
        ]);
    }

    private function resolveCompanyOrder(string $id): ?CustomerOrder
    {
        $query = CustomerOrder::query()->where('id', $id);

        if (! Auth::user()?->isSuperAdmin()) {
            $this->applyCompanyFilter($query, (string) Auth::user()?->company_id);
        }

        return $query->first();
    }

    private function syncPathaoStatus(CustomerOrder $order, bool $throwOnFailure = false): CustomerOrder
    {
        $consignmentId = trim((string) data_get($order->payment_payload, 'courier.consignment_id', ''));
        if ($consignmentId === '') {
            return $order;
        }

        $order->loadMissing('company');
        if (! $order->company) {
            return $order;
        }

        try {
            $pathaoInfo = app(PathaoCourierService::class)->getOrderInfo($order->company, $consignmentId);
            $pathaoStatus = trim((string) ($pathaoInfo['order_status'] ?? ''));
            $courierPayload = (array) data_get($order->payment_payload, 'courier', []);
            $courierPayload = array_merge($courierPayload, [
                'pathao_status' => $pathaoStatus ?: ($courierPayload['pathao_status'] ?? null),
                'delivery_fee' => $pathaoInfo['delivery_fee'] ?? ($courierPayload['delivery_fee'] ?? null),
                'status' => 'submitted',
                'last_synced_at' => now()->toIso8601String(),
                'sync_error' => null,
                'status_response' => $pathaoInfo['raw'] ?? null,
            ]);

            $nextLocalStatus = $this->mapPathaoStatus($pathaoStatus, (string) $order->order_status);
            $order->payment_payload = array_merge($order->payment_payload ?? [], ['courier' => $courierPayload]);
            $order->order_status = $nextLocalStatus;
            $order->save();
        } catch (\Throwable $exception) {
            $courierPayload = (array) data_get($order->payment_payload, 'courier', []);
            $order->payment_payload = array_merge($order->payment_payload ?? [], [
                'courier' => array_merge($courierPayload, [
                    'sync_error' => $exception->getMessage(),
                    'last_sync_failed_at' => now()->toIso8601String(),
                ]),
            ]);
            $order->save();

            if ($throwOnFailure) {
                throw $exception;
            }
        }

        return $order->fresh(['user', 'shippingAddress', 'items', 'company', 'groupPurchase.product']);
    }

    private function mapPathaoStatus(string $pathaoStatus, string $currentStatus): string
    {
        $normalized = strtolower((string) preg_replace('/[^a-z0-9]+/i', '_', trim($pathaoStatus)));

        if (str_contains($normalized, 'cancel')) {
            return 'cancelled';
        }
        if (str_contains($normalized, 'deliver') && ! str_contains($normalized, 'failed')) {
            return 'delivered';
        }
        if (str_contains($normalized, 'return') || str_contains($normalized, 'delivery_failed')) {
            return 'returned';
        }
        if (str_contains($normalized, 'picked') || str_contains($normalized, 'transit') || str_contains($normalized, 'sorting')) {
            return 'shipped';
        }
        if (str_contains($normalized, 'pickup') || str_contains($normalized, 'assigned') || str_contains($normalized, 'created')) {
            return 'processing';
        }

        return $currentStatus;
    }

    private function formatOrderSummary(CustomerOrder $order): array
    {
        $paymentMethod = strtolower(trim((string) $order->payment_method));
        $paymentChannel = in_array($paymentMethod, ['', 'cod'], true) ? 'cod' : 'gateway';
        $courierMeta = data_get($order->payment_payload, 'courier', []);
        $courierMeta = is_array($courierMeta) ? $courierMeta : [];
        $courierPartner = (string) ($courierMeta['partner'] ?? '');

        return [
            'id' => (string) $order->id,
            'order_no' => (string) $order->order_no,
            'placed_at' => optional($order->placed_at ?? $order->created_at)?->toIso8601String(),
            'order_status' => (string) $order->order_status,
            'payment_method' => (string) $order->payment_method,
            'payment_method_label' => $paymentChannel === 'cod' ? 'Cash on Delivery' : (string) $order->payment_method,
            'payment_channel' => $paymentChannel,
            'payment_status' => (string) $order->payment_status,
            'subtotal' => (float) $order->subtotal,
            'tax_amount' => (float) $order->tax_amount,
            'shipping_amount' => (float) $order->shipping_amount,
            'total_amount' => (float) $order->total_amount,
            'group_discount_amount' => (float) ($order->group_discount_amount ?? 0),
            'coupon_code' => $order->coupon_code ? (string) $order->coupon_code : null,
            'coupon_discount_amount' => (float) ($order->coupon_discount_amount ?? 0),
            'coupon' => $order->coupon_code
                ? [
                    'code' => (string) $order->coupon_code,
                    'discount_amount' => (float) ($order->coupon_discount_amount ?? 0),
                ]
                : null,
            'discounts' => [
                'coupon_discount_amount' => (float) ($order->coupon_discount_amount ?? 0),
                'group_discount_amount' => (float) ($order->group_discount_amount ?? 0),
                'total_discount_amount' => round((float) ($order->coupon_discount_amount ?? 0) + (float) ($order->group_discount_amount ?? 0), 2),
            ],
            'group_purchase_discount_status' => (string) ($order->group_purchase_discount_status ?? 'none'),
            'items_count' => $order->items->count(),
            'courier_partner' => $courierPartner ?: null,
            'courier' => $courierPartner ? [
                'name' => ucfirst($courierPartner),
                'label' => ucfirst($courierPartner),
                'status' => $courierMeta['status'] ?? null,
                'consignment_id' => $courierMeta['consignment_id'] ?? null,
                'merchant_order_id' => $courierMeta['merchant_order_id'] ?? null,
                'delivery_fee' => $courierMeta['delivery_fee'] ?? null,
                'message' => $courierMeta['message'] ?? null,
                'pathao_status' => $courierMeta['pathao_status'] ?? null,
                'last_synced_at' => $courierMeta['last_synced_at'] ?? null,
                'sync_error' => $courierMeta['sync_error'] ?? null,
            ] : null,
            'customer' => $this->formatCustomer($order->user, $order->shippingAddress),
            'shipping' => $this->formatShipping($order->shippingAddress),
            'group_purchase' => $this->formatGroupPurchase($order->groupPurchase),
        ];
    }

    private function formatOrderDetails(CustomerOrder $order): array
    {
        $customer = $this->formatCustomer($order->user, $order->shippingAddress);
        $shipping = $this->formatShipping($order->shippingAddress);
        $qrCodeHtml = html_entity_decode(
            DNS2D::getBarcodeHTML((string) $order->order_no, 'QRCODE,H', 5, 5),
            ENT_QUOTES,
            'UTF-8'
        );

        return [
            ...$this->formatOrderSummary($order),
            'customer' => $customer,
            'shipping' => $shipping,
            'qr_code_html' => $qrCodeHtml,
            'delivery_packet' => [
                'order_no' => (string) $order->order_no,
                'placed_at' => optional($order->placed_at ?? $order->created_at)?->toIso8601String(),
                'customer' => $customer,
                'shipping' => $shipping,
                'items_count' => $order->items->count(),
                'total_amount' => (float) $order->total_amount,
            ],
            'tracking_note' => $this->trackingNote((string) $order->order_status),
            'tracking_steps' => $this->trackingSteps((string) $order->order_status),
            'estimated_delivery' => $this->estimatedDelivery($order),
            'items' => $order->items->map(fn (CustomerOrderItem $item) => [
                'id' => (string) $item->id,
                'product_id' => (string) $item->product_id,
                'name' => (string) $item->product_name,
                'slug' => (string) ($item->product_slug ?? ''),
                'image' => (string) ($item->product_image ?? ''),
                'brand_name' => (string) ($item->brand_name ?? ''),
                'category_name' => (string) ($item->category_name ?? ''),
                'quantity' => (float) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'tax_rate' => (float) $item->tax_rate,
                'tax_amount' => (float) $item->tax_amount,
                'line_total' => (float) $item->line_total,
            ])->values()->all(),
        ];
    }

    private function formatOrderTrackingDetails(CustomerOrder $order): array
    {
        return [
            ...$this->formatOrderDetails($order),
            'seller' => [
                'name' => (string) ($order->company?->name ?: 'Seller support'),
                'contact_name' => (string) ($order->company?->contact_name ?: 'Support Team'),
                'email' => $order->company?->email,
                'phone' => $order->company?->phone_number,
                'address' => $order->company?->address,
            ],
        ];
    }

    private function formatReturnRequest(OrderReturnRequest $returnRequest): array
    {
        $order = $returnRequest->order;
        $orderItem = $returnRequest->orderItem;
        $customer = $order?->user ?: $returnRequest->user;
        $shipping = $order?->shippingAddress;
        $placedAt = $order?->placed_at ?? $order?->created_at;

        return [
            'id' => (string) $returnRequest->id,
            'status' => (string) $returnRequest->status,
            'reason' => (string) $returnRequest->reason,
            'refund_amount' => (float) $returnRequest->refund_amount,
            'rejection_reason' => $returnRequest->rejection_reason,
            'requested_at' => optional($returnRequest->requested_at ?? $returnRequest->created_at)?->toIso8601String(),
            'resolved_at' => optional($returnRequest->resolved_at)?->toIso8601String(),
            'order' => $order ? [
                'id' => (string) $order->id,
                'order_no' => (string) $order->order_no,
                'order_status' => (string) $order->order_status,
                'payment_status' => (string) $order->payment_status,
                'placed_at' => optional($placedAt)?->toIso8601String(),
                'placed_at_label' => optional($placedAt instanceof Carbon ? $placedAt : null)?->format('M j, Y'),
            ] : null,
            'customer' => $this->formatCustomer($customer, $shipping),
            'shipping' => $shipping ? $this->formatShipping($shipping) : null,
            'item' => $orderItem ? [
                'id' => (string) $orderItem->id,
                'product_id' => (string) $orderItem->product_id,
                'name' => (string) $orderItem->product_name,
                'slug' => (string) ($orderItem->product_slug ?? ''),
                'image' => (string) ($orderItem->product_image ?? ''),
                'brand_name' => (string) ($orderItem->brand_name ?? ''),
                'category_name' => (string) ($orderItem->category_name ?? ''),
                'quantity' => (float) $orderItem->quantity,
                'unit_price' => (float) $orderItem->unit_price,
                'line_total' => (float) $orderItem->line_total,
            ] : null,
        ];
    }

    private function resolveReturnRequest(string $id): ?OrderReturnRequest
    {
        if (! Schema::hasTable('order_return_requests')) {
            return null;
        }

        $query = OrderReturnRequest::query()
            ->with([
                'order.user:id,first_name,last_name,email,phone',
                'order.shippingAddress:id,full_name,email,phone,address,division_name,district_name,upazila_name,city,country,postal_code',
                'orderItem',
                'user:id,first_name,last_name,email,phone',
            ])
            ->where('id', $id);

        if (! Auth::user()?->isSuperAdmin()) {
            $this->applyCompanyFilter($query, (string) Auth::user()?->company_id);
        }

        return $query->first();
    }

    private function syncOrderReturnState(?CustomerOrder $order): void
    {
        if (! $order) {
            return;
        }

        $approvedCount = $order->returnRequests
            ->filter(fn (OrderReturnRequest $request) => (string) $request->status === 'approved')
            ->count();

        if ($approvedCount > 0 && $approvedCount >= $order->items->count()) {
            $order->order_status = 'returned';
            $order->payment_status = 'refunded';
            $order->save();
        }
    }

    private function restoreInventoryForItem(CustomerOrderItem $item): void
    {
        $quantity = (float) $item->quantity;

        if ($quantity <= 0) {
            return;
        }

        if ($item->inventory_item_id) {
            $inventoryItem = InventoryItem::query()
                ->withoutGlobalScope('company')
                ->lockForUpdate()
                ->find($item->inventory_item_id);

            if ($inventoryItem) {
                $inventoryItem->quantity = round((float) $inventoryItem->quantity + $quantity, 2);
                $inventoryItem->save();
            }
        }

        if ($item->inventory_id) {
            $inventory = Inventory::query()
                ->withoutGlobalScope('company')
                ->lockForUpdate()
                ->find($item->inventory_id);

            if ($inventory) {
                $inventory->quantity = round((float) $inventory->quantity + $quantity, 2);
                $inventory->save();
            }
        }

        if ($item->inventory_item_id) {
            $channel = SalesChannel::query()
                ->where('inventory_id', $item->inventory_item_id)
                ->where('channel_code', 'ONLINE_STORE')
                ->lockForUpdate()
                ->first();

            if ($channel) {
                $channel->quantity = round((float) $channel->quantity + $quantity, 2);
                $channel->save();
            } else {
                SalesChannel::query()->create([
                    'id' => (string) \Illuminate\Support\Str::uuid(),
                    'inventory_id' => (string) $item->inventory_item_id,
                    'channel_code' => 'ONLINE_STORE',
                    'quantity' => round($quantity, 2),
                ]);
            }
        }
    }

    private function formatCustomer(?User $user, ?UserShipping $shipping = null): ?array
    {
        $userName = $user ? trim(implode(' ', array_filter([(string) $user->first_name, (string) $user->last_name]))) : '';
        $shippingName = $shipping?->full_name ? trim((string) $shipping->full_name) : '';
        $name = $userName !== '' ? $userName : ($shippingName !== '' ? $shippingName : '');

        return [
            'id' => (string) ($user?->id ?? $shipping?->id ?? ''),
            'name' => $name !== '' ? $name : ((string) ($user?->email ?: $user?->phone ?: $shipping?->email ?: $shipping?->phone ?: 'Customer')),
            'email' => $user?->email ?: $shipping?->email,
            'phone' => $user?->phone ?: $shipping?->phone,
            'address' => $shipping?->address ?: null,
        ];
    }

    private function formatShipping(?UserShipping $shipping): ?array
    {
        if (! $shipping) {
            return null;
        }

        return [
            'full_name' => (string) $shipping->full_name,
            'email' => $shipping->email,
            'phone' => (string) $shipping->phone,
            'address' => (string) $shipping->address,
            'division_name' => $shipping->division_name ? (string) $shipping->division_name : null,
            'district_name' => $shipping->district_name ? (string) $shipping->district_name : null,
            'upazila_name' => $shipping->upazila_name ? (string) $shipping->upazila_name : null,
            'city' => (string) $shipping->city,
            'country' => (string) $shipping->country,
            'postal_code' => $shipping->postal_code,
        ];
    }

    private function formatGroupPurchase(?GroupPurchase $groupPurchase): ?array
    {
        if (! $groupPurchase) {
            return null;
        }

        return [
            'id' => (string) $groupPurchase->id,
            'status' => (string) $groupPurchase->status,
            'purchase_status' => (string) ($groupPurchase->purchase_status ?? 'awaiting_members'),
            'minimum_users' => (int) $groupPurchase->minimum_users,
            'discount_type' => (string) $groupPurchase->discount_type,
            'discount_amount' => (float) $groupPurchase->discount_amount,
            'base_price' => (float) $groupPurchase->base_price,
            'discounted_price' => (float) $groupPurchase->discounted_price,
            'product' => $groupPurchase->product ? [
                'id' => (string) $groupPurchase->product->id,
                'name' => (string) $groupPurchase->product->name,
                'slug' => (string) $groupPurchase->product->slug,
                'image' => (string) ($groupPurchase->product->featured_image ?: $groupPurchase->product->thumbnail ?: ''),
            ] : null,
        ];
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

    private function trackingNote(string $status): string
    {
        return match ($status) {
            'pending' => 'Order received and waiting for confirmation.',
            'processing' => 'The store is preparing this order now.',
            'shipped' => 'The parcel is on the way to the customer.',
            'delivered' => 'This order has been delivered successfully.',
            'cancelled' => 'This order was cancelled before delivery.',
            'returned' => 'This order has been marked as returned.',
            default => 'Order updates will appear here.',
        };
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
}
