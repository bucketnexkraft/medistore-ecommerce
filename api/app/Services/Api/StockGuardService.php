<?php

namespace App\Services\Api;

use App\Data\FeaturePreference;
use App\Data\StockGuardConfig;
use App\Enums\StockAdjustmentReason;
use App\Enums\StockAdjustmentStatus;
use App\Enums\StockGuardFlag;
use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Models\StockAdjustmentRequest;
use App\Models\Company;
use App\Services\StockMovementService;
use App\Utils\PermissionUtils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class StockGuardService
{
    public function __construct(private readonly StockMovementService $stockMovementService)
    {
    }

    public function options(): array
    {
        $this->ensureEnabled();
        $rules = $this->getRulesForCompany();

        return [
            'status' => 1,
            'data' => [
                'reasons' => StockAdjustmentReason::options(),
                'rules' => $rules,
                'inventory_items' => $this->inventoryOptions(),
            ],
        ];
    }

    public function updateRules(Request $request): array
    {
        $this->ensureEnabled();

        $validated = $request->validate([
            'unit_threshold' => ['required', 'numeric', 'min:0.01'],
            'value_threshold' => ['required', 'numeric', 'min:0.01'],
        ]);

        $companyId = Auth::user()?->company_id;
        $company = Company::query()->where('company_id', $companyId)->firstOrFail();

        if (!Schema::hasColumn('company', 'stockguard_unit_threshold') || !Schema::hasColumn('company', 'stockguard_value_threshold')) {
            return [
                'status' => 0,
                'message' => 'StockGuard rule columns are missing. Please run database migrations.',
            ];
        }

        $company->stockguard_unit_threshold = (float) $validated['unit_threshold'];
        $company->stockguard_value_threshold = (float) $validated['value_threshold'];
        $company->save();

        return [
            'status' => 1,
            'message' => 'StockGuard rules updated successfully.',
            'data' => [
                'rules' => $this->getRulesForCompany($company),
            ],
        ];
    }

    public function list(Request $request): array
    {
        $this->ensureEnabled();

        $query = StockAdjustmentRequest::query()
            ->with([
                'product:id,name,code,thumbnail',
                'warehouse:id,name',
                'requestedBy:id,first_name,last_name',
                'approvedBy:id,first_name,last_name',
            ])
            ->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->whereHas('product', fn ($q) => $q
                ->where('name', 'LIKE', "%{$search}%")
                ->orWhere('code', 'LIKE', "%{$search}%"));
        }

        $requests = $query->paginate((int) $request->input('perPage', 20));

        return [
            'status' => 1,
            'data' => $requests->getCollection()->map(fn ($item) => $this->formatRequest($item))->values(),
            'meta' => [
                'current_page' => $requests->currentPage(),
                'per_page' => $requests->perPage(),
                'total' => $requests->total(),
                'last_page' => $requests->lastPage(),
            ],
        ];
    }

    public function store(Request $request): array
    {
        $this->ensureEnabled();

        $validated = $request->validate([
            'inventory_item_id' => ['required', 'exists:inventory_items,id'],
            'qty_change' => ['required', 'numeric', 'not_in:0'],
            'reason' => ['required', Rule::in(array_map(fn (StockAdjustmentReason $reason) => $reason->value, StockAdjustmentReason::cases()))],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $reason = StockAdjustmentReason::from($validated['reason']);
        if ($reason->requiresNote() && empty($validated['note'])) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'note' => ['Note is required for this reason.'],
            ]);
        }

        return DB::transaction(function () use ($validated, $reason) {
            $item = InventoryItem::with(['inventory', 'product', 'warehouse'])->lockForUpdate()->findOrFail($validated['inventory_item_id']);
            $inventory = $item->inventory ?: Inventory::where('product_id', $item->product_id)
                ->where('warehouse_id', $item->warehouse_id)
                ->lockForUpdate()
                ->firstOrFail();

            $qtyChange = (float) $validated['qty_change'];
            $unitCost = (float) ($item->purchase_price ?? 0);
            $quantityBefore = (float) $inventory->quantity;
            $valueChange = $qtyChange * $unitCost;
            $rules = $this->getRulesForCompany();
            $flags = StockGuardConfig::flags(
                $qtyChange,
                $unitCost,
                $reason,
                (float) $rules['unit_threshold'],
                (float) $rules['value_threshold']
            );
            $flagValues = array_map(fn (StockGuardFlag $flag) => $flag->value, $flags);
            $approvalRequired = StockGuardConfig::requiresApproval(
                $qtyChange,
                $unitCost,
                (float) $rules['unit_threshold'],
                (float) $rules['value_threshold']
            )
                || in_array(StockGuardFlag::SUSPICIOUS_REASON, $flags, true);

            $adjustment = StockAdjustmentRequest::create([
                'company_id' => Auth::user()?->company_id,
                'product_id' => $item->product_id,
                'inventory_id' => $inventory->id,
                'inventory_item_id' => $item->id,
                'warehouse_id' => $item->warehouse_id,
                'qty_change' => $qtyChange,
                'quantity_before' => $quantityBefore,
                'quantity_after' => $approvalRequired ? null : max(0, $quantityBefore + $qtyChange),
                'unit_cost' => $unitCost,
                'value_change' => $valueChange,
                'reason' => $reason->value,
                'note' => $validated['note'] ?? null,
                'status' => $approvalRequired ? StockAdjustmentStatus::PENDING : StockAdjustmentStatus::APPLIED,
                'flags' => $flagValues,
                'is_flagged' => count($flagValues) > 0,
                'requested_by' => Auth::id(),
                'applied_at' => $approvalRequired ? null : now(),
            ]);

            if (!$approvalRequired) {
                $this->applyAdjustment($adjustment, $item, $inventory);
            }

            return [
                'status' => 1,
                'message' => $approvalRequired ? 'Adjustment request submitted for approval.' : 'Stock adjustment applied.',
                'data' => $this->formatRequest($adjustment->fresh([
                    'product',
                    'warehouse',
                    'requestedBy:id,first_name,last_name',
                    'approvedBy:id,first_name,last_name',
                ])),
            ];
        });
    }

    public function approve(string $id): array
    {
        $this->ensureEnabled();

        return DB::transaction(function () use ($id) {
            $adjustment = StockAdjustmentRequest::lockForUpdate()->findOrFail($id);

            if ($adjustment->status !== StockAdjustmentStatus::PENDING) {
                return ['status' => 0, 'message' => 'Only pending requests can be approved.'];
            }

            $item = InventoryItem::lockForUpdate()->findOrFail($adjustment->inventory_item_id);
            $inventory = Inventory::lockForUpdate()->findOrFail($adjustment->inventory_id);

            $adjustment->status = StockAdjustmentStatus::APPROVED;
            $adjustment->approved_by = Auth::id();
            $adjustment->approved_at = now();
            $adjustment->save();

            $this->applyAdjustment($adjustment, $item, $inventory);

            return [
                'status' => 1,
                'message' => 'Adjustment approved and applied.',
                'data' => $this->formatRequest($adjustment->fresh([
                    'product',
                    'warehouse',
                    'requestedBy:id,first_name,last_name',
                    'approvedBy:id,first_name,last_name',
                ])),
            ];
        });
    }

    public function reject(string $id, Request $request): array
    {
        $this->ensureEnabled();

        $adjustment = StockAdjustmentRequest::findOrFail($id);
        if ($adjustment->status !== StockAdjustmentStatus::PENDING) {
            return ['status' => 0, 'message' => 'Only pending requests can be rejected.'];
        }

        $adjustment->status = StockAdjustmentStatus::REJECTED;
        $adjustment->approved_by = Auth::id();
        $adjustment->approved_at = now();
        if ($request->filled('note')) {
            $adjustment->note = trim(($adjustment->note ? $adjustment->note . "\n" : '') . 'Rejection: ' . $request->input('note'));
        }
        $adjustment->save();

        return [
            'status' => 1,
            'message' => 'Adjustment rejected.',
            'data' => $this->formatRequest($adjustment->fresh([
                'product',
                'warehouse',
                'requestedBy:id,first_name,last_name',
                'approvedBy:id,first_name,last_name',
            ])),
        ];
    }

    private function applyAdjustment(StockAdjustmentRequest $adjustment, InventoryItem $item, Inventory $inventory): void
    {
        $before = (float) $inventory->quantity;
        $item->quantity = max(0, (float) $item->quantity + (float) $adjustment->qty_change);
        $inventory->quantity = max(0, $before + (float) $adjustment->qty_change);
        $item->save();
        $inventory->save();

        $adjustment->quantity_before = $before;
        $adjustment->quantity_after = (float) $inventory->quantity;
        $adjustment->status = StockAdjustmentStatus::APPLIED;
        $adjustment->applied_at = now();
        $adjustment->save();

        $this->stockMovementService->record([
            'company_id' => $adjustment->company_id,
            'product_id' => $adjustment->product_id,
            'inventory_id' => $adjustment->inventory_id,
            'inventory_item_id' => $adjustment->inventory_item_id,
            'warehouse_id' => $adjustment->warehouse_id,
            'type' => StockMovementService::TYPE_ADJUSTED,
            'quantity_change' => $adjustment->qty_change,
            'quantity_before' => $before,
            'quantity_after' => (float) $inventory->quantity,
            'reference_type' => StockMovementService::REF_MANUAL_ADJUSTMENT,
            'reference_id' => $adjustment->id,
            'note' => 'StockGuard adjustment: ' . $adjustment->reason,
        ]);
    }

    private function inventoryOptions()
    {
        return InventoryItem::query()
            ->with(['product:id,name,code', 'warehouse:id,name'])
            ->where('quantity', '>', 0)
            ->latest()
            ->limit(200)
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'inventory_id' => $item->inventory_id,
                'warehouse_id' => $item->warehouse_id,
                'label' => ($item->product?->name ?? 'Product') . ' - ' . ($item->warehouse?->name ?? 'Warehouse') . ' - Qty ' . (float) $item->quantity,
                'product' => $item->product?->name,
                'warehouse' => $item->warehouse?->name,
                'quantity' => (float) $item->quantity,
                'unit_cost' => (float) ($item->purchase_price ?? 0),
            ])
            ->values();
    }

    private function formatRequest(StockAdjustmentRequest $item): array
    {
        return [
            'id' => $item->id,
            'product' => $item->product?->name ?? 'N/A',
            'warehouse' => $item->warehouse?->name ?? 'N/A',
            'qty_change' => (float) $item->qty_change,
            'quantity_before' => (float) $item->quantity_before,
            'quantity_after' => $item->quantity_after !== null ? (float) $item->quantity_after : null,
            'unit_cost' => (float) ($item->unit_cost ?? 0),
            'value_change' => (float) ($item->value_change ?? 0),
            'reason' => $item->reason,
            'reason_label' => StockAdjustmentReason::tryFrom($item->reason)?->label() ?? $item->reason,
            'note' => $item->note,
            'status' => $item->status instanceof StockAdjustmentStatus ? $item->status->value : $item->status,
            'status_label' => $item->status instanceof StockAdjustmentStatus ? $item->status->label() : ucfirst((string) $item->status),
            'flags' => collect($item->flags ?? [])->map(fn ($flag) => [
                'value' => $flag,
                'label' => StockGuardFlag::tryFrom($flag)?->label() ?? $flag,
            ])->values(),
            'is_flagged' => (bool) $item->is_flagged,
            'requested_by' => $this->formatUserName($item->requestedBy),
            'approved_by' => $this->formatUserName($item->approvedBy),
            'created_at' => $item->created_at?->toIso8601String(),
            'approved_at' => $item->approved_at?->toIso8601String(),
            'applied_at' => $item->applied_at?->toIso8601String(),
        ];
    }

    private function formatUserName($user): ?string
    {
        if (!$user) {
            return null;
        }

        return trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? '')) ?: null;
    }

    private function ensureEnabled(): void
    {
        if (!PermissionUtils::isFeatureAccessible(Auth::user()?->company_id, FeaturePreference::STOCKGUARD->value)) {
            abort(403, 'StockGuard is not enabled.');
        }
    }

    private function getRulesForCompany(?Company $company = null): array
    {
        if (!Schema::hasColumn('company', 'stockguard_unit_threshold') || !Schema::hasColumn('company', 'stockguard_value_threshold')) {
            return StockGuardConfig::options();
        }

        $resolvedCompany = $company;

        if (!$resolvedCompany) {
            $companyId = Auth::user()?->company_id;
            if ($companyId) {
                $resolvedCompany = Company::query()
                    ->select(['company_id', 'stockguard_unit_threshold', 'stockguard_value_threshold'])
                    ->where('company_id', $companyId)
                    ->first();
            }
        }

        return StockGuardConfig::options(
            $resolvedCompany ? (float) $resolvedCompany->stockguard_unit_threshold : null,
            $resolvedCompany ? (float) $resolvedCompany->stockguard_value_threshold : null
        );
    }
}
