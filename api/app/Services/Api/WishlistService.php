<?php

namespace App\Services\Api;

use App\Models\Product;
use App\Models\Wishlist;
use App\Support\EcommerceCompanyContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class WishlistService
{
    public function index()
    {
        $items = Wishlist::query()
            ->where('user_id', Auth::id())
            ->with([
                'product' => function ($query) {
                    EcommerceCompanyContext::applyScope(
                        $query->withoutGlobalScope('company')
                    )
                        ->where('status', 1)
                        ->where('is_bundle', false)
                        ->with([
                            'category:id,title,slug',
                            'brand:id,title',
                            'inventory_items' => function ($builder) {
                                EcommerceCompanyContext::applyScope($builder->withoutGlobalScope('company'))
                                    ->select('id', 'product_id', 'price', 'quantity', 'created_at')
                                    ->with('salesChannels')
                                    ->orderByDesc('created_at');
                            },
                        ]);
                },
            ])
            ->latest('created_at')
            ->get()
            ->filter(fn (Wishlist $wishlist) => $wishlist->product !== null)
            ->values()
            ->map(fn (Wishlist $wishlist) => $this->formatWishlistItem($wishlist))
            ->values();

        return response()->json([
            'status' => 1,
            'message' => 'Wishlist fetched successfully',
            'data' => $items,
            'meta' => [
                'total' => $items->count(),
            ],
        ], 200);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'product_id' => 'nullable|string|required_without:product_slug',
            'product_slug' => 'nullable|string|required_without:product_id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $productId = $request->filled('product_id') ? (string) $request->input('product_id') : null;
        $productSlug = $request->filled('product_slug') ? strtolower(trim((string) $request->input('product_slug'))) : null;

        $product = Product::query()
            ->tap(fn ($query) => EcommerceCompanyContext::applyScope($query->withoutGlobalScope('company')))
            ->where('status', 1)
            ->where('is_bundle', false)
            ->where(function ($query) use ($productId, $productSlug) {
                if ($productId) {
                    $query->where('id', $productId);
                }

                if ($productSlug) {
                    $query->orWhereRaw('LOWER(slug) = ?', [$productSlug]);
                }
            })
            ->first();

        if (! $product) {
            return response()->json([
                'status' => 0,
                'message' => 'Product not found.',
            ], 404);
        }

        $wishlist = Wishlist::query()->firstOrCreate([
            'user_id' => (string) Auth::id(),
            'product_id' => (string) $product->id,
        ]);

        $wishlist->load([
            'product' => function ($query) {
                EcommerceCompanyContext::applyScope(
                    $query->withoutGlobalScope('company')
                )
                    ->with([
                        'category:id,title,slug',
                        'brand:id,title',
                        'inventory_items' => function ($builder) {
                            EcommerceCompanyContext::applyScope($builder->withoutGlobalScope('company'))
                                ->select('id', 'product_id', 'price', 'quantity', 'created_at')
                                ->with('salesChannels')
                                ->orderByDesc('created_at');
                        },
                    ]);
            },
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Product added to wishlist successfully',
            'data' => $this->formatWishlistItem($wishlist),
        ], 201);
    }

    public function destroy(string $productId)
    {
        $wishlist = Wishlist::query()
            ->where('user_id', Auth::id())
            ->where('product_id', $productId)
            ->first();

        if (! $wishlist) {
            return response()->json([
                'status' => 0,
                'message' => 'Wishlist item not found.',
            ], 404);
        }

        $wishlist->delete();

        return response()->json([
            'status' => 1,
            'message' => 'Product removed from wishlist successfully',
        ], 200);
    }

    private function formatWishlistItem(Wishlist $wishlist): array
    {
        $product = $wishlist->product;
        $latestInStockPrice = optional(
            $product->inventory_items->firstWhere('quantity', '>', 0)
        )->price;
        $latestKnownPrice = optional($product->inventory_items->first())->price;
        $price = (float) ($latestInStockPrice ?? $latestKnownPrice ?? 0);
        $quantity = $this->resolveOnlineStoreQuantity(
            $product,
            (float) $product->inventory_items->where('quantity', '>', 0)->sum('quantity')
        );

        return [
            'id' => (string) $wishlist->id,
            'product_id' => (string) $product->id,
            'slug' => (string) $product->slug,
            'name' => (string) $product->name,
            'thumbnail' => (string) ($product->thumbnail ?: asset('placeholder/product-placeholder.svg')),
            'price' => $price,
            'available_quantity' => $quantity,
            'brand' => $product->brand ? [
                'name' => (string) $product->brand->title,
            ] : null,
            'category' => $product->category ? [
                'name' => (string) $product->category->title,
                'slug' => (string) $product->category->slug,
            ] : null,
            'stock_display' => $product->stockDisplay($quantity),
            'url' => '/product/' . $product->slug,
            'added_at' => optional($wishlist->created_at)?->toIso8601String(),
        ];
    }

    private function getChannelQuantitySnapshot(Product $product, string $channelCode): array
    {
        if ($product->relationLoaded('inventory_items')) {
            $channelRows = $product->inventory_items
                ->filter(fn ($item) => $item && $item->relationLoaded('salesChannels'))
                ->flatMap(fn ($item) => $item->salesChannels ?? collect())
                ->filter(fn ($channel) => strtoupper((string) $channel->channel_code) === strtoupper($channelCode))
                ->values();

            if ($channelRows->isNotEmpty()) {
                return [
                    'exists' => true,
                    'quantity' => (float) $channelRows->sum(fn ($channel) => (float) $channel->quantity),
                ];
            }
        }

        return [
            'exists' => false,
            'quantity' => 0,
        ];
    }

    private function resolveOnlineStoreQuantity(Product $product, float $totalQuantity): float
    {
        $snapshot = $this->getChannelQuantitySnapshot($product, \App\Enums\SalesChannel::OnlineStore->value);

        if ($snapshot['exists']) {
            return round(max((float) $snapshot['quantity'], 0), 2);
        }

        $channels = is_array($product->sales_channel) ? $product->sales_channel : [];
        $onlinePercentage = (float) ($channels[\App\Enums\SalesChannel::OnlineStore->value] ?? 100);

        if ($onlinePercentage <= 0) {
            return 0;
        }

        if ($onlinePercentage >= 100) {
            return round($totalQuantity, 2);
        }

        return round(($totalQuantity * $onlinePercentage) / 100, 2);
    }
}
