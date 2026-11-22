<?php

namespace App\Services\Api;

use App\Models\Company;
use App\Models\InvoiceItem;
use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\ProductBundle;
use App\Services\ProductBundleService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ProductBundleControllerService
{
    public function __construct(private readonly ProductBundleService $bundleService)
    {
    }

    public function index(Request $request)
    {
        $perPage = (int) $request->input('perPage', 20);
        $page = (int) $request->input('page', 1);
        $search = trim((string) $request->input('search', ''));
        $status = $request->input('status', '');

        $query = ProductBundle::query()
            ->with(['bundleItems.product', 'product'])
            ->when($search !== '', function ($builder) use ($search) {
                $builder->where('name', 'LIKE', "%{$search}%");
            })
            ->when($status !== '' && $status !== null, function ($builder) use ($status) {
                $builder->where('is_active', (int) $status);
            })
            ->orderByDesc('created_at');

        $bundles = $query->paginate($perPage, ['*'], 'page', $page);

        $data = $bundles->getCollection()->map(function (ProductBundle $bundle) {
            $summary = $this->bundleService->calculateBundle($bundle, null, 1, false);

            return [
                'id' => $bundle->id,
                'uuid' => $bundle->uuid,
                'product_id' => $bundle->product_id,
                'name' => $bundle->name,
                'code' => $bundle->getResolvedBarcode(),
                'barcode' => $bundle->getResolvedBarcode(),
                'discount_type' => $bundle->discount_type,
                'discount_value' => (float) $bundle->discount_value,
                'deduction_mode' => $bundle->deduction_mode ?? 'relaxed',
                'bundle_qty' => (float) ($bundle->bundle_qty ?? 1),
                'is_active' => (int) $bundle->is_active,
                'inventory_qty' => (float) ($bundle->product?->inventory()->sum('quantity') ?? 0),
                'bundle_price' => $summary['bundle_price_per_bundle'],
                'base_price' => $summary['base_price_per_bundle'],
                'discount_amount' => $summary['discount_amount_per_bundle'],
                'products' => $bundle->bundleItems->map(fn ($item) => [
                    'product_id' => $item->product_id,
                    'product_name' => $item->product?->name,
                    'quantity' => (float) $item->quantity,
                ])->values(),
            ];
        });

        $bundles->setCollection($data);

        return response()->json([
            'status' => 1,
            'message' => 'Bundles fetched successfully',
            'data' => $bundles->items(),
            'meta' => [
                'current_page' => $bundles->currentPage(),
                'per_page' => $bundles->perPage(),
                'total' => $bundles->total(),
                'last_page' => $bundles->lastPage(),
            ],
        ]);
    }

    public function show($id)
    {
        $bundle = ProductBundle::with(['bundleItems.product', 'product'])->findOrFail($id);
        $summary = $this->bundleService->calculateBundle($bundle, null, 1, false);

        return response()->json([
            'status' => 1,
            'message' => 'Bundle fetched successfully',
            'data' => [
                'id' => $bundle->id,
                'uuid' => $bundle->uuid,
                'product_id' => $bundle->product_id,
                'name' => $bundle->name,
                'code' => $bundle->getResolvedBarcode(),
                'barcode' => $bundle->getResolvedBarcode(),
                'discount_type' => $bundle->discount_type,
                'discount_value' => (float) $bundle->discount_value,
                'deduction_mode' => $bundle->deduction_mode ?? 'relaxed',
                'bundle_qty' => (float) ($bundle->bundle_qty ?? 1),
                'is_active' => (int) $bundle->is_active,
                'inventory_qty' => (float) ($bundle->product?->inventory()->sum('quantity') ?? 0),
                'base_price' => $summary['base_price_per_bundle'],
                'discount_amount' => $summary['discount_amount_per_bundle'],
                'bundle_price' => $summary['bundle_price_per_bundle'],
                'products' => $bundle->bundleItems->map(fn ($item) => [
                    'product_id' => $item->product_id,
                    'product_name' => $item->product?->name,
                    'quantity' => (float) $item->quantity,
                ])->values(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        try {
            $this->bundleService->ensureProductsHaveSellingPrices(
                collect((array) $request->input('products', []))->pluck('product_id')->all()
            );
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 0,
                'errors' => [$e->getMessage()],
            ], 422);
        }

        DB::beginTransaction();

        try {
            $productLimitError = $this->productCreationLimitError();
            if ($productLimitError) {
                DB::rollBack();

                return response()->json($productLimitError, 422);
            }

            $bundle = ProductBundle::create([
                'name' => trim((string) $request->name),
                'discount_type' => $request->discount_type,
                'discount_value' => (float) $request->discount_value,
                'bundle_qty' => (float) ($request->bundle_qty ?? 1),
                'deduction_mode' => $request->input('deduction_mode', 'relaxed'),
                'is_active' => $request->boolean('is_active', true),
            ]);

            $this->bundleService->syncItems($bundle, $request->products);
            $this->syncBundleProductAndInventory($bundle, (float) ($request->bundle_qty ?? 1));
            $bundle->load(['bundleItems.product', 'product']);
            $summary = $this->bundleService->calculateBundle($bundle, null, 1, false);

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Bundle created successfully',
                'data' => [
                    'id' => $bundle->id,
                    'uuid' => $bundle->uuid,
                    'product_id' => $bundle->product_id,
                    'name' => $bundle->name,
                    'code' => $bundle->getResolvedBarcode(),
                    'barcode' => $bundle->getResolvedBarcode(),
                    'discount_type' => $bundle->discount_type,
                    'discount_value' => (float) $bundle->discount_value,
                    'deduction_mode' => $bundle->deduction_mode ?? 'relaxed',
                    'bundle_qty' => (float) ($bundle->bundle_qty ?? 1),
                    'is_active' => (int) $bundle->is_active,
                    'inventory_qty' => (float) ($bundle->product?->inventory()->sum('quantity') ?? 0),
                    'bundle_price' => $summary['bundle_price_per_bundle'],
                    'products' => $bundle->bundleItems,
                ],
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'status' => 0,
                'message' => 'Failed to create bundle',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $bundle = ProductBundle::findOrFail($id);

        try {
            $this->bundleService->ensureProductsHaveSellingPrices(
                collect((array) $request->input('products', []))->pluck('product_id')->all()
            );
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 0,
                'errors' => [$e->getMessage()],
            ], 422);
        }

        DB::beginTransaction();

        try {
            $bundle->update([
                'name' => trim((string) $request->name),
                'discount_type' => $request->discount_type,
                'discount_value' => (float) $request->discount_value,
                'bundle_qty' => (float) ($request->bundle_qty ?? 1),
                'deduction_mode' => $request->input('deduction_mode', $bundle->deduction_mode ?? 'relaxed'),
                'is_active' => $request->boolean('is_active', true),
            ]);

            $this->bundleService->syncItems($bundle, $request->products);
            $this->syncBundleProductAndInventory($bundle, (float) ($request->bundle_qty ?? 1));
            $bundle->load(['bundleItems.product', 'product']);
            $summary = $this->bundleService->calculateBundle($bundle, null, 1, false);

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Bundle updated successfully',
                'data' => [
                    'id' => $bundle->id,
                    'uuid' => $bundle->uuid,
                    'product_id' => $bundle->product_id,
                    'name' => $bundle->name,
                    'code' => $bundle->getResolvedBarcode(),
                    'barcode' => $bundle->getResolvedBarcode(),
                    'discount_type' => $bundle->discount_type,
                    'discount_value' => (float) $bundle->discount_value,
                    'deduction_mode' => $bundle->deduction_mode ?? 'relaxed',
                    'bundle_qty' => (float) ($bundle->bundle_qty ?? 1),
                    'is_active' => (int) $bundle->is_active,
                    'inventory_qty' => (float) ($bundle->product?->inventory()->sum('quantity') ?? 0),
                    'bundle_price' => $summary['bundle_price_per_bundle'],
                    'products' => $bundle->bundleItems,
                ],
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'status' => 0,
                'message' => 'Failed to update bundle',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function destroy($id)
    {
        $bundle = ProductBundle::findOrFail($id);

        if (InvoiceItem::query()->where('bundle_id', $bundle->id)->exists()) {
            return response()->json([
                'status' => 0,
                'message' => 'Bundle cannot be deleted because it has already been used in sales.',
            ], 422);
        }

        $bundle->delete();

        return response()->json([
            'status' => 1,
            'message' => 'Bundle deleted successfully',
        ]);
    }

    public function pricePreview(Request $request, $id)
    {
        $bundle = ProductBundle::with(['bundleItems.product'])->findOrFail($id);
        $qty = max((float) $request->input('qty', 1), 1);
        $warehouseId = $request->input('warehouse_id');

        try {
            $summary = $warehouseId
                ? $this->bundleService->validateBundleStock($bundle, $warehouseId, $qty)
                : $this->bundleService->calculateBundle($bundle, null, $qty, true);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 0,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Bundle price preview generated successfully',
            'data' => $summary,
        ]);
    }

    private function syncBundleProductAndInventory(ProductBundle $bundle, float $qty): void
    {
        $qty = max($qty, 0);
        $summary = $this->bundleService->calculateBundle($bundle, null, 1, false);
        $bundlePrice = (float) ($summary['bundle_price_per_bundle'] ?? 0);

        $product = $bundle->product_id
            ? Product::withTrashed()->find($bundle->product_id)
            : null;

        if (!$product) {
            $product = Product::create([
                'name' => $bundle->name,
                'code' => $bundle->getResolvedBarcode(),
                'status' => (int) $bundle->is_active,
                'is_bundle' => true,
                'bundle_uuid' => $bundle->uuid,
                'description' => 'Bundle product',
            ]);

            $bundle->product_id = $product->id;
            $bundle->save();
        } else {
            $product->name = $bundle->name;
            $product->code = $bundle->getResolvedBarcode();
            $product->status = (int) $bundle->is_active;
            $product->is_bundle = true;
            $product->bundle_uuid = $bundle->uuid;
            $product->save();
        }

        $warehouseId = Auth::user()?->warehouse_id;
        $inventory = Inventory::query()->firstOrCreate(
            [
                'company_id' => Auth::user()?->company_id,
                'warehouse_id' => $warehouseId,
                'product_id' => $product->id,
            ],
            [
                'quantity' => 0,
                'alert_quantity' => 0,
                'stock_out_mood' => 'FIFO',
            ]
        );

        $inventory->quantity = $qty;
        $inventory->save();

        $inventoryItem = InventoryItem::query()
            ->where('inventory_id', $inventory->id)
            ->where('product_id', $product->id)
            ->whereNull('variant_id')
            ->orderByDesc('id')
            ->first();

        if (!$inventoryItem) {
            InventoryItem::create([
                'inventory_id' => $inventory->id,
                'company_id' => Auth::user()?->company_id,
                'warehouse_id' => $warehouseId,
                'product_id' => $product->id,
                'barcode' => $bundle->getResolvedBarcode(),
                'sku' => $bundle->getResolvedBarcode(),
                'quantity' => $qty,
                'price' => $bundlePrice,
                'purchase_price' => $bundlePrice,
                'stock_out_mood' => 'FIFO',
                'alert_quantity' => 0,
            ]);
        } else {
            $inventoryItem->quantity = $qty;
            $inventoryItem->price = $bundlePrice;
            $inventoryItem->purchase_price = $bundlePrice;
            $inventoryItem->barcode = $bundle->getResolvedBarcode();
            $inventoryItem->sku = $bundle->getResolvedBarcode();
            $inventoryItem->save();
        }
    }

    private function productCreationLimitError(): ?array
    {
        $authUser = Auth::user();

        if (! $authUser?->company_id || $authUser->isSuperAdmin()) {
            return null;
        }

        $company = Company::query()
            ->with('saasPlan')
            ->where('company_id', $authUser->company_id)
            ->lockForUpdate()
            ->first();
        $productLimit = (int) ($company?->saasPlan?->inventory_item_limit ?? 0);

        if ($productLimit <= 0) {
            return null;
        }

        $productCount = Product::withoutGlobalScopes()
            ->where('company_id', $authUser->company_id)
            ->whereNull('deleted_at')
            ->count();

        if ($productCount < $productLimit) {
            return null;
        }

        return [
            'status' => 0,
            'message' => "Your plan allows up to {$productLimit} inventory items. Please upgrade your plan to add another product.",
            'errors' => ["Product limit of {$productLimit} reached."],
        ];
    }
}
