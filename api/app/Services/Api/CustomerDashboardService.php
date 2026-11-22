<?php

namespace App\Services\Api;

use App\Enums\SalesChannel;
use App\Models\CustomerOrder;
use App\Models\DiscountSetup;
use App\Models\Product;
use App\Models\Wishlist;
use App\Support\EcommerceCompanyContext;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class CustomerDashboardService
{
    public function index()
    {
        $user = Auth::user();
        $today = Carbon::today();

        $wishlistProductIds = Wishlist::query()
            ->where('user_id', (string) $user->id)
            ->pluck('product_id');

        $orderQuery = CustomerOrder::query()
            ->tap(fn (Builder $query) => EcommerceCompanyContext::applyScope($query))
            ->where('user_id', (string) $user->id);

        $latestOrder = (clone $orderQuery)
            ->latest('placed_at')
            ->latest('created_at')
            ->first();

        $recommendations = Product::query()
            ->withoutGlobalScope('company')
            ->tap(fn (Builder $query) => EcommerceCompanyContext::applyScope($query))
            ->where('status', 1)
            ->where('is_bundle', false)
            ->when($wishlistProductIds->isNotEmpty(), fn (Builder $query) => $query->whereNotIn('id', $wishlistProductIds))
            ->with([
                'category:id,title,slug',
                'inventory_items' => function ($query) {
                    EcommerceCompanyContext::applyScope($query->withoutGlobalScope('company'))
                        ->select('id', 'product_id', 'price', 'quantity', 'created_at')
                        ->with('salesChannels')
                        ->orderByDesc('created_at');
                },
            ])
            ->latest('created_at')
            ->take(4)
            ->get()
            ->map(fn (Product $product) => $this->formatRecommendation($product))
            ->values();

        return response()->json([
            'status' => 1,
            'message' => 'Customer dashboard fetched successfully.',
            'data' => [
                'summary' => [
                    'active_orders_count' => (clone $orderQuery)->count(),
                    'wishlist_count' => $wishlistProductIds->count(),
                    'reward_points' => (int) ($user->total_reword ?? 0),
                    'available_coupons_count' => $this->resolveCouponCount($user, $today),
                ],
                'current_order' => $this->formatCurrentOrder($latestOrder),
                'recommendations' => $recommendations,
            ],
        ]);
    }

    private function resolveCouponCount(Model $user, Carbon $today): int
    {
        $query = DiscountSetup::query()
            ->withoutGlobalScope('company')
            ->where('type', 'coupon')
            ->where('is_active', 1)
            ->where(function (Builder $builder) use ($today) {
                $builder->whereNull('form_date')
                    ->orWhereDate('form_date', '<=', $today);
            })
            ->where(function (Builder $builder) use ($today) {
                $builder->whereNull('to_date')
                    ->orWhereDate('to_date', '>=', $today);
            });

        $companyId = EcommerceCompanyContext::currentCompanyId()
            ?: (! empty($user->company_id) ? (string) $user->company_id : null);

        if ($companyId) {
            $query->where('company_id', $companyId);
        }

        return (int) $query->count();
    }

    private function formatCurrentOrder(?CustomerOrder $order): ?array
    {
        if (! $order) {
            return null;
        }

        $status = (string) $order->order_status;
        $currentStep = match ($status) {
            'pending' => 1,
            'processing' => 2,
            'shipped' => 3,
            'delivered' => 4,
            'returned' => 4,
            default => 1,
        };

        $steps = collect([
            ['id' => 1, 'label' => 'Order Placed'],
            ['id' => 2, 'label' => 'Processing'],
            ['id' => 3, 'label' => 'Shipped'],
            ['id' => 4, 'label' => 'Delivered'],
        ])->map(fn (array $step) => [
            ...$step,
            'completed' => $status !== 'cancelled' && $step['id'] <= $currentStep,
        ])->values();

        $placedAt = $order->placed_at ?? $order->created_at;
        $estimatedDelivery = $placedAt?->copy()?->addDays((string) $order->order_status === 'delivered' ? 0 : 5)?->format('M j, Y');

        return [
            'order_id' => (string) $order->order_no,
            'status_label' => match ($status) {
                'pending' => 'Pending',
                'processing' => 'Processing',
                'shipped' => 'Shipped',
                'delivered' => 'Delivered',
                'cancelled' => 'Cancelled',
                'returned' => 'Returned',
                default => ucfirst(str_replace('_', ' ', $status)),
            },
            'estimated_delivery' => $estimatedDelivery,
            'placed_at' => $placedAt?->toIso8601String(),
            'is_tracking_inferred' => false,
            'tracking_note' => match ($status) {
                'pending' => 'Your order has been received and is waiting for seller confirmation.',
                'processing' => 'The seller is preparing your order for shipment.',
                'shipped' => 'Your package is on the way. Tracking progress will update after the next scan.',
                'delivered' => 'This order has been delivered successfully.',
                'cancelled' => 'This order was cancelled before shipment.',
                'returned' => 'This order has been marked as returned.',
                default => 'Order status updates will appear here.',
            },
            'steps' => $steps,
        ];
    }

    private function formatRecommendation(Product $product): array
    {
        $latestInStockPrice = optional(
            $product->inventory_items->firstWhere('quantity', '>', 0)
        )->price;
        $latestKnownPrice = optional($product->inventory_items->first())->price;
        $price = (float) ($latestInStockPrice ?? $latestKnownPrice ?? 0);
        $quantity = $this->resolveOnlineStoreQuantity(
            $product,
            (float) $product->inventory_items->where('quantity', '>', 0)->sum('quantity')
        );
        $categoryName = (string) ($product->category?->title ?? 'Recommended');

        return [
            'id' => (string) $product->id,
            'name' => (string) $product->name,
            'slug' => (string) $product->slug,
            'category' => $categoryName,
            'price' => $price,
            'original_price' => $price > 0 ? round($price * 1.2, 2) : 0,
            'image' => (string) ($product->thumbnail ?: asset('images/placeholder.jpg')),
            'bg_image' => asset('images/home/bestsell/p-bg.webp'),
            'badge' => (string) ($product->stock_visibility_label ?: $categoryName),
            'rating' => 4.5,
            'reviews' => 0,
            'quantity' => $quantity,
            'url' => '/product/' . $product->slug,
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
        $snapshot = $this->getChannelQuantitySnapshot($product, SalesChannel::OnlineStore->value);

        if ($snapshot['exists']) {
            return round(max((float) $snapshot['quantity'], 0), 2);
        }

        $channels = is_array($product->sales_channel) ? $product->sales_channel : [];
        $onlinePercentage = (float) ($channels[SalesChannel::OnlineStore->value] ?? 100);

        if ($onlinePercentage <= 0) {
            return 0;
        }

        if ($onlinePercentage >= 100) {
            return round($totalQuantity, 2);
        }

        return round(($totalQuantity * $onlinePercentage) / 100, 2);
    }
}
