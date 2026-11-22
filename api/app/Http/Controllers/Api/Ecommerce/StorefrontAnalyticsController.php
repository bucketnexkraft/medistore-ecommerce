<?php

namespace App\Http\Controllers\Api\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsEvent;
use App\Models\CustomerOrder;
use App\Support\EcommerceCompanyContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StorefrontAnalyticsController extends Controller
{
    private const EVENTS = [
        'page_view',
        'view_item',
        'add_to_cart',
        'remove_from_cart',
        'view_cart',
        'begin_checkout',
        'purchase',
        'search',
    ];

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'event_id' => ['required', 'string', 'max:80'],
            'session_id' => ['required', 'string', 'max:80'],
            'event_name' => ['required', Rule::in(self::EVENTS)],
            'product_id' => ['nullable', 'string', 'max:100'],
            'product_name' => ['nullable', 'string', 'max:255'],
            'order_id' => ['nullable', 'string', 'max:80'],
            'page_path' => ['nullable', 'string', 'max:500'],
            'page_title' => ['nullable', 'string', 'max:255'],
            'referrer' => ['nullable', 'string', 'max:2000'],
            'source' => ['nullable', 'string', 'max:120'],
            'medium' => ['nullable', 'string', 'max:120'],
            'campaign' => ['nullable', 'string', 'max:180'],
            'value' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:10'],
            'metadata' => ['nullable', 'array'],
        ]);

        $companyId = EcommerceCompanyContext::currentCompanyId();

        if (! $companyId) {
            return response()->json(['status' => 0, 'message' => 'Store could not be resolved.'], 422);
        }

        if ($payload['event_name'] === 'purchase') {
            $order = CustomerOrder::query()
                ->where('company_id', $companyId)
                ->where(function ($query) use ($payload) {
                    $query->where('id', $payload['order_id'] ?? '')
                        ->orWhere('order_no', $payload['order_id'] ?? '');
                })
                ->first();

            if (! $order) {
                return response()->json(['status' => 0, 'message' => 'Order could not be verified.'], 422);
            }

            $payload['order_id'] = (string) $order->id;
            $payload['value'] = (float) $order->total_amount;
            $payload['event_id'] = 'purchase-'.$order->id;
        }

        [$deviceType, $browser, $operatingSystem] = $this->parseUserAgent((string) $request->userAgent());
        $metadata = Arr::only($payload['metadata'] ?? [], ['quantity', 'category', 'brand', 'search_term']);

        AnalyticsEvent::query()->firstOrCreate(
            ['company_id' => $companyId, 'event_id' => $payload['event_id']],
            [
                ...Arr::except($payload, ['metadata']),
                'user_id' => optional($request->user('api'))->id,
                'source' => $this->cleanAttribution($payload['source'] ?? null, '(direct)'),
                'medium' => $this->cleanAttribution($payload['medium'] ?? null, '(none)'),
                'device_type' => $deviceType,
                'browser' => $browser,
                'operating_system' => $operatingSystem,
                'metadata' => $metadata ?: null,
                'occurred_at' => now(),
            ],
        );

        return response()->json(['status' => 1], 202);
    }

    private function cleanAttribution(?string $value, string $fallback): string
    {
        $cleaned = trim(strip_tags((string) $value));

        return $cleaned !== '' ? Str::limit($cleaned, 120, '') : $fallback;
    }

    private function parseUserAgent(string $userAgent): array
    {
        $device = preg_match('/mobile|android|iphone|ipad/i', $userAgent) ? 'mobile' : 'desktop';
        if (preg_match('/ipad|tablet/i', $userAgent)) {
            $device = 'tablet';
        }

        $browser = match (true) {
            str_contains($userAgent, 'Edg/') => 'Edge',
            str_contains($userAgent, 'OPR/') => 'Opera',
            str_contains($userAgent, 'Chrome/') => 'Chrome',
            str_contains($userAgent, 'Safari/') => 'Safari',
            str_contains($userAgent, 'Firefox/') => 'Firefox',
            default => 'Other',
        };

        $os = match (true) {
            str_contains($userAgent, 'Windows') => 'Windows',
            str_contains($userAgent, 'Android') => 'Android',
            preg_match('/iPhone|iPad|iPod/', $userAgent) === 1 => 'iOS',
            str_contains($userAgent, 'Mac OS') => 'macOS',
            str_contains($userAgent, 'Linux') => 'Linux',
            default => 'Other',
        };

        return [$device, $browser, $os];
    }
}
