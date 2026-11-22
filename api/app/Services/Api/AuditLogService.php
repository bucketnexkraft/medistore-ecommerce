<?php

namespace App\Services\Api;

use App\Models\UserActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuditLogService
{
    public function index(Request $request)
    {
        $perPage = max((int) $request->input('perPage', 20), 1);
        $page = max((int) $request->input('page', 1), 1);
        $includeViewed = filter_var($request->input('include_viewed', false), FILTER_VALIDATE_BOOL);

        $query = UserActivity::query()
            ->leftJoin('user as actor', 'actor.id', '=', 'user_activities.user_id')
            ->select([
                'user_activities.id',
                'user_activities.user_id',
                'user_activities.ip_address',
                'user_activities.user_agent',
                'user_activities.endpoint',
                'user_activities.method',
                'user_activities.status_code',
                'user_activities.payload',
                'user_activities.created_at',
                'actor.first_name as actor_first_name',
                'actor.last_name as actor_last_name',
                'actor.email as actor_email',
                'actor.phone as actor_phone',
                'actor.company_id as actor_company_id',
            ]);

        $user = Auth::user();
        if ($user && !$user->isSuperAdmin()) {
            $query->where('actor.company_id', $user->company_id);
        } elseif ($request->filled('company_id')) {
            $query->where('actor.company_id', $request->input('company_id'));
        }

        if ($request->filled('keyword')) {
            $keyword = trim((string) $request->input('keyword'));
            $query->where(function ($q) use ($keyword) {
                $q->where('user_activities.endpoint', 'like', "%{$keyword}%")
                    ->orWhere('user_activities.ip_address', 'like', "%{$keyword}%")
                    ->orWhere('user_activities.method', 'like', "%{$keyword}%")
                    ->orWhere('user_activities.status_code', 'like', "%{$keyword}%")
                    ->orWhere('actor.first_name', 'like', "%{$keyword}%")
                    ->orWhere('actor.last_name', 'like', "%{$keyword}%")
                    ->orWhere('actor.email', 'like', "%{$keyword}%");
            });
        }

        if ($request->filled('method')) {
            $query->where('user_activities.method', strtoupper((string) $request->input('method')));
        }

        if ($request->filled('status_code')) {
            $query->where('user_activities.status_code', (string) $request->input('status_code'));
        }

        if ($request->filled('user_id')) {
            $query->where('user_activities.user_id', (string) $request->input('user_id'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('user_activities.created_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('user_activities.created_at', '<=', $request->input('date_to'));
        }

        // By default, hide read-only/view events to keep audit log meaningful.
        if (!$includeViewed) {
            $query->whereNotIn('user_activities.method', ['GET']);
            $query->whereNotIn('user_activities.endpoint', [
                'api/v1/verify-token',
                'api/v1/me',
                'api/v1/user/rights',
                'api/v1/get-custom-data',
                'api/v1/get-currency',
            ]);
        }

        $logs = $query
            ->orderByDesc('user_activities.id')
            ->paginate($perPage, ['*'], 'page', $page);

        $data = collect($logs->items())->map(function ($row) {
            $actorName = trim(($row->actor_first_name ?? '') . ' ' . ($row->actor_last_name ?? ''));
            $payload = $this->decodePayload($row->payload);
            $friendly = $this->resolveFriendlyAction((string) $row->method, (string) $row->endpoint, (string) $row->status_code, is_array($payload) ? $payload : []);
            return [
                'id' => $row->id,
                'user_id' => $row->user_id,
                'actor_name' => $actorName !== '' ? $actorName : 'System/Guest',
                'actor_email' => $row->actor_email,
                'actor_phone' => $row->actor_phone,
                'module' => $friendly['module'],
                'action_label' => $friendly['action_label'],
                'action_key' => $friendly['action_key'],
                'action_summary' => $friendly['action_summary'],
                'action_details' => $friendly['action_details'],
                'ip_address' => $row->ip_address,
                'user_agent' => $row->user_agent,
                'endpoint' => $row->endpoint,
                'method' => $row->method,
                'status_code' => (string) $row->status_code,
                'payload' => $payload,
                'created_at' => optional($row->created_at)->toDateTimeString(),
            ];
        })->values();

        return response()->json([
            'status' => 1,
            'message' => 'Audit logs fetched successfully',
            'data' => $data,
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    public function show(Request $request, int $id)
    {
        $query = UserActivity::query()
            ->leftJoin('user as actor', 'actor.id', '=', 'user_activities.user_id')
            ->where('user_activities.id', $id)
            ->select([
                'user_activities.*',
                'actor.first_name as actor_first_name',
                'actor.last_name as actor_last_name',
                'actor.email as actor_email',
                'actor.phone as actor_phone',
                'actor.company_id as actor_company_id',
            ]);

        $user = Auth::user();
        if ($user && !$user->isSuperAdmin()) {
            $query->where('actor.company_id', $user->company_id);
        } elseif ($request->filled('company_id')) {
            $query->where('actor.company_id', $request->input('company_id'));
        }

        $log = $query->first();
        if (!$log) {
            return response()->json([
                'status' => 0,
                'message' => 'Audit log not found',
            ], 404);
        }

        $actorName = trim(($log->actor_first_name ?? '') . ' ' . ($log->actor_last_name ?? ''));
        $payload = $this->decodePayload($log->payload);
        $friendly = $this->resolveFriendlyAction((string) $log->method, (string) $log->endpoint, (string) $log->status_code, is_array($payload) ? $payload : []);
        return response()->json([
            'status' => 1,
            'message' => 'Audit log fetched successfully',
            'data' => [
                'id' => $log->id,
                'user_id' => $log->user_id,
                'actor_name' => $actorName !== '' ? $actorName : 'System/Guest',
                'actor_email' => $log->actor_email,
                'actor_phone' => $log->actor_phone,
                'module' => $friendly['module'],
                'action_label' => $friendly['action_label'],
                'action_key' => $friendly['action_key'],
                'action_summary' => $friendly['action_summary'],
                'action_details' => $friendly['action_details'],
                'ip_address' => $log->ip_address,
                'user_agent' => $log->user_agent,
                'endpoint' => $log->endpoint,
                'method' => $log->method,
                'status_code' => (string) $log->status_code,
                'payload' => $payload,
                'created_at' => optional($log->created_at)->toDateTimeString(),
                'updated_at' => optional($log->updated_at)->toDateTimeString(),
            ],
        ]);
    }

    private function decodePayload($payload): mixed
    {
        if (is_array($payload)) {
            return $payload;
        }

        if (!is_string($payload) || trim($payload) === '') {
            return [];
        }

        $decoded = json_decode($payload, true);
        return json_last_error() === JSON_ERROR_NONE ? $decoded : ['raw' => $payload];
    }

    private function resolveFriendlyAction(string $method, string $endpoint, string $statusCode, array $payload = []): array
    {
        $cleanEndpoint = trim($endpoint, '/');
        $statusText = str_starts_with($statusCode, '2') ? 'Success' : (str_starts_with($statusCode, '4') ? 'Client Error' : (str_starts_with($statusCode, '5') ? 'Server Error' : 'Processed'));

        $map = [
            ['pattern' => '#^api/v1/login$#', 'module' => 'Auth', 'label' => 'User Login'],
            ['pattern' => '#^api/v1/logout$#', 'module' => 'Auth', 'label' => 'User Logout'],
            ['pattern' => '#^api/v1/sale/store$#', 'module' => 'Sales', 'label' => 'Sale Order Created'],
            ['pattern' => '#^api/v1/sale/update/.+$#', 'module' => 'Sales', 'label' => 'Sale Order Updated'],
            ['pattern' => '#^api/v1/sale/delete/.+$#', 'module' => 'Sales', 'label' => 'Sale Order Deleted'],
            ['pattern' => '#^api/v1/purchase/store$#', 'module' => 'Stock In', 'label' => 'Stock In Created'],
            ['pattern' => '#^api/v1/purchase/update/.+$#', 'module' => 'Stock In', 'label' => 'Stock In Updated'],
            ['pattern' => '#^api/v1/purchase/delete/.+$#', 'module' => 'Stock In', 'label' => 'Stock In Deleted'],
            ['pattern' => '#^api/v1/product/store$#', 'module' => 'Product', 'label' => 'Product Created'],
            ['pattern' => '#^api/v1/product/update/.+$#', 'module' => 'Product', 'label' => 'Product Updated'],
            ['pattern' => '#^api/v1/product/delete/.+$#', 'module' => 'Product', 'label' => 'Product Deleted'],
            ['pattern' => '#^api/v1/customer/store$#', 'module' => 'Customer', 'label' => 'Customer Created'],
            ['pattern' => '#^api/v1/warehouses/store$#', 'module' => 'Warehouse', 'label' => 'Warehouse Created'],
            ['pattern' => '#^api/v1/stock-transfers$#', 'module' => 'Stock Transfer', 'label' => 'Stock Transfer Created'],
            ['pattern' => '#^api/v1/sales/.+/return$#', 'module' => 'Sales Return', 'label' => 'Sale Return Processed'],
        ];

        foreach ($map as $item) {
            if (preg_match($item['pattern'], $cleanEndpoint)) {
                $actionLabel = $item['label'];
                return [
                    'module' => $item['module'],
                    'action_label' => $actionLabel,
                    'action_key' => strtolower(str_replace(' ', '_', $actionLabel)),
                    'action_summary' => "{$actionLabel} ({$statusText})",
                    'action_details' => $this->buildActionDetails($payload),
                ];
            }
        }

        [$module, $actionLabel] = $this->resolveGenericAction($method, $cleanEndpoint);
        if (!$actionLabel) {
            $actionLabel = strtoupper($method) . ' ' . str_replace(['api/v1/', '/'], ['', ' > '], $cleanEndpoint);
        }

        return [
            'module' => $module ?: 'System',
            'action_label' => $actionLabel,
            'action_key' => strtolower(str_replace(' ', '_', $actionLabel)),
            'action_summary' => "{$actionLabel} ({$statusText})",
            'action_details' => $this->buildActionDetails($payload),
        ];
    }

    private function resolveGenericAction(string $method, string $cleanEndpoint): array
    {
        $path = preg_replace('#^api/v1/#', '', $cleanEndpoint);
        $parts = array_values(array_filter(explode('/', (string) $path)));
        if (count($parts) === 0) {
            return ['System', null];
        }

        $resource = $parts[0];
        $module = $this->toTitle($resource);

        if (in_array('store', $parts, true) || strtoupper($method) === 'POST') {
            return [$module, "{$module} Created"];
        }

        if (in_array('update', $parts, true) || in_array(strtoupper($method), ['PUT', 'PATCH'], true)) {
            return [$module, "{$module} Updated"];
        }

        if (in_array('delete', $parts, true) || strtoupper($method) === 'DELETE') {
            return [$module, "{$module} Deleted"];
        }

        if (strtoupper($method) === 'GET') {
            return [$module, "{$module} Viewed"];
        }

        return [$module, strtoupper($method) . " {$module} Action"];
    }

    private function toTitle(string $value): string
    {
        $normalized = str_replace(['-', '_'], ' ', $value);
        if (str_ends_with($normalized, 's') && strlen($normalized) > 3) {
            $normalized = rtrim($normalized, 's');
        }
        return ucwords($normalized);
    }

    private function buildActionDetails(array $payload): string
    {
        if (empty($payload)) {
            return 'No additional details';
        }

        $importantKeys = [
            'name', 'title', 'code', 'sku', 'barcode', 'email', 'phone',
            'amount', 'total', 'qty', 'quantity', 'invoice_no', 'return_no',
            'warehouse_id', 'category_id', 'product_id', 'customer_id', 'supplier_id',
        ];

        $details = [];
        foreach ($importantKeys as $key) {
            if (array_key_exists($key, $payload) && $payload[$key] !== null && $payload[$key] !== '') {
                $value = is_scalar($payload[$key]) ? (string) $payload[$key] : json_encode($payload[$key]);
                $details[] = ucwords(str_replace('_', ' ', $key)) . ': ' . $value;
            }
        }

        if (empty($details) && isset($payload['items']) && is_array($payload['items'])) {
            $details[] = 'Items: ' . count($payload['items']);
        }

        if (empty($details)) {
            $snippet = json_encode($payload);
            return strlen((string) $snippet) > 160 ? substr((string) $snippet, 0, 157) . '...' : (string) $snippet;
        }

        return implode(' | ', array_slice($details, 0, 5));
    }
}
