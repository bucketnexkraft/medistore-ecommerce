<?php

namespace App\Services\Api;

use App\Events\GroupPurchaseUpdated;
use App\Models\CustomerOrder;
use App\Models\GroupPurchase;
use App\Models\GroupPurchaseMember;
use App\Models\GroupPurchaseMessage;
use App\Models\Product;
use App\Support\CompanyBroadcastConfig;
use App\Support\EcommerceCompanyContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\StreamedResponse;

class GroupPurchaseService
{
    public function publicIndex(Request $request)
    {
        $limit = max(1, min((int) $request->query('limit', 12), 24));
        $selectedGroupId = trim((string) $request->query('group', ''));
        $companyId = EcommerceCompanyContext::resolveCompanyIdForRequest($request)
            ?? EcommerceCompanyContext::currentCompanyId();
        $demoOnly = $request->boolean('is_demo');
        $cacheKey = sprintf('storefront:group-purchases:%s:%s:%d', $companyId ?: 'global', $demoOnly ? 'demo' : 'live', $limit);

        $groupCards = Cache::remember($cacheKey, now()->addMinutes(2), function () use ($companyId, $limit, $demoOnly) {
            $products = Product::query()
                ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
                ->where('status', 1)
                ->where('is_bundle', false)
                ->where('is_group_purchase_available', true)
                ->when($demoOnly, fn ($query) => $query->where('is_demo', true))
                ->with([
                    'category:id,title,slug',
                    'brand:id,title',
                    'inventory_items' => function ($builder) {
                        $builder->select('id', 'product_id', 'price', 'quantity', 'created_at')
                            ->orderByDesc('created_at');
                    },
                    'groupPurchases' => function ($builder) {
                        $builder->where('status', 'open')
                            ->withCount(['activeMembers as joined_count'])
                            ->latest('created_at');
                    },
                ])
                ->latest('created_at')
                ->limit($limit)
                ->get();

            return $products
                ->map(function (Product $product) {
                    $price = $this->resolveProductPrice($product);
                    $activeGroup = $product->groupPurchases->first();
                    $summary = $this->buildProductGroupPurchaseSummary($product, $price);

                    return [
                        'product' => [
                            'id' => (string) $product->id,
                            'name' => (string) $product->name,
                            'slug' => (string) $product->slug,
                            'thumbnail' => (string) ($product->featured_image ?: $product->thumbnail ?: asset('placeholder/product-placeholder.svg')),
                            'price' => $price,
                            'original_price' => $price,
                            'category' => $product->category ? [
                                'name' => (string) $product->category->title,
                                'slug' => (string) $product->category->slug,
                            ] : null,
                            'brand' => $product->brand ? (string) $product->brand->title : null,
                        ],
                        'group_purchase' => $summary,
                        'active_group' => $activeGroup ? $this->transformGroup($activeGroup, false, false) : null,
                    ];
                })
                ->values();
        });

        $selectedGroup = null;
        if ($selectedGroupId !== '') {
            $selectedGroupModel = GroupPurchase::query()
                ->whereIn('status', ['open', 'completed'])
                ->with([
                    'product.category:id,title,slug',
                    'product.brand:id,title',
                    'product.inventory_items' => function ($builder) {
                        $builder->select('id', 'product_id', 'price', 'quantity', 'created_at')
                            ->orderByDesc('created_at');
                    },
                    'owner:id,first_name,last_name,email,phone,profile_image',
                    'company:company_id,push_status,pusher_app_key,pusher_app_cluster,pusher_app_id,pusher_app_secret',
                    'activeMembers.user:id,first_name,last_name,email,phone,profile_image',
                    'messages.user:id,first_name,last_name,email,phone,profile_image',
                ])
                ->find($selectedGroupId);

            if ($selectedGroupModel) {
                $canViewPrivateGroupData = Auth::check() && $this->isCurrentUserMember($selectedGroupModel);
                $selectedGroup = $this->transformGroup($selectedGroupModel, $canViewPrivateGroupData, $canViewPrivateGroupData);
            }
        }

        return response()->json([
            'status' => 1,
            'message' => 'Group purchase deals fetched successfully.',
            'data' => [
                'cards' => $groupCards,
                'selected_group' => $selectedGroup,
            ],
        ], 200);
    }

    public function invitationDetails(string $token)
    {
        $group = $this->resolveGroupByToken($token, true);

        if (! $group) {
            return response()->json([
                'status' => 0,
                'message' => 'Invitation link is invalid or expired.',
            ], 404);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Invitation details fetched successfully.',
            'data' => $this->transformGroup($group, Auth::check() && $this->isCurrentUserMember($group), Auth::check() && $this->isCurrentUserMember($group)),
        ], 200);
    }

    public function myGroups()
    {
        $user = Auth::user();

        $groups = GroupPurchase::query()
            ->whereHas('activeMembers', function ($builder) use ($user) {
                $builder->where('user_id', $user?->id);
            })
            ->with([
                'product.category:id,title,slug',
                'product.brand:id,title',
                'product.inventory_items' => function ($builder) {
                    $builder->select('id', 'product_id', 'price', 'quantity', 'created_at')
                        ->orderByDesc('created_at');
                },
                'owner:id,first_name,last_name,email,phone,profile_image',
                'company:company_id,push_status,pusher_app_key,pusher_app_cluster,pusher_app_id,pusher_app_secret',
                'activeMembers.user:id,first_name,last_name,email,phone,profile_image',
            ])
            ->withCount(['activeMembers as joined_count'])
            ->latest('created_at')
            ->get()
            ->map(fn (GroupPurchase $group) => $this->transformGroup($group, true))
            ->values();

        return response()->json([
            'status' => 1,
            'message' => 'Your group purchases fetched successfully.',
            'data' => $groups,
        ], 200);
    }

    public function show(string $id)
    {
        $group = GroupPurchase::query()
            ->with([
                'product.category:id,title,slug',
                'product.brand:id,title',
                'product.inventory_items' => function ($builder) {
                    $builder->select('id', 'product_id', 'price', 'quantity', 'created_at')
                        ->orderByDesc('created_at');
                },
                'owner:id,first_name,last_name,email,phone,profile_image',
                'company:company_id,push_status,pusher_app_key,pusher_app_cluster,pusher_app_id,pusher_app_secret',
                'activeMembers.user:id,first_name,last_name,email,phone,profile_image',
                'messages.user:id,first_name,last_name,email,phone,profile_image',
            ])
            ->find($id);

        if (! $group) {
            return response()->json([
                'status' => 0,
                'message' => 'Group purchase not found.',
            ], 404);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Group purchase details fetched successfully.',
            'data' => $this->transformGroup($group, true, true),
        ], 200);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'product_id' => 'required|string|exists:product,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'message' => 'Validation failed.',
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        // Customers do not belong to the seller company, so we must bypass the
        // company scope when resolving a public storefront product.
        $product = EcommerceCompanyContext::applyScope(
            Product::query()->withoutGlobalScope('company')
        )->find($request->input('product_id'));

        if (! $product || ! $product->is_group_purchase_available) {
            return response()->json([
                'status' => 0,
                'message' => 'This product is not available for group purchase.',
            ], 422);
        }

        $price = $this->resolveProductPrice($product);
        $summary = $this->buildProductGroupPurchaseSummary($product, $price);
        $existingActiveGroup = $this->findExistingActiveGroupForUser();

        if ($existingActiveGroup) {
            return response()->json([
                'status' => 0,
                'message' => $this->activeGroupBlockingMessage($existingActiveGroup),
                'data' => [
                    'group_id' => (string) $existingActiveGroup->id,
                ],
            ], 422);
        }

        DB::beginTransaction();

        try {
            $group = GroupPurchase::create([
                'product_id' => $product->id,
                'owner_user_id' => Auth::id(),
                'status' => 'open',
                'purchase_status' => 'awaiting_members',
                'minimum_users' => $summary['minimum_users'],
                'discount_type' => $summary['discount_type'],
                'discount_amount' => $summary['discount_amount'],
                'base_price' => $price,
                'discounted_price' => $summary['discounted_price'],
                'expires_at' => now()->addDay(),
            ]);

            GroupPurchaseMember::create([
                'group_purchase_id' => $group->id,
                'user_id' => Auth::id(),
                'status' => 'joined',
            ]);

            GroupPurchaseMessage::create([
                'group_purchase_id' => $group->id,
                'user_id' => Auth::id(),
                'message' => 'Group purchase started. Invite friends to unlock the discount.',
            ]);

            $group->update(['last_message_at' => now()]);

            DB::commit();
            $this->broadcastGroupUpdate($group->id, 'started');

            return $this->show($group->id);
        } catch (\Throwable $throwable) {
            DB::rollBack();

            return response()->json([
                'status' => 0,
                'message' => 'Unable to start group purchase.',
                'error' => $throwable->getMessage(),
            ], 500);
        }
    }

    public function join(string $id)
    {
        $group = GroupPurchase::query()->find($id);

        if (! $group || $group->status !== 'open') {
            return response()->json([
                'status' => 0,
                'message' => 'Group purchase is no longer available.',
            ], 404);
        }

        return $this->joinGroup($group);
    }

    public function joinByInvitation(string $token)
    {
        $group = $this->resolveGroupByToken($token, false);

        if (! $group) {
            return response()->json([
                'status' => 0,
                'message' => 'Invitation link is invalid or expired.',
            ], 404);
        }

        return $this->joinGroup($group);
    }

    public function messages(string $id)
    {
        $group = GroupPurchase::query()->find($id);

        if (! $group) {
            return response()->json([
                'status' => 0,
                'message' => 'Group purchase not found.',
            ], 404);
        }

        if (! $this->isCurrentUserMember($group)) {
            return response()->json([
                'status' => 0,
                'message' => 'Join this group purchase to view the chat.',
            ], 403);
        }

        $messages = $group->messages()
            ->with('user:id,first_name,last_name,email,phone,profile_image')
            ->latest('created_at')
            ->take(100)
            ->get()
            ->reverse()
            ->values()
            ->map(fn (GroupPurchaseMessage $message) => $this->transformMessage($message));

        return response()->json([
            'status' => 1,
            'message' => 'Group purchase messages fetched successfully.',
            'data' => $messages,
        ], 200);
    }

    public function stream(string $id): StreamedResponse
    {
        $group = GroupPurchase::query()->find($id);

        if (! $group) {
            abort(404, 'Group purchase not found.');
        }

        if (! $this->isCurrentUserMember($group)) {
            abort(403, 'Join this group purchase to view the chat.');
        }

        return response()->stream(function () use ($id) {
            ignore_user_abort(true);
            @ini_set('output_buffering', 'off');
            @ini_set('zlib.output_compression', '0');

            while (ob_get_level() > 0) {
                @ob_end_flush();
            }

            $startedAt = time();
            $lastFingerprint = null;

            echo 'retry: 1000'."\n";
            echo ':' . str_repeat(' ', 2048) . "\n\n";
            @flush();

            while (! connection_aborted() && (time() - $startedAt) < 55) {
                $snapshot = GroupPurchase::query()
                    ->with([
                        'product.category:id,title,slug',
                        'product.brand:id,title',
                        'product.inventory_items' => function ($builder) {
                            $builder->select('id', 'product_id', 'price', 'quantity', 'created_at')
                                ->orderByDesc('created_at');
                        },
                        'owner:id,first_name,last_name,email,phone,profile_image',
                        'company:company_id,push_status,pusher_app_key,pusher_app_cluster,pusher_app_id,pusher_app_secret',
                        'activeMembers.user:id,first_name,last_name,email,phone,profile_image',
                        'messages.user:id,first_name,last_name,email,phone,profile_image',
                    ])
                    ->find($id);

                if (! $snapshot) {
                    $this->streamEvent('group-closed', ['group_id' => $id]);
                    break;
                }

                $fingerprint = md5(json_encode([
                    'status' => $snapshot->status,
                    'joined_count' => $snapshot->activeMembers->count(),
                    'last_message_id' => optional($snapshot->messages->sortByDesc('created_at')->first())->id,
                    'last_message_at' => optional($snapshot->last_message_at)?->toIso8601String(),
                ]));

                if ($fingerprint !== $lastFingerprint) {
                    $this->streamEvent('group-sync', $this->transformGroup($snapshot, true, true));
                    $lastFingerprint = $fingerprint;
                } else {
                    $this->streamEvent('heartbeat', ['group_id' => $id, 'timestamp' => now()->toIso8601String()]);
                }

                @ob_flush();
                @flush();
                sleep(2);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-transform',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    public function sendMessage(Request $request, string $id)
    {
        $group = GroupPurchase::query()->find($id);

        if (! $group) {
            return response()->json([
                'status' => 0,
                'message' => 'Group purchase not found.',
            ], 404);
        }

        if (! $this->isCurrentUserMember($group)) {
            return response()->json([
                'status' => 0,
                'message' => 'Join this group purchase before sending a message.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'message' => 'required|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'message' => 'Validation failed.',
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $message = GroupPurchaseMessage::create([
            'group_purchase_id' => $group->id,
            'user_id' => Auth::id(),
            'message' => trim((string) $request->input('message')),
        ]);

        $group->update(['last_message_at' => now()]);
        $message->load('user:id,first_name,last_name,email,phone,profile_image');
        $this->broadcastGroupUpdate($group->id, 'message');

        return response()->json([
            'status' => 1,
            'message' => 'Message sent successfully.',
            'data' => $this->transformMessage($message),
        ], 200);
    }

    private function joinGroup(GroupPurchase $group)
    {
        if (! $group->product || ! $group->product->is_group_purchase_available) {
            return response()->json([
                'status' => 0,
                'message' => 'This group purchase product is no longer available.',
            ], 422);
        }

        DB::beginTransaction();

        try {
            $lockedGroup = GroupPurchase::query()
                ->lockForUpdate()
                ->find($group->id);

            if (! $lockedGroup || $lockedGroup->status !== 'open') {
                DB::rollBack();

                return response()->json([
                    'status' => 0,
                    'message' => 'Group purchase is no longer available.',
                ], 404);
            }

            $existingActiveGroup = $this->findExistingActiveGroupForUser($lockedGroup->id);
            if ($existingActiveGroup) {
                DB::rollBack();

                return response()->json([
                    'status' => 0,
                    'message' => $this->activeGroupBlockingMessage($existingActiveGroup),
                    'data' => [
                        'group_id' => (string) $existingActiveGroup->id,
                    ],
                ], 422);
            }

            $membership = GroupPurchaseMember::query()->firstOrNew([
                'group_purchase_id' => $lockedGroup->id,
                'user_id' => Auth::id(),
            ]);

            $alreadyJoined = $membership->exists && $membership->status === 'joined';
            $activeMemberCount = GroupPurchaseMember::query()
                ->where('group_purchase_id', $lockedGroup->id)
                ->where('status', 'joined')
                ->count();

            if (! $alreadyJoined && $activeMemberCount >= $lockedGroup->minimum_users) {
                DB::rollBack();

                return response()->json([
                    'status' => 0,
                    'message' => 'This group purchase is already full.',
                ], 422);
            }

            $membership->status = 'joined';
            $membership->joined_at = now();
            $membership->save();

            if (! $alreadyJoined) {
                GroupPurchaseMessage::create([
                    'group_purchase_id' => $lockedGroup->id,
                    'user_id' => Auth::id(),
                    'message' => 'Joined the group purchase.',
                ]);

                $lockedGroup->update(['last_message_at' => now()]);
            }

            if (($activeMemberCount + ($alreadyJoined ? 0 : 1)) >= $lockedGroup->minimum_users && $lockedGroup->status === 'open') {
                $lockedGroup->status = 'completed';
                $lockedGroup->purchase_status = 'awaiting_purchases';
                $lockedGroup->purchase_deadline_at = now()->addDay();
                $lockedGroup->save();
            }

            DB::commit();
            $this->broadcastGroupUpdate($lockedGroup->id, $alreadyJoined ? 'synced' : 'joined');

            return $this->show($lockedGroup->id);
        } catch (\Throwable $throwable) {
            DB::rollBack();

            return response()->json([
                'status' => 0,
                'message' => 'Unable to join group purchase.',
                'error' => $throwable->getMessage(),
            ], 500);
        }
    }

    private function findExistingActiveGroupForUser(?string $excludeGroupId = null): ?GroupPurchase
    {
        $userId = Auth::id();

        if (! $userId) {
            return null;
        }

        return GroupPurchase::query()
            ->whereHas('activeMembers', function ($builder) use ($userId) {
                $builder->where('user_id', $userId);
            })
            ->where(function ($builder) {
                $builder->where('status', 'open')
                    ->orWhere(function ($statusBuilder) {
                        $statusBuilder->where('status', 'completed')
                            ->whereIn('purchase_status', ['awaiting_purchases'])
                            ->whereDoesntHave('orders', function ($orderBuilder) {
                                $orderBuilder
                                    ->where('user_id', (string) Auth::id())
                                    ->where('order_status', '!=', 'cancelled');
                            });
                    });
            })
            ->when($excludeGroupId, fn ($builder) => $builder->where('id', '!=', $excludeGroupId))
            ->latest('created_at')
            ->first();
    }

    private function activeGroupBlockingMessage(GroupPurchase $group): string
    {
        $joinedCount = isset($group->joined_count) ? (int) $group->joined_count : $group->activeMembers()->count();
        $remainingMembers = max((int) $group->minimum_users - $joinedCount, 0);
        $status = (string) $group->status;
        $purchaseStatus = (string) ($group->purchase_status ?? 'awaiting_members');

        if ($status === 'open' || $purchaseStatus === 'awaiting_members') {
            if ($remainingMembers > 0) {
                return "You already have an active group purchase. It still needs {$remainingMembers} more member".($remainingMembers > 1 ? 's' : '')." before checkout opens.";
            }

            return 'You already have an active group purchase. Open that group and finish inviting members first.';
        }

        if ($status === 'completed' && $purchaseStatus === 'awaiting_purchases') {
            return 'You already have a checkout-ready group purchase. Place your order in that group before starting another one.';
        }

        return 'You already have an active group purchase. Open that group to continue.';
    }

    private function resolveProductPrice(Product $product): float
    {
        if ($product->relationLoaded('inventory_items')) {
            $latestInStock = optional($product->inventory_items->firstWhere('quantity', '>', 0))->price;
            $latestKnown = optional($product->inventory_items->first())->price;

            return round((float) ($latestInStock ?? $latestKnown ?? 0), 2);
        }

        if (Schema::hasTable('inventory_items')) {
            $row = DB::table('inventory_items')
                ->where('product_id', $product->id)
                ->orderByDesc('created_at')
                ->first(['price']);

            return round((float) ($row?->price ?? 0), 2);
        }

        return 0;
    }

    private function buildProductGroupPurchaseSummary(Product $product, float $price): array
    {
        $discountType = (string) ($product->group_purchase_discount_type ?: 'fixed');
        $discountAmount = round((float) ($product->group_purchase_discount_amount ?? 0), 2);
        $minimumUsers = max((int) ($product->group_purchase_minimum_user ?? 2), 2);
        $discountValue = $discountType === 'percent'
            ? round(($price * $discountAmount) / 100, 2)
            : $discountAmount;

        return [
            'is_available' => (bool) $product->is_group_purchase_available,
            'discount_type' => $discountType,
            'discount_amount' => $discountAmount,
            'minimum_users' => $minimumUsers,
            'discount_value' => $discountValue,
            'discounted_price' => max(round($price - $discountValue, 2), 0),
        ];
    }

    private function transformGroup(GroupPurchase $group, bool $includeMembers = false, bool $includeMessages = false): array
    {
        $group->loadMissing([
            'product.category:id,title,slug',
            'product.brand:id,title',
            'product.inventory_items' => function ($builder) {
                $builder->select('id', 'product_id', 'price', 'quantity', 'created_at')
                    ->orderByDesc('created_at');
            },
            'owner:id,first_name,last_name,email,phone,profile_image',
            'company:company_id,push_status,pusher_app_key,pusher_app_cluster,pusher_app_id,pusher_app_secret',
        ]);

        $product = $group->product;
        $joinedCount = isset($group->joined_count) ? (int) $group->joined_count : $group->activeMembers()->count();
        $minimumUsers = (int) $group->minimum_users;
        $remaining = max($minimumUsers - $joinedCount, 0);
        $orderSummary = $this->summarizeGroupOrders($group);

        $data = [
            'id' => (string) $group->id,
            'share_token' => (string) $group->share_token,
            'share_path' => '/group-purchase?invite=' . $group->share_token,
            'company_id' => (string) $group->company_id,
            'status' => (string) $group->status,
            'purchase_status' => (string) ($group->purchase_status ?? 'awaiting_members'),
            'minimum_users' => $minimumUsers,
            'joined_count' => $joinedCount,
            'remaining_members' => $remaining,
            'purchase_count' => $orderSummary['purchase_count'],
            'remaining_purchases' => max($minimumUsers - $orderSummary['purchase_count'], 0),
            'has_purchased' => $orderSummary['has_purchased'],
            'purchase_order_id' => $orderSummary['purchase_order_id'],
            'discount_type' => (string) $group->discount_type,
            'discount_amount' => round((float) $group->discount_amount, 2),
            'base_price' => round((float) $group->base_price, 2),
            'discounted_price' => round((float) $group->discounted_price, 2),
            'expires_at' => optional($group->expires_at)?->toIso8601String(),
            'purchase_deadline_at' => optional($group->purchase_deadline_at)?->toIso8601String(),
            'discount_unlocked_at' => optional($group->discount_unlocked_at)?->toIso8601String(),
            'is_joined' => Auth::check() ? $this->isCurrentUserMember($group) : false,
            'owner' => $group->owner ? $this->transformUser($group->owner) : null,
            'realtime' => CompanyBroadcastConfig::publicConfig($group->company),
            'product' => $product ? [
                'id' => (string) $product->id,
                'name' => (string) $product->name,
                'slug' => (string) $product->slug,
                'thumbnail' => (string) ($product->featured_image ?: $product->thumbnail ?: asset('placeholder/product-placeholder.svg')),
                'price' => $this->resolveProductPrice($product),
                'vat' => round((float) ($product->vat ?? 0), 2),
                'category' => $product->category ? [
                    'name' => (string) $product->category->title,
                    'slug' => (string) $product->category->slug,
                ] : null,
                'brand' => $product->brand ? (string) $product->brand->title : null,
                'group_purchase' => $this->buildProductGroupPurchaseSummary($product, $this->resolveProductPrice($product)),
            ] : null,
        ];

        if ($includeMembers) {
            $group->loadMissing('activeMembers.user:id,first_name,last_name,email,phone,profile_image');
            $data['members'] = $group->activeMembers
                ->map(fn (GroupPurchaseMember $member) => [
                    'id' => (string) $member->id,
                    'joined_at' => optional($member->joined_at)?->toIso8601String(),
                    'user' => $member->user ? $this->transformUser($member->user) : null,
                ])
                ->values()
                ->all();
        }

        if ($includeMessages) {
            $group->loadMissing('messages.user:id,first_name,last_name,email,phone,profile_image');
            $data['messages'] = $group->messages
                ->sortBy('created_at')
                ->values()
                ->map(fn (GroupPurchaseMessage $message) => $this->transformMessage($message))
                ->all();
        }

        return $data;
    }

    private function transformMessage(GroupPurchaseMessage $message): array
    {
        return [
            'id' => (string) $message->id,
            'message' => (string) $message->message,
            'created_at' => optional($message->created_at)?->toIso8601String(),
            'user' => $message->user ? $this->transformUser($message->user) : null,
            'is_mine' => Auth::id() === $message->user_id,
        ];
    }

    private function transformUser($user): array
    {
        $name = trim(implode(' ', array_filter([(string) ($user->first_name ?? ''), (string) ($user->last_name ?? '')])));

        return [
            'id' => (string) $user->id,
            'name' => $name !== '' ? $name : ((string) ($user->email ?? $user->phone ?? 'Customer')),
            'email' => $user->email,
            'phone' => $user->phone,
            'profile_image' => $user->profile_image,
        ];
    }

    private function resolveGroupByToken(string $token, bool $withRelations = false): ?GroupPurchase
    {
        $query = GroupPurchase::query()
            ->where('share_token', $token)
            ->whereIn('status', ['open', 'completed']);

        if ($withRelations) {
            $query->with([
                'product.category:id,title,slug',
                'product.brand:id,title',
                'product.inventory_items' => function ($builder) {
                    $builder->select('id', 'product_id', 'price', 'quantity', 'created_at')
                        ->orderByDesc('created_at');
                },
                'owner:id,first_name,last_name,email,phone,profile_image',
                'company:company_id,push_status,pusher_app_key,pusher_app_cluster,pusher_app_id,pusher_app_secret',
                'activeMembers.user:id,first_name,last_name,email,phone,profile_image',
                'messages.user:id,first_name,last_name,email,phone,profile_image',
            ]);
        }

        return $query->first();
    }

    private function streamEvent(string $event, array $payload): void
    {
        echo "event: {$event}\n";
        echo 'data: '.json_encode($payload)."\n\n";
    }

    public function broadcastGroupUpdate(string $groupId, string $action): void
    {
        $group = GroupPurchase::query()
            ->with([
                'product.category:id,title,slug',
                'product.brand:id,title',
                'product.inventory_items' => function ($builder) {
                    $builder->select('id', 'product_id', 'price', 'quantity', 'created_at')
                        ->orderByDesc('created_at');
                },
                'owner:id,first_name,last_name,email,phone,profile_image',
                'company:company_id,push_status,pusher_app_key,pusher_app_cluster,pusher_app_id,pusher_app_secret',
                'activeMembers.user:id,first_name,last_name,email,phone,profile_image',
                'messages.user:id,first_name,last_name,email,phone,profile_image',
            ])
            ->find($groupId);

        if (! $group) {
            return;
        }

        CompanyBroadcastConfig::apply($group->company);

        broadcast(new GroupPurchaseUpdated($groupId, $this->transformGroup($group, true, true), $action))->toOthers();
    }

    private function summarizeGroupOrders(GroupPurchase $group): array
    {
        $orders = CustomerOrder::query()
            ->where('group_purchase_id', $group->id)
            ->where('order_status', '!=', 'cancelled')
            ->get(['id', 'user_id', 'order_status']);

        $currentOrder = Auth::check()
            ? $orders->firstWhere('user_id', (string) Auth::id())
            : null;

        $eligibleOrders = $orders->filter(fn (CustomerOrder $order) => (string) $order->order_status !== 'pending');

        return [
            'purchase_count' => $eligibleOrders->pluck('user_id')->filter()->unique()->count(),
            'has_purchased' => $currentOrder !== null,
            'purchase_order_id' => $currentOrder?->id ? (string) $currentOrder->id : null,
        ];
    }

    private function isCurrentUserMember(GroupPurchase $group): bool
    {
        if (! Auth::check()) {
            return false;
        }

        return GroupPurchaseMember::query()
            ->where('group_purchase_id', $group->id)
            ->where('user_id', Auth::id())
            ->where('status', 'joined')
            ->exists();
    }
}
