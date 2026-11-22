<?php

namespace App\Services\Api;

use App\Data\FeaturePreference;
use App\Enums\SalesChannel as SalesChannelEnum;
use App\Models\SalesChannel as InventorySalesChannel;
use App\Models\Category;
use App\Models\Inventory;
use App\Models\InventoryHistory;
use App\Models\InventoryItem;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\PaymentSchedule;
use App\Models\PosSetting;
use App\Models\Product;
use App\Models\ProductBarcode;
use App\Models\ProductCombination;
use App\Models\ProductStockGroup;
use App\Models\Purchase;
use App\Models\PurchaseInvoice;
use App\Models\PurchaseProduct;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Services\ImageService;
use App\Services\CustomerWaitlistService;
use App\Services\ProductBundleService;
use App\Services\StockMovementService;
use App\Data\StockGuardConfig;
use App\Enums\StockAdjustmentReason;
use App\Enums\StockAdjustmentStatus;
use App\Enums\StockGuardFlag;
use App\Models\StockAdjustmentRequest;
use App\Models\Company;
use App\Helpers\Helper;
use App\Utils\PermissionUtils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use PHPUnit\Framework\MockObject\Stub\ReturnReference;

class PurchaseControllerService
{
    public function __construct(
        private readonly ProductBundleService $productBundleService,
        private readonly CustomerWaitlistService $customerWaitlistService,
        private readonly StockMovementService $stockMovementService
    )
    {
    }

    private function buildPaymentStatus(float $paidAmount, float $totalAmount): int
    {
        if ($totalAmount <= 0) {
            return 1;
        }

        if ($paidAmount <= 0) {
            return 0;
        }

        if ($paidAmount >= $totalAmount) {
            return 1;
        }

        return 2;
    }

    private function normalizeSalesChannelAllocations(array $channels): array
    {
        $allowedCodes = collect(SalesChannelEnum::cases())
            ->map(fn (SalesChannelEnum $channel) => $channel->value)
            ->all();

        return collect($channels)
            ->map(function ($value, $key) {
                if (is_array($value)) {
                    return [
                        'channel_code' => $value['channel_code'] ?? $value['code'] ?? $key,
                        'quantity' => (float) ($value['quantity'] ?? 0),
                    ];
                }

                return [
                    'channel_code' => $key,
                    'quantity' => (float) $value,
                ];
            })
            ->filter(fn ($row) => in_array($row['channel_code'], $allowedCodes, true) && $row['quantity'] > 0)
            ->groupBy('channel_code')
            ->map(fn ($rows, $code) => [
                'channel_code' => $code,
                'quantity' => $rows->sum('quantity'),
            ])
            ->values()
            ->all();
    }

    public function salesChannels()
    {
        return response()->json([
            'status' => 1,
            'message' => 'Sales channels fetched successfully',
            'data' => SalesChannelEnum::options(),
        ]);
    }

    public function list(Request $request)
    {
        $perPage   = $request->input('perPage', 20);
        $page      = $request->input('page', 1);
        $search    = $request->input('search', '');
        $warehouse = $request->input('warehouse', '');
        $supplier  = $request->input('supplier', '');
        $status    = $request->input('status', '');
        $category  = $request->input('category');
        $brand     = $request->input('brand');
        $sortField = $request->input('sortField', 'created_at');
        $sortOrder = $request->input('sortOrder', 'desc');

        // ==============================================================
        // 1. BASE QUERY (for both grand total & pagination)
        // ==============================================================
        $baseQuery = InventoryItem::query()
            ->with([
                'product.category',
                'product.brand',
                'warehouse',
                'invoice',
                'invoice.user',
                'barcodes'
            ])
            ->where('quantity', '>', 0);

        // ==============================================================
        // 2. APPLY FILTERS
        // ==============================================================
        if (!empty($search)) {
            $baseQuery->where(function ($q) use ($search) {
                $q->whereHas('inventory.product', fn($pq) => $pq->where('name', 'LIKE', "%{$search}%"))
                ->orWhere('lot_number', 'LIKE', "%{$search}%")
                ->orWhereHas('barcodes', fn($bq) => $bq->where('barcode', 'LIKE', "%{$search}%"));
            });
        }

        if (!empty($warehouse)) {
            $baseQuery->where('warehouse_id', $warehouse);
        }

        if (!empty($category)) {
            $categoryIds = [$category];
            $queue = [$category];
            while ($queue) {
                $current = array_shift($queue);
                $children = Category::where('ancestor_id', $current)->pluck('id')->toArray();
                $categoryIds = array_merge($categoryIds, $children);
                $queue = array_merge($queue, $children);
            }
            $baseQuery->whereHas('product', fn($q) => $q->whereIn('category_id', $categoryIds));
        }

        if (!empty($brand)) {
            $baseQuery->whereHas('product.brand', fn($q) => $q->where('id', $brand));
        }

        if (!empty($supplier)) {
            $baseQuery->whereHas('invoice.supplier', fn($q) => $q->where('id', $supplier));
        }

        if (!empty($status)) {
            $baseQuery->where('status', $status);
        }

        if ($request->filled('variant')) {
            $variant = $request->input('variant');
            if (is_string($variant)) {
                $variant = json_decode($variant, true) ?: [];
            }
            if (is_array($variant) && !empty($variant)) {
                foreach ($variant as $key => $value) {
                    $baseQuery->whereJsonContains("variant_id->{$key}", $value); 
                }
            }
        }

        // ==============================================================
        // 3. FETCH ALL FILTERED ITEMS (for grand total)
        // ==============================================================
        $allItems = (clone $baseQuery)->select(['id', 'quantity', 'purchase_price'])->get();

        $grand_total_qty = $allItems->sum('quantity');
        $grand_total_purchase_price = $allItems->sum(fn($i) => ($i->purchase_price ?? 0) * $i->quantity);

        // ==============================================================
        // 4. APPLY SORTING & PAGINATION
        // ==============================================================
        $validSortFields = ['created_at', 'quantity', 'price', 'purchase_price', 'lot_number', 'expiry_date'];
        $sortField = in_array($sortField, $validSortFields) ? $sortField : 'created_at';
        $baseQuery->orderBy($sortField, $sortOrder);

        $items = $baseQuery->paginate($perPage, ['*'], 'page', $page);

        // ==============================================================
        // 5. TRANSFORM RESPONSE
        // ==============================================================
        $data = $items->getCollection()->map(function ($item) {
            $product = $item->product;

            return [
                'id'              => $item->id,
                'inventory_id'    => $item->inventory_id,
                'product'         => $product?->name ?? 'N/A',
                'warehouse'       => $item->warehouse?->name ?? 'N/A',
                'batch_no'        => $item->lot_number ?? '',
                'created_at'      => $item->created_at->toIso8601String(),
                'variant'         => $item->formatVariant($item->variant_id),
                'total_qty'       => (float) $item->quantity,
                'selling_price'   => (float) $item->price,
                'purchase_price'  => (float) $item->purchase_price,
                'category'        => $product?->category?->title ?? 'N/A',
                'brand'           => $product?->brand?->title ?? 'N/A',
                'barcode'         => $item->barcodes->first()?->barcode ?? $product?->code ?? '',
                'expiry_date'     => $item->expiry_date,
                'alert_quantity'  => (float) ($item->alert_quantity ?? 5),
                'product_info'    => [
                    'id'        => $product?->id,
                    'name'      => $product?->name,
                    'sku'       => $product?->sku,
                    'barcode'   => $product?->code,
                    'thumbnail' => $product?->thumbnail,
                ],
                'invoice'         => $item->invoice,
                'user'            => $item->invoice?->user,
            ];
        });

        // Replace collection
        $items->setCollection($data);

        return response()->json([
            'status'  => 1,
            'message' => 'Stock list fetched successfully',
            'data'    => $data->toArray(),
            'meta'    => [
                'current_page' => $items->currentPage(),
                'per_page'     => $items->perPage(),
                'total'        => $items->total(),
                'last_page'    => $items->lastPage(),
            ],
            'others_data' => [
                'grand_total_qty'            => $grand_total_qty,
                'grand_total_purchase_price' => $grand_total_purchase_price,
            ],
        ], 200);
    }

    public function stockInList(Request $request) 
    {  
        $currentUserId = Auth::id();
        $perPage = $request->input('perPage', 20); 
        $page = $request->input('page', 1); 
        $search = $request->input('search', ''); 
        $warehouse = $request->input('warehouse', ''); 
        $supplier = $request->input('supplier', ''); 
        $status = $request->input('status', ''); 
        $category = $request->input('category'); 
        $brand = $request->input('brand'); 
        $sortField = $request->input('sortField', 'created_at'); 
        $sortOrder = $request->input('sortOrder', 'desc'); 
        // ============================================================== // 1. BASE QUERY – Eager load inventoryItem 
        // ============================================================== 
        $baseQuery = InvoiceItem::query() 
            ->with([ 
                'product.category', 
                'product.brand', 
                'warehouse', 
                'invoice.supplier', 
                'invoice.user', 
                'barcodes', 
                'inventory_item' // ← This brings price, purchase_price, etc. 
            ]); 
        $baseQuery->where('type', 'purchase'); 
        $baseQuery->where('user_id', $currentUserId);
        // ============================================================== // 2. FILTERS 
        // ============================================================== 
        if ($search !== '') { 
            $baseQuery->where(function ($q) use ($search) { 
                $q->whereHas('product', fn($pq) => $pq->where('name', 'LIKE', "%{$search}%")) 
                    ->orWhere('lot_number', 'LIKE', "%{$search}%") 
                    ->orWhereHas('barcodes', fn($bq) => $bq->where('barcode', 'LIKE', "%{$search}%")); 
                }); 
            } 
        

        if ($warehouse !== null) { 
            $baseQuery->where('warehouse_id', $warehouse); 
        } 

        if ($category !== null) { 
            $categoryIds = [$category]; 
            $queue = [$category]; 
            while ($queue) { 
                $current = array_shift($queue); 
                $children = Category::where('ancestor_id', $current)->pluck('id')->toArray(); 
                    $categoryIds = array_merge($categoryIds, $children); $queue = array_merge($queue, $children); 
                } 
                $baseQuery->whereHas('product', fn($q) => $q->whereIn('category_id', $categoryIds)); 
        } 
        
        if ($brand !== null) { 
            $baseQuery->whereHas('product.brand', fn($q) => $q->where('id', $brand)); 
        } 
        if ($supplier !== null) { 
            $baseQuery->whereHas('invoice.supplier', fn($q) => $q->where('id', $supplier)); 
        } 
        if ($status !== null) { 
            $baseQuery->where('status', $status); 
        } 
        if ($request->filled('variant')) { 
            $variant = $request->input('variant'); 
            if (is_string($variant)) 
                $variant = json_decode($variant, true) ?: []; 
            if (is_array($variant) && !empty($variant)) { 
                foreach ($variant as $key => $value) { 
                    $baseQuery->whereJsonContains("variant_id->{$key}", $value);
                } 
            } 
        }         
        // ============================================================== // 3. GRAND TOTALS 
        // ============================================================== 
        $allItems = (clone $baseQuery)->get(); 
        $grand_total_qty = $allItems->sum('qty'); 
        $grand_total_purchase_price = $allItems->sum(fn($i) => (
            $i->inventory_item?->purchase_price ?? $i->purchase_price ?? 0) * $i->qty 
        );
        // ============================================================== // 4. SORTING + PAGINATION 
        // ============================================================== 
        $validSortFields = ['created_at', 'qty', 'lot_number', 'expiry_date']; 
        $sortField = in_array($sortField, $validSortFields) ? $sortField : 'created_at'; 
        $baseQuery->orderBy($sortField, $sortOrder); 
        $items = $baseQuery->paginate($perPage, ['*'], 'page', $page); 
        // ============================================================== // 5. TRANSFORM RESPONSE 
        // ============================================================== 
        $data = $items->getCollection()->map(function ($item) { 
            $product = $item->product; 
            $invItem = $item->inventory_item; 
            $returnedQty = (float) InvoiceItem::query()
                ->where('type', 'return')
                ->where('original_sale_item_id', $item->id)
                ->sum('qty');
            $purchasedQty = (float) $item->qty;
            $remainingReturnQty = max(0, $purchasedQty - $returnedQty);

            return [ 
                    'id' => $item->id, 
                    'type' => $item->type,
                    'inventory_id' => $item->inventory_id, 
                    'product' => $product?->name ?? 'N/A', 
                    'warehouse' => $item->warehouse?->name ?? 'N/A', 
                    'batch_no' => $item->lot_number ?? $invItem?->lot_number ?? '', 
                    'created_at' => $item->created_at->toIso8601String(), 
                    'variant' => Helper::formatVariant($item->variant_id), 
                    'total_qty' => (float) $item->qty, 
                    'returned_qty' => $returnedQty,
                    'remaining_return_qty' => $remainingReturnQty,
                    'selling_price' => (float) ($invItem?->price ?? 0), 
                    'purchase_price' => (float) ($item->unit_price ?? 0), 
                    'discount' => (float) ($item->discount ?? 0),
                    'tax' => (float) ($item->tax ?? 0),
                    'vat' => (float) ($item->vat ?? 0),
                    'category' => $product?->category?->title ?? 'N/A', 
                    'brand' => $product?->brand?->title ?? 'N/A', 
                    'barcode' => $item->barcodes->first()?->barcode ?? $product?->code ?? '', 
                    'expiry_date' => $item->expiry_date ?? $invItem?->expiry_date, 
                    'alert_quantity' => (float) ($item->alert_quantity ?? 5), 
                    'product_info' => [ 
                        'id' => $product?->id, 
                        'name' => $product?->name, 
                        'sku' => $product?->sku, 
                        'barcode' => $product?->code, 
                        'thumbnail' => $product?->thumbnail, 
                    ], 
                    'invoice' => $item->invoice, 
                    'user' => $item->invoice?->user, 
                    'supplier' => $item->invoice?->supplier, 
                    'invItem' => $invItem,
                ]; 
        }); 
        $items->setCollection($data); 
        // ============================================================== // 6. FINAL RESPONSE 
        // ============================================================== 
        return response()->json([ 
            'status' => 1, 
            'message' => 'Invoice items history fetched successfully', 
            'data' => $data->toArray(), 
            'meta' => [ 
                'current_page' => $items->currentPage(), 
                'per_page' => $items->perPage(), 
                'total' => $items->total(), 
                'last_page' => $items->lastPage(), 
            ], 
            'others_data' => [ 
                'grand_total_qty' => $grand_total_qty, 
                'grand_total_purchase_price' => $grand_total_purchase_price, 
            ], 
        ], 200); 
    }

    public function purchaseReturnList(Request $request)
    {
        $currentUserId = Auth::id();
        $perPage = $request->input('perPage', 20);
        $page = $request->input('page', 1);
        $search = $request->input('search', '');
        $supplier = $request->input('supplier', '');
        $sortField = $request->input('sortField', 'created_at');
        $sortOrder = $request->input('sortOrder', 'desc');

        $query = Invoice::query()
            ->with([
                'supplier:id,name,phone_number,email',
                'originalInvoice.supplier:id,name,phone_number,email',
                'originalInvoice.user:id,first_name,last_name',
                'user:id,first_name,last_name',
                'items.product:id,name,code',
                'transactions:id,invoice_id,amount,payment_method,transaction_date,created_at',
            ])
            ->where('type', 'return')
            ->where(function ($q) use ($currentUserId) {
                $q->where('user_id', $currentUserId)
                    ->orWhereHas('originalInvoice', fn($oq) => $oq->where('user_id', $currentUserId));
            });

        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('invoice_no', 'LIKE', "%{$search}%")
                    ->orWhere('referance_value', 'LIKE', "%{$search}%")
                    ->orWhereHas('supplier', fn($sq) => $sq->where('name', 'LIKE', "%{$search}%"))
                    ->orWhereHas('originalInvoice.supplier', fn($sq) => $sq->where('name', 'LIKE', "%{$search}%"))
                    ->orWhereHas('items.product', fn($pq) => $pq->where('name', 'LIKE', "%{$search}%"));
            });
        }

        if (!empty($supplier)) {
            $query->where(function ($q) use ($supplier) {
                $q->where('supplier_id', $supplier)
                    ->orWhereHas('originalInvoice', fn($oq) => $oq->where('supplier_id', $supplier));
            });
        }

        $validSortFields = ['created_at', 'date', 'invoice_no', 'qty', 'total', 'paid_amount', 'due_amount'];
        $sortField = in_array($sortField, $validSortFields, true) ? $sortField : 'created_at';
        $sortOrder = $sortOrder === 'asc' ? 'asc' : 'desc';

        $query->orderBy($sortField, $sortOrder);

        $returns = $query->paginate($perPage, ['*'], 'page', $page);

        $data = $returns->getCollection()->map(function ($invoice) {
            $resolvedSupplier = $invoice->supplier ?: $invoice->originalInvoice?->supplier;
            $transactions = $invoice->transactions
                ->map(function ($transaction) {
                    return [
                        'id' => $transaction->id,
                        'amount' => (float) ($transaction->amount ?? 0),
                        'payment_method' => $transaction->payment_method,
                        'transaction_date' => $transaction->transaction_date,
                        'created_at' => optional($transaction->created_at)?->toIso8601String(),
                    ];
                })
                ->values();

            $cashRefundAmount = (float) $transactions->sum('amount');
            $dueAdjustmentAmount = max(0, (float) ($invoice->paid_amount ?? 0) - $cashRefundAmount);

            $items = $invoice->items->map(function ($item) {
                return [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product?->name ?? 'N/A',
                    'product_code' => $item->product?->code ?? '',
                    'lot_number' => $item->lot_number,
                    'qty' => abs((float) $item->qty),
                    'unit_price' => (float) $item->unit_price,
                    'discount' => (float) ($item->discount ?? 0),
                    'tax' => (float) ($item->tax ?? 0),
                    'vat' => (float) ($item->vat ?? 0),
                    'total' => abs((float) $item->total),
                ];
            })->values();

            return [
                'id' => $invoice->id,
                'invoice_no' => $invoice->invoice_no,
                'date' => $invoice->date,
                'qty' => abs((float) $invoice->qty),
                'sub_total' => (float) ($invoice->sub_total ?? 0),
                'discount' => (float) ($invoice->discount ?? 0),
                'tax' => (float) ($invoice->tax ?? 0),
                'vat' => (float) ($invoice->vat ?? 0),
                'total' => (float) ($invoice->total ?? 0),
                'paid_amount' => (float) ($invoice->paid_amount ?? 0),
                'due_amount' => (float) ($invoice->due_amount ?? 0),
                'payment_status' => (int) ($invoice->payment_status ?? 0),
                'payment_method' => $invoice->payment_method,
                'note' => $invoice->note,
                'cash_refund_amount' => $cashRefundAmount,
                'due_adjustment_amount' => $dueAdjustmentAmount,
                'reference_invoice_no' => $invoice->referance_value,
                'original_invoice_id' => $invoice->original_invoice_id,
                'transactions' => $transactions,
                'supplier' => [
                    'id' => $resolvedSupplier?->id,
                    'name' => $resolvedSupplier?->name ?? 'N/A',
                    'phone' => $resolvedSupplier?->phone_number,
                    'email' => $resolvedSupplier?->email,
                ],
                'user' => [
                    'id' => $invoice->user?->id,
                    'name' => trim(($invoice->user?->first_name ?? '') . ' ' . ($invoice->user?->last_name ?? '')),
                ],
                'items' => $items,
            ];
        });

        $returns->setCollection($data);

        return response()->json([
            'status' => 1,
            'message' => 'Purchase return list fetched successfully',
            'data' => $returns->items(),
            'meta' => [
                'current_page' => $returns->currentPage(),
                'per_page' => $returns->perPage(),
                'total' => $returns->total(),
                'last_page' => $returns->lastPage(),
            ],
        ], 200);
    }

    public function storePurchaseReturn(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'original_invoice_id' => 'required|exists:invoices,id',
            'return_date' => 'required|date',
            'note' => 'nullable|string',
            'refund_amount' => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|string|max:255',
            'items' => 'required|array|min:1',
            'items.*.original_purchase_item_id' => 'required|exists:invoice_items,id',
            'items.*.return_qty' => 'required|numeric|min:0.01',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        DB::beginTransaction();

        try {
            $originalInvoice = Invoice::with(['supplier'])->findOrFail($request->original_invoice_id);

            if ($originalInvoice->type !== 'purchase') {
                throw new \Exception('Only purchase invoices can be returned.');
            }

            if ((string) $originalInvoice->user_id !== (string) Auth::id()) {
                throw new \Exception('You can only return products from purchases you created.');
            }

            $refundAmount = (float) ($request->refund_amount ?? 0);
            $totalQty = 0;
            $subTotal = 0;
            $totalDiscount = 0;
            $totalTax = 0;
            $totalVat = 0;

            $returnInvoice = new Invoice();
            $returnInvoice->type = 'return';
            $returnInvoice->company_id = $originalInvoice->company_id;
            $returnInvoice->warehouse_id = $originalInvoice->warehouse_id;
            $returnInvoice->user_id = Auth::id();
            $returnInvoice->supplier_id = $originalInvoice->supplier_id;
            $returnInvoice->date = $request->return_date;
            $returnInvoice->original_invoice_id = $originalInvoice->id;
            $returnInvoice->referance_value = $originalInvoice->invoice_no;
            $returnInvoice->note = $request->note;
            $returnInvoice->payment_method = $request->payment_method;
            $returnInvoice->save();

            foreach ($request->items as $returnItem) {
                $originalItem = InvoiceItem::with(['inventory_item', 'product'])
                    ->findOrFail($returnItem['original_purchase_item_id']);

                if ($originalItem->invoice_id !== $originalInvoice->id) {
                    throw new \Exception('Selected item does not belong to the original purchase invoice.');
                }

                if ($originalItem->type !== 'purchase') {
                    throw new \Exception('Only purchase invoice items can be returned.');
                }

                if ((string) $originalItem->user_id !== (string) Auth::id()) {
                    throw new \Exception('You can only return products from purchases you created.');
                }

                $stockItem = $originalItem->inventory_item;
                if (!$stockItem && $originalItem->inventory_id) {
                    $stockItem = InventoryItem::query()
                        ->where('inventory_id', $originalItem->inventory_id)
                        ->where('invoice_item_id', $originalItem->id)
                        ->latest('id')
                        ->first();
                }

                if (!$stockItem) {
                    throw new \Exception("Stock record not found for product {$originalItem->product?->name}.");
                }

                $inventory = Inventory::find($stockItem->inventory_id);
                if (!$inventory) {
                    throw new \Exception("Inventory bucket not found for product {$originalItem->product?->name}.");
                }

                $returnQty = (float) $returnItem['return_qty'];
                $availableQty = (float) $stockItem->quantity;
                $alreadyReturnedQty = (float) InvoiceItem::query()
                    ->where('type', 'return')
                    ->where('original_sale_item_id', $originalItem->id)
                    ->sum('qty');
                $remainingReturnQty = max(0, (float) $originalItem->qty - $alreadyReturnedQty);

                if ($returnQty > $availableQty) {
                    throw new \Exception("Return quantity exceeds available stock for {$originalItem->product?->name}. Available: {$availableQty}");
                }

                if ($returnQty > $remainingReturnQty) {
                    throw new \Exception("Return quantity exceeds purchased quantity for {$originalItem->product?->name}. Remaining returnable: {$remainingReturnQty}");
                }

                $originalQty = max((float) $originalItem->qty, 0.0001);
                $lineBase = (float) $originalItem->unit_price * $returnQty;
                $lineDiscount = ((float) ($originalItem->discount ?? 0) / $originalQty) * $returnQty;
                $lineTax = ((float) ($originalItem->tax ?? 0) / $originalQty) * $returnQty;
                $lineVat = ((float) ($originalItem->vat ?? 0) / $originalQty) * $returnQty;
                $lineTotal = max(0, $lineBase - $lineDiscount + $lineTax + $lineVat);

                $invoiceItem = new InvoiceItem();
                $invoiceItem->invoice_id = $returnInvoice->id;
                $invoiceItem->type = 'return';
                $invoiceItem->date = $request->return_date;
                $invoiceItem->company_id = $originalInvoice->company_id;
                $invoiceItem->warehouse_id = $originalInvoice->warehouse_id;
                $invoiceItem->user_id = Auth::id();
                $invoiceItem->inventory_id = $inventory->id;
                $invoiceItem->lot_number = $stockItem->lot_number;
                $invoiceItem->product_id = $originalItem->product_id;
                $invoiceItem->variant_id = $originalItem->variant_id;
                $invoiceItem->qty = $returnQty;
                $invoiceItem->unit_price = $originalItem->unit_price;
                $invoiceItem->discount = $lineDiscount;
                $invoiceItem->vat_rate = $originalItem->vat_rate ?? 0;
                $invoiceItem->vat = $lineVat;
                $invoiceItem->total = $lineTotal;
                $invoiceItem->original_sale_item_id = $originalItem->id;
                $invoiceItem->is_returned = true;
                $invoiceItem->save();

                $inventoryBefore = (float) $inventory->quantity;
                $stockItem->quantity = max(0, (float) $stockItem->quantity - $returnQty);
                $stockItem->save();

                $inventory->quantity = max(0, (float) $inventory->quantity - $returnQty);
                $inventory->save();

                $this->stockMovementService->record([
                    'company_id' => $originalInvoice->company_id,
                    'product_id' => $originalItem->product_id,
                    'inventory_id' => $inventory->id,
                    'inventory_item_id' => $stockItem->id,
                    'warehouse_id' => $originalInvoice->warehouse_id,
                    'type' => StockMovementService::TYPE_PURCHASE_RETURNED,
                    'quantity_change' => -1 * $returnQty,
                    'quantity_before' => $inventoryBefore,
                    'quantity_after' => (float) $inventory->quantity,
                    'reference_type' => StockMovementService::REF_PURCHASE_RETURN,
                    'reference_id' => $returnInvoice->id,
                    'note' => 'Purchase return',
                ]);

                InventoryHistory::create([
                    'type' => 'return',
                    'company_id' => $originalInvoice->company_id,
                    'invoice_id' => $returnInvoice->id,
                    'lot_number' => $stockItem->lot_number,
                    'inventory_id' => $inventory->id,
                    'product_id' => $originalItem->product_id,
                    'inventory_item_id' => $stockItem->id,
                    'barcode' => $stockItem->barcode,
                    'variant' => Helper::formatVariant($originalItem->variant_id),
                    'unit_price' => $originalItem->unit_price,
                    'original_unit_price' => $stockItem->purchase_price,
                    'quantity' => -1 * $returnQty,
                    'discount' => $originalItem->discount ?? 0,
                    'discount_amount' => $lineDiscount,
                    'total' => -1 * $lineTotal,
                    'is_returned' => true,
                    'original_sale_item_id' => $originalItem->id,
                    'created_by' => Auth::id(),
                ]);

                $returnedQty = InvoiceItem::query()
                    ->where('type', 'return')
                    ->where('original_sale_item_id', $originalItem->id)
                    ->sum('qty');

                if ($returnedQty >= (float) $originalItem->qty) {
                    $originalItem->is_returned = true;
                    $originalItem->save();
                }

                $totalQty += $returnQty;
                $subTotal += $lineBase;
                $totalDiscount += $lineDiscount;
                $totalTax += $lineTax;
                $totalVat += $lineVat;
            }

            $grandTotal = max(0, $subTotal - $totalDiscount + $totalTax + $totalVat);

            $originalDueAmount = max(0, (float) ($originalInvoice->due_amount ?? 0));
            $dueAdjustmentAmount = min($grandTotal, $originalDueAmount);
            $maxCashRefundAmount = max(0, $grandTotal - $dueAdjustmentAmount);
            $cashRefundAmount = min($refundAmount, $maxCashRefundAmount);
            $settledAmount = $dueAdjustmentAmount + $cashRefundAmount;

            $returnInvoice->qty = $totalQty;
            $returnInvoice->discount = $totalDiscount;
            $returnInvoice->vat_rate = 0;
            $returnInvoice->vat = $totalVat;
            $returnInvoice->sub_total = $subTotal;
            $returnInvoice->total = $grandTotal;
            $returnInvoice->paid_amount = $settledAmount;
            $returnInvoice->due_amount = max(0, $grandTotal - $settledAmount);
            $returnInvoice->payment_status = $this->buildPaymentStatus($settledAmount, $grandTotal);
            $returnInvoice->save();

            if ($cashRefundAmount > 0) {
                $transaction = new Transaction();
                $transaction->invoice_id = $returnInvoice->id;
                $transaction->user_id = Auth::id();
                $transaction->amount = $cashRefundAmount;
                $transaction->payment_method = $request->payment_method ?: 'Adjustment';
                $transaction->transaction_date = $request->return_date;
                $transaction->save();
            }

            $updatedReturnAmount = ((float) ($originalInvoice->return_amount ?? 0)) + $grandTotal;
            $effectivePurchaseTotal = max(0, (float) ($originalInvoice->total ?? 0) - $updatedReturnAmount);

            $originalInvoice->return_amount = $updatedReturnAmount;
            $originalInvoice->due_amount = max(0, $effectivePurchaseTotal - (float) ($originalInvoice->paid_amount ?? 0));
            $originalInvoice->payment_status = $this->buildPaymentStatus(
                (float) ($originalInvoice->paid_amount ?? 0),
                $effectivePurchaseTotal
            );
            $originalInvoice->save();

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Purchase return created successfully',
                'data' => [
                    'id' => $returnInvoice->id,
                    'invoice_no' => $returnInvoice->invoice_no,
                    'total' => $returnInvoice->total,
                    'paid_amount' => $returnInvoice->paid_amount,
                    'due_amount' => $returnInvoice->due_amount,
                ],
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'status' => 0,
                'message' => 'Failed to create purchase return',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function addPurchaseReturnPayment(Request $request, string $id)
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|string|max:255',
            'transaction_date' => 'required|date',
            'note' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        DB::beginTransaction();

        try {
            $invoice = Invoice::with([
                'supplier:id,name,phone_number,email',
                'user:id,first_name,last_name',
                'items.product:id,name,code',
                'transactions:id,invoice_id,amount,payment_method,transaction_date,created_at',
            ])->findOrFail($id);

            if ($invoice->type !== 'return') {
                throw new \Exception('Payments can only be added to purchase return invoices.');
            }

            if ((string) $invoice->user_id !== (string) Auth::id()) {
                throw new \Exception('You can only add payment logs to purchase returns you created.');
            }

            $currentDue = max(0, (float) ($invoice->due_amount ?? 0));
            $paymentAmount = (float) $request->amount;

            if ($paymentAmount > $currentDue) {
                throw new \Exception("Payment amount cannot exceed remaining due of {$currentDue}.");
            }

            $transaction = new Transaction();
            $transaction->invoice_id = $invoice->id;
            $transaction->user_id = Auth::id();
            $transaction->amount = $paymentAmount;
            $transaction->payment_method = $request->payment_method;
            $transaction->transaction_date = $request->transaction_date;
            $transaction->save();

            $invoice->paid_amount = (float) ($invoice->paid_amount ?? 0) + $paymentAmount;
            $invoice->due_amount = max(0, (float) ($invoice->total ?? 0) - (float) $invoice->paid_amount);
            $invoice->payment_status = $this->buildPaymentStatus((float) $invoice->paid_amount, (float) ($invoice->total ?? 0));

            if (!empty($request->note)) {
                $invoice->note = trim((string) ($invoice->note ? ($invoice->note . "\n") : '') . $request->note);
            }

            $invoice->save();
            $invoice->load([
                'supplier:id,name,phone_number,email',
                'user:id,first_name,last_name',
                'items.product:id,name,code',
                'transactions:id,invoice_id,amount,payment_method,transaction_date,created_at',
            ]);

            $transactions = $invoice->transactions
                ->map(function ($payment) {
                    return [
                        'id' => $payment->id,
                        'amount' => (float) ($payment->amount ?? 0),
                        'payment_method' => $payment->payment_method,
                        'transaction_date' => $payment->transaction_date,
                        'created_at' => optional($payment->created_at)?->toIso8601String(),
                    ];
                })
                ->values();

            $cashRefundAmount = (float) $transactions->sum('amount');
            $dueAdjustmentAmount = max(0, (float) ($invoice->paid_amount ?? 0) - $cashRefundAmount);

            $items = $invoice->items->map(function ($item) {
                return [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product?->name ?? 'N/A',
                    'product_code' => $item->product?->code ?? '',
                    'lot_number' => $item->lot_number,
                    'qty' => abs((float) $item->qty),
                    'unit_price' => (float) $item->unit_price,
                    'discount' => (float) ($item->discount ?? 0),
                    'tax' => (float) ($item->tax ?? 0),
                    'vat' => (float) ($item->vat ?? 0),
                    'total' => abs((float) $item->total),
                ];
            })->values();

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Purchase return payment added successfully',
                'data' => [
                    'id' => $invoice->id,
                    'invoice_no' => $invoice->invoice_no,
                    'date' => $invoice->date,
                    'qty' => abs((float) $invoice->qty),
                    'sub_total' => (float) ($invoice->sub_total ?? 0),
                    'discount' => (float) ($invoice->discount ?? 0),
                    'tax' => (float) ($invoice->tax ?? 0),
                    'vat' => (float) ($invoice->vat ?? 0),
                    'total' => (float) ($invoice->total ?? 0),
                    'paid_amount' => (float) ($invoice->paid_amount ?? 0),
                    'due_amount' => (float) ($invoice->due_amount ?? 0),
                    'payment_status' => (int) ($invoice->payment_status ?? 0),
                    'payment_method' => $invoice->payment_method,
                    'note' => $invoice->note,
                    'cash_refund_amount' => $cashRefundAmount,
                    'due_adjustment_amount' => $dueAdjustmentAmount,
                    'reference_invoice_no' => $invoice->referance_value,
                    'original_invoice_id' => $invoice->original_invoice_id,
                    'transactions' => $transactions,
                    'supplier' => [
                        'id' => $invoice->supplier?->id,
                        'name' => $invoice->supplier?->name ?? 'N/A',
                        'phone' => $invoice->supplier?->phone_number,
                        'email' => $invoice->supplier?->email,
                    ],
                    'user' => [
                        'id' => $invoice->user?->id,
                        'name' => trim(($invoice->user?->first_name ?? '') . ' ' . ($invoice->user?->last_name ?? '')),
                    ],
                    'items' => $items,
                ],
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'status' => 0,
                'message' => 'Failed to add purchase return payment',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function stockOverview(Request $request)
    {
        $perPage   = $request->input('perPage', 20);
        $page      = $request->input('page', 1);
        $search    = $request->input('search', '');
        $warehouse = $request->input('warehouse', '');
        $category  = $request->input('category');
        $brand     = $request->input('brand');
        $supplier  = $request->input('supplier');
        $demandTag = $request->input('demand_tag');
        $sortField = $request->input('sortField', 'created_at');
        $sortOrder = $request->input('sortOrder', 'desc');

        // Base query
        $baseQuery = Inventory::query()
            ->with([
                'product.category',
                'product.brand',
                'warehouse',
                'inventory_items' => fn($q) => $q
                    ->select(['id', 'inventory_id', 'variant_id', 'quantity', 'price', 'purchase_price', 'lot_number'])
                    ->where('quantity', '>', 0)
            ])
            ->whereHas('inventory_items', fn($q) => $q->where('quantity', '>', 0));

            // Filters
            if (!empty($search)) {
                $hasCodeColumn = Schema::hasColumn('product', 'code');
                $hasSkuColumn = Schema::hasColumn('product', 'sku');

                $baseQuery->whereHas('product', function ($pq) use ($search, $hasCodeColumn, $hasSkuColumn) {
                    $pq->where('name', 'LIKE', "%{$search}%");

                    if ($hasCodeColumn) {
                        $pq->orWhere('code', 'LIKE', "%{$search}%");
                    }

                    if ($hasSkuColumn) {
                        $pq->orWhere('sku', 'LIKE', "%{$search}%");
                    }
                });
            }

            if (!empty($category)) {
                $categoryIds = [$category];
                $queue = [$category];
                while ($queue) {
                    $current = array_shift($queue);
                    $children = Category::where('ancestor_id', $current)->pluck('id')->toArray();
                    $categoryIds = array_merge($categoryIds, $children);
                    $queue = array_merge($queue, $children);
                }
                $baseQuery->whereHas('product', fn($q) => $q->whereIn('category_id', $categoryIds));
            }

            if (!empty($brand)) {
                $baseQuery->whereHas('product.brand', fn($q) => $q->where('id', $brand));
            }

            if (!empty($demandTag)) {
                $baseQuery->whereHas('product', fn($q) => $q->whereJsonContains('demand_tags', $demandTag));
            }

            if (!empty($supplier)) {
                $baseQuery->whereHas('purchase.supplier', fn($q) => $q->where('id', $supplier));
            }

            if (!empty($warehouse)) {
                $baseQuery->where('warehouse_id', $warehouse);
            }

            $allInventories = $baseQuery->get();

            $grand_total_qty = 0;
            $grand_total_purchase_price = 0;

            $finalData = collect();

            foreach ($allInventories as $inventory) {
            $items = $inventory->inventory_items;

            if ($items->isEmpty()) {
                continue;
            }

            $total_qty = $items->sum('quantity');
            $latest_item = $items->sortByDesc('created_at')->first();

            $reservedBundleQuantity = $this->productBundleService->getReservedComponentQuantity($inventory->product_id);
            $adjustedTotalQty = max((float) $total_qty - $reservedBundleQuantity, 0);

            $grand_total_qty += $adjustedTotalQty;
            $grand_total_purchase_price += $items->sum(fn($i) => ($i->purchase_price ?? 0) * $i->quantity);

            // Collect all variants into one associative array
            $allVariants = [];
            foreach ($items as $item) {
                if (!empty($item->variant_id) && is_array($item->variant_id)) {
                    foreach ($item->variant_id as $key => $value) {
                        // ensure it's an array
                        if (!isset($allVariants[$key])) {
                            $allVariants[$key] = [];
                        }
                        // prevent duplicates
                        if (!in_array($value, $allVariants[$key])) {
                            $allVariants[$key][] = $value;
                        }
                    }
                }
            }

            $lots = $items->pluck('lot_number')->filter()->unique()->values()->toArray();

            $finalData->push([
                'id' => $inventory->id,
                'product_id' => $inventory->product_id,
                'product' => $inventory->product->name ?? 'N/A',
                'warehouse' => $inventory->warehouse->name ?? 'N/A',
                'variant' => Helper::formatVariantForInventory($allVariants),
                'total_qty' => (float) $adjustedTotalQty,
                'raw_total_qty' => (float) $total_qty,
                'reserved_bundle_quantity' => (float) $reservedBundleQuantity,
                'selling_price' => (float) ($latest_item->price ?? 0),
                'purchase_price' => (float) ($latest_item->purchase_price ?? 0),
                'lots' => $lots,
                'category' => $inventory->product->category?->title ?? 'N/A',
                'brand' => $inventory->product->brand?->title ?? 'N/A',
                'demand_tags' => $inventory->product->demand_tags ?? [],
                'product_info' => [
                    'id' => $inventory->product_id,
                    'name' => $inventory->product->name ?? null,
                    // 'sku' => $inventory->product->sku ?? null,
                    'barcode' => $inventory->product->code ?? null,
                    'thumbnail' => $inventory->product->thumbnail ?? null,
                    'demand_tags' => $inventory->product->demand_tags ?? [],
                ],
                'items' => $items,
            ]);
        }

        // Sorting
        $validSort = ['product', 'warehouse', 'variant', 'total_qty', 'selling_price', 'purchase_price', 'created_at'];
        $sortField = in_array($sortField, $validSort) ? $sortField : 'created_at';

        $finalData = $finalData->sortBy(function ($item) use ($sortField) {
            return match ($sortField) {
                'product' => $item['product'],
                'warehouse' => $item['warehouse'],
                'variant' => $item['variant'],
                'total_qty' => $item['total_qty'],
                'selling_price' => $item['selling_price'],
                'purchase_price' => $item['purchase_price'],
                default => $item['product_info']['name'] . $item['variant'],
            };
        }, SORT_REGULAR, $sortOrder === 'desc');

        $total = $finalData->count();
        $paginated = $finalData->slice(($page - 1) * $perPage, $perPage)->values();

        return response()->json([
            'status' => 1,
            'message' => 'Stock overview fetched successfully',
            'data' => $paginated->toArray(),
            'meta' => [
                'current_page' => (int) $page,
                'per_page' => (int) $perPage,
                'total' => $total,
                'last_page' => ceil($total / $perPage),
            ],
            'others_data' => [
                'grand_total_qty' => $grand_total_qty,
                'grand_total_purchase_price' => $grand_total_purchase_price,
            ],
        ], 200);
    }

    
    public function store(Request $request)
    {
        // 1) Base validation (top-level)

        // Decode and validate items
        $items = json_decode($request->input('items'), true);
        if (!is_array($items) || empty($items)) {
            return response()->json([
                'status' => 0,
                'message' => 'Validation failed.',
                'errors' => [
                    'items' => ['Items must be a non-empty array'],
                ],
            ], 422);
        }

        $baseValidator = Validator::make($request->all(), [
            'type' => 'required|in:purchase',
            'invoice_no' => 'nullable|string',
            'date' => 'required|date',
            'grandTotal' => 'required|numeric|min:0',
            'warehouse_id' => 'required|exists:warehouses,id',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'items' => 'required|json',
            'document' => 'nullable|file|mimes:jpg,jpeg,png,pdf,webp|max:5120',
            'note' => 'nullable|string',
        ]);

        if ($baseValidator->fails()) {
            return response()->json([
                'status' => 0,
                'message' => 'Validation failed.',
                'errors' => $baseValidator->errors()->toArray(),
            ], 422);
        }

        // 3) Decode and validate items array
        $items = json_decode($request->input('items'), true);
        if (!is_array($items) || empty($items)) {
            return response()->json([
                'status' => 0,
                'message' => 'Validation failed.',
                'errors' => [
                    'items' => ['Items must be a non-empty array'],
                ],
            ], 422);
        }

        $itemsValidator = Validator::make(['items' => $items], [
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|exists:product,id',
            'items.*.batch_no' => 'nullable|string',
            'items.*.quantity' => 'required|numeric|min:1|max:1000000',
            'items.*.purchase_price' => 'required|numeric|min:0',
            'items.*.selling_price' => 'required|numeric|min:0',
            'items.*.default_barcode' => 'required|string',
            'items.*.scan_each' => 'nullable|boolean',
            'items.*.barcodes' => 'nullable|array',
            'items.*.custom_barcodes' => 'nullable|array',
            'items.*.combination' => 'nullable|array',
            'items.*.segmentations' => 'nullable|array',
            'items.*.sales_channels' => 'nullable|array',
            'items.*.expiry_date' => 'nullable|date',
            'items.*.update_selling_price' => 'nullable|boolean',
        ], [
            'items.*.id.required' => 'Valid Product ID is required.',
            'items.*.id.exists' => 'Product not found.',
            'items.*.batch_no.required' => 'Lot Number is required.',
            'items.*.quantity.required' => 'Quantity is required.',
            'items.*.quantity.min' => 'Quantity must be a positive number.',
            'items.*.purchase_price.min' => 'Purchase price must be a non-negative number.',
            'items.*.selling_price.min' => 'Selling price must be a non-negative number.',
            'items.*.default_barcode.required' => 'Default barcode is required.',
        ]);

        // Extra per-item checks that depend on other fields (like matching counts)
        $itemsValidator->after(function ($validator) use ($items) {
            $allowedChannelCodes = collect(SalesChannelEnum::cases())
                ->map(fn (SalesChannelEnum $channel) => $channel->value)
                ->all();

            foreach ($items as $index => $item) {
                if (!empty($item['scan_each'])) {
                    $qty = (int) ($item['quantity'] ?? 0);
                    $barcodes = $item['barcodes'] ?? [];

                    if (!is_array($barcodes) || count($barcodes) !== $qty) {
                        $validator->errors()->add("items.$index.barcodes", 'Barcodes array must match the quantity when scan_each is enabled.');
                    }

                    $custom = $item['custom_barcodes'] ?? [];
                    if (!empty($custom) && is_array($custom) && count($custom) !== count($barcodes)) {
                        $validator->errors()->add("items.$index.custom_barcodes", 'Custom barcodes array must match the barcodes array length.');
                    }
                }

                if (!empty($item['sales_channels']) && is_array($item['sales_channels'])) {
                    $channelTotal = 0;

                    foreach ($item['sales_channels'] as $code => $channel) {
                        $channelCode = is_array($channel)
                            ? ($channel['channel_code'] ?? $channel['code'] ?? $code)
                            : $code;
                        $quantity = is_array($channel)
                            ? ($channel['quantity'] ?? 0)
                            : $channel;

                        if (!in_array($channelCode, $allowedChannelCodes, true)) {
                            $validator->errors()->add("items.$index.sales_channels", "Invalid sales channel code: {$channelCode}.");
                        }

                        if (!is_numeric($quantity) || (float) $quantity < 0) {
                            $validator->errors()->add("items.$index.sales_channels.$channelCode", 'Sales channel quantity must be zero or greater.');
                        }

                        $channelTotal += (float) $quantity;
                    }

                    if ($channelTotal > (float) ($item['quantity'] ?? 0)) {
                        $validator->errors()->add("items.$index.sales_channels", 'Sales channel quantities cannot exceed the stock quantity.');
                    }
                }
            }
        });

        if ($itemsValidator->fails()) {
            return response()->json([
                'status' => 0,
                'message' => 'Validation failed.',
                'errors' => $itemsValidator->errors()->toArray(),
            ], 422);
        }


        DB::beginTransaction();

        try {
            // Create Invoice
            $invoice = new Invoice();
            $invoice->type = 'purchase';
            $invoice->referance_value = $request->invoice_no ?? null;
            $invoice->warehouse_id = $request->warehouse_id;
            $invoice->user_id = Auth::id();
            $invoice->supplier_id = $request->supplier_id ?? null;
            $invoice->date = $request->invoice_date ?? now()->format('Y-m-d');
            $invoice->note = $request->note ?? null;
            if ($request->hasFile('document')) {
                $invoice->document = ImageService::upload($request->file('document'), 'purchase-documents', [
                    'extensions' => ['jpg', 'jpeg', 'png', 'pdf', 'webp'],
                    'mime_types' => ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'],
                    'max_kb' => 5120,
                    'field' => 'document',
                ]);
            }
            $invoice->save();

            // Save Products, Inventory, and InvoiceItems
            $invoiceQty = 0;
            $invoiceDiscount = 0;
            $invoiceTotal = 0;
            $invoiceVat = 0;
            $salesChannelEnabled = PermissionUtils::isFeatureAccessible(
                Auth::user()?->company_id,
                FeaturePreference::SALES_CHANNEL->value
            );

            foreach ($items as $product) {
                $item = Product::findOrFail($product['id']);

                // Save combination to product_combinations only if non-empty
                $variantId = null;

                // Normalize combination and segmentation as arrays
                $combination = !empty($product['combination']) && is_array($product['combination']) && count($product['combination']) > 0
                    ? $product['combination']
                    : null;

                $segmentations = !empty($product['segmentations']) && is_array($product['segmentations']) && count($product['segmentations']) > 0
                    ? $product['segmentations']
                    : null;

                if ($combination || $segmentations) {
                    // Convert to canonical JSON for uniqueness check
                    $combinationJson = $combination ? json_encode($combination, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null;
                    $segmentationsJson = $segmentations ? json_encode($segmentations, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null;

                    // Try to find by normalized JSON
                    $productCombination = ProductCombination::where('product_id', $product['id'])
                        ->where('combination', $combinationJson)
                        ->where('segmentations', $segmentationsJson)
                        ->first();

                    if (!$productCombination) {
                        $productCombination = ProductCombination::create([
                            'product_id' => $product['id'],
                            'combination' => $combination,
                            'segmentations' => $segmentations,
                        ]);
                    }

                    $variantId = $productCombination->id;
                }

                // Inventory Entry: Check for existing record with same product_id, lot_number, and variant_id
                $inventory = Inventory::firstOrNew([
                    'product_id' => $product['id'],
                    // 'lot_number' => $product['batch_no']
                    'warehouse_id' => $request->warehouse_id,
                ]);
                
                $inventory->alert_quantity = $product['alert_quantity'] ?? 5;
                $inventory->stock_out_mood = 'FIFO';

                // Handle new or existing inventory
                $updateSellingPrice = $product['update_selling_price'];
                
                $oldQuantity = $inventory->quantity ?? 0;
                $newQuantity = (float) $product['quantity'];
                $inventory->quantity = $oldQuantity + $newQuantity;
                $inventory->save();

                // InvoiceItem Entry
                $lineTotal = $product['quantity'] * $product['purchase_price'];
                $discount = 0;
                $netTotal = $lineTotal - $discount;

                $invoiceItem = new InvoiceItem();
                $invoiceItem->invoice_id = $invoice->id;
                $invoiceItem->inventory_id = $inventory->id;
                $invoiceItem->type = 'purchase';
                $invoiceItem->date = $request->invoice_date ?? now()->format('Y-m-d');
                $invoiceItem->warehouse_id = $request->warehouse_id;
                $invoiceItem->user_id = Auth::id();
                $invoiceItem->product_id = $product['id'];
                $invoiceItem->variant_id = $product['combination'] ?? null; // Store as {"color":"Purple"} or null
                $invoiceItem->qty = $product['quantity'];
                $invoiceItem->lot_number = $product['batch_no'];
                $invoiceItem->unit_price = $product['purchase_price'];
                $invoiceItem->discount = $discount;
                $invoiceItem->total = $netTotal;
                $invoiceItem->vat_rate = $product['vat'] ?? 0;
                $invoiceItem->vat = ($product['purchase_price'] * $product['vat']) / 100;
                $invoiceItem->save();

                $stockMovement = $this->stockMovementService->record([
                    'company_id' => Auth::user()?->company_id,
                    'product_id' => $product['id'],
                    'inventory_id' => $inventory->id,
                    'warehouse_id' => $request->warehouse_id,
                    'type' => StockMovementService::TYPE_ADDED,
                    'quantity_change' => $newQuantity,
                    'quantity_before' => (float) $oldQuantity,
                    'quantity_after' => (float) $inventory->quantity,
                    'reference_type' => StockMovementService::REF_INVOICE_ITEM,
                    'reference_id' => $invoiceItem->id,
                    'note' => 'Stock added from purchase',
                ]);

                // Update invoice totals
                $invoiceQty += $product['quantity'];
                $invoiceDiscount += $discount;
                $invoiceTotal += $netTotal;
                $invoiceVat += $invoiceItem->vat;

                // Save Inventory Item (blueprint/detail layer for cost tracking)
                $inventoryItem = new InventoryItem();
                $inventoryItem->product_id = $product['id'];
                $inventoryItem->lot_number = $product['batch_no'];
                $inventoryItem->warehouse_id = $request->warehouse_id;
                $inventoryItem->invoice_id = $invoice->id;
                $inventoryItem->invoice_item_id = $invoiceItem->id;
                $inventoryItem->inventory_id = $inventory->id;
                $inventoryItem->expiry_date = $product['expiry_date'] ?? null;
                $inventoryItem->variant_id = $product['combination'] ?? null; 
                $inventoryItem->segmentations = !empty($product['segmentations']) ? json_encode($product['segmentations']) : null;
                $inventoryItem->price = $product['selling_price'];
                $inventoryItem->purchase_price = (float) $product['purchase_price'];
                $inventoryItem->barcode = $product['default_barcode'] ?? $item->code;
                $inventoryItem->alert_quantity = $product['alert_quantity'] ?? 5;
                $inventoryItem->quantity = $newQuantity;
                $inventoryItem->stock_out_mood = 'FIFO'; // Default mode; can be overridden if passed in request
                $inventoryItem->vat_rate = $product['vat'] ?? 0;
                $inventoryItem->vat = ($product['selling_price'] * $product['vat']) / 100;
                $priceHistoryEntry = [
                    'date'       => now()->format('Y-m-d'),           // today
                    'invoice_id' => $invoice->id,
                    'price'      => (float) $product['selling_price'],
                ];

                $existingHistory = $inventoryItem->price_json
                    ? json_decode($inventoryItem->price_json, true)
                    : [];
                if (!is_array($existingHistory)) {
                    $existingHistory = [];
                }
                $existingHistory = collect($existingHistory)
                    ->filter(fn($entry) => $entry['invoice_id'] != $invoice->id)
                    ->push($priceHistoryEntry)
                    ->values()
                    ->toArray();
                $inventoryItem->price_json = json_encode($existingHistory, JSON_UNESCAPED_SLASHES);
                $inventoryItem->save();

                if ($stockMovement) {
                    $stockMovement->update(['inventory_item_id' => $inventoryItem->id]);
                }

                if ($salesChannelEnabled && !empty($product['sales_channels']) && is_array($product['sales_channels'])) {
                    foreach ($this->normalizeSalesChannelAllocations($product['sales_channels']) as $channel) {
                        InventorySalesChannel::create([
                            'inventory_id' => (string) $inventoryItem->id,
                            'channel_code' => $channel['channel_code'],
                            'quantity' => $channel['quantity'],
                        ]);
                    }
                }

                $this->customerWaitlistService->notifyPendingForProductOnRestock(
                    (string) $product['id'],
                    (string) $request->warehouse_id,
                    (string) (optional(Auth::user())->company_id ?? null)
                );

                // update all inventory items price
                if ($updateSellingPrice) {
                    $query = InventoryItem::where('product_id', $product['id'])
                        ->where('warehouse_id', $request->warehouse_id);
                    if (!empty($product['combination']) && is_array($product['combination'])) {
                        $query->whereJsonContains('variant_id', $product['combination']);
                    }
                    $itemsToUpdate = $query->get();

                    foreach ($itemsToUpdate as $item) {
                        $entry = [
                            'date'       => now()->format('Y-m-d'),
                            'invoice_id' => $invoice->id,
                            'price'      => (float) $product['selling_price'],
                        ];

                        $history = $item->price_json ?? [];

                        $item->price      = $product['selling_price'];
                        $item->price_json = $history; // Laravel auto-encodes due to cast
                        $item->save();
                    }
                }
               
                // ---------------------------------------------------------------
                //  SAVE BARCODES (default + custom) – one row per barcode
                // ---------------------------------------------------------------
                $defaultBarcode   = $product['default_barcode'] ?? $item->code;
                $useCustomBarcode = !empty($product['use_custom_code']);   // boolean from payload
                $barcodes         = $product['barcodes'] ?? [];            // array of system barcodes
                $customBarcodes   = $product['custom_barcodes'] ?? [];     // array of custom barcodes

                // 1. When **scan_each** is true → one barcode per unit
                if (!empty($product['scan_each']) && is_array($barcodes) && count($barcodes) === (int)$product['quantity']) {

                    foreach ($barcodes as $idx => $barcode) {
                        $custom = $customBarcodes[$idx] ?? null;

                        ProductBarcode::updateOrCreate(
                            [
                                'product_id'        => $inventory->product_id,
                                'inventory_id'      => $inventory->id,
                                'inventory_item_id' => $inventoryItem->id,
                                'barcode'           => $barcode,               // system barcode
                            ],
                            [
                                'custom_barcode'     => $custom,               // **single** custom barcode
                                'use_custom_barcode' => $useCustomBarcode,
                            ]
                        );
                    }

                } else {
                    // 2. Normal case – one row for the **default** barcode
                    ProductBarcode::updateOrCreate(
                        [
                            'product_id'        => $inventory->product_id,
                            'inventory_id'      => $inventory->id,
                            'inventory_item_id' => $inventoryItem->id,
                            'barcode'           => $defaultBarcode,
                        ],
                        [
                            'custom_barcode'     => $customBarcodes[0] ?? null,
                            'use_custom_barcode' => $useCustomBarcode,
                        ]
                    );
                }

            }

            // Update invoice
            $invoice->qty = $invoiceQty;
            $invoice->discount = $invoiceDiscount;
            $invoice->total = $invoiceTotal;
            $invoice->vat = $invoiceVat;
            $invoice->sub_total = $invoiceTotal;
            $invoice->payment_status = 0;
            $invoice->paid_amount = 0;
            $invoice->due_amount = $invoiceTotal;
            $invoice->payment_method = null;
            $invoice->save();


            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Purchase created successfully with invoice',
                'data' => [
                    'id' => $invoice->id,
                    'reference_no' => $invoice->reference_no ?? null,
                    'warehouse_id' => $invoice->warehouse_id,
                    'total_qty' => $invoice->qty,
                    'grand_total' => $invoice->total,
                    'status' => $invoice->status,
                    'payment_status' => $invoice->payment_status,
                    'invoice_id' => $invoice->id,
                ],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 0,
                'message' => 'Failed to create purchase',
                'error' => $e->getMessage(),
                'line' => $e->getLine(),
            ], 500);
        }
    }

    public function updateQuantity(Request $request)
{
    $validator = Validator::make($request->all(), [
        'inventoryId' => 'required|exists:inventory_items,id',
        'invoice_no'  => 'required|string',
        'quantity'    => 'required|numeric|min:1|max:1000000',
        'reason'      => 'nullable|string',
        'note'        => 'nullable|string|max:1000',
    ]);

    if ($validator->fails()) {
        return response()->json([
            'status'  => 0,
            'message' => 'Validation failed.',
            'errors'  => $validator->errors()->toArray(),
        ], 422);
    }

    DB::beginTransaction();

    try {
        // Load the original inventory item + its original invoice (to copy schedules)
        $baseItem = InventoryItem::with(['inventory', 'product', 'invoice.paymentSchedules'])
            ->findOrFail($request->inventoryId);

        $addedQty      = (float) $request->quantity;
        $purchasePrice = (float) $baseItem->purchase_price;
        $lineTotal     = $addedQty * $purchasePrice;

        if (PermissionUtils::isFeatureAccessible(Auth::user()?->company_id, FeaturePreference::STOCKGUARD->value)) {
            $reasonValue = $request->input('reason');
            $reason = $reasonValue ? StockAdjustmentReason::tryFrom($reasonValue) : null;

            if (!$reason) {
                DB::rollBack();

                return response()->json([
                    'status' => 0,
                    'message' => 'Validation failed.',
                    'errors' => ['reason' => ['Reason is required when StockGuard is enabled.']],
                ], 422);
            }

            if ($reason->requiresNote() && !$request->filled('note')) {
                DB::rollBack();

                return response()->json([
                    'status' => 0,
                    'message' => 'Validation failed.',
                    'errors' => ['note' => ['Note is required for this reason.']],
                ], 422);
            }

            $companyRules = $this->resolveStockGuardRules();
            $flags = StockGuardConfig::flags(
                $addedQty,
                $purchasePrice,
                $reason,
                (float) $companyRules['unit_threshold'],
                (float) $companyRules['value_threshold']
            );
            $approvalRequired = StockGuardConfig::requiresApproval(
                $addedQty,
                $purchasePrice,
                (float) $companyRules['unit_threshold'],
                (float) $companyRules['value_threshold']
            )
                || in_array(StockGuardFlag::SUSPICIOUS_REASON, $flags, true);

            if ($approvalRequired) {
                $inventory = $baseItem->inventory;
                $quantityBefore = (float) ($inventory?->quantity ?? 0);

                $adjustment = StockAdjustmentRequest::create([
                    'company_id' => Auth::user()?->company_id,
                    'product_id' => $baseItem->product_id,
                    'inventory_id' => $inventory?->id,
                    'inventory_item_id' => $baseItem->id,
                    'warehouse_id' => $baseItem->warehouse_id,
                    'qty_change' => $addedQty,
                    'quantity_before' => $quantityBefore,
                    'quantity_after' => null,
                    'unit_cost' => $purchasePrice,
                    'value_change' => $lineTotal,
                    'reason' => $reason->value,
                    'note' => $request->input('note'),
                    'status' => StockAdjustmentStatus::PENDING,
                    'flags' => array_map(fn (StockGuardFlag $flag) => $flag->value, $flags),
                    'is_flagged' => count($flags) > 0,
                    'requested_by' => Auth::id(),
                ]);

                DB::commit();

                return response()->json([
                    'status' => 1,
                    'approval_required' => true,
                    'message' => 'Approval required. StockGuard request sent to manager.',
                    'data' => [
                        'stockguard_request_id' => $adjustment->id,
                    ],
                ]);
            }
        }

        // 1. Create new Invoice (always fully paid with Cash)
        $invoice = new Invoice();
        $invoice->type            = 'purchase';
        $invoice->referance_value = $request->invoice_no;
        $invoice->warehouse_id    = $baseItem->warehouse_id;
        $invoice->user_id         = Auth::id();
        $invoice->supplier_id     = $baseItem->invoice?->supplier_id;
        $invoice->date            = now()->format('Y-m-d');
        $invoice->note            = 'Instant stock addition - cash purchase';
        $invoice->qty             = $addedQty;
        $invoice->total           = $lineTotal;
        $invoice->sub_total       = $lineTotal;
        $invoice->discount        = 0;
        $invoice->vat             = 0;
        $invoice->paid_amount     = $lineTotal;
        $invoice->due_amount      = 0;
        $invoice->payment_status  = 1; // Paid
        $invoice->payment_method  = 'Cash';
        $invoice->save();

        // 2. Update Inventory stock
        $inventory = $baseItem->inventory;
        if (!$inventory) {
            $inventory = new Inventory();
            $inventory->product_id     = $baseItem->product_id;
            $inventory->warehouse_id   = $baseItem->warehouse_id;
            $inventory->quantity       = 0;
            $inventory->alert_quantity = $baseItem->alert_quantity ?? 5;
            $inventory->stock_out_mood = 'FIFO';
            $inventory->save();

            $baseItem->inventory_id = $inventory->id;
            $baseItem->save();
        }
        $inventoryBefore = (float) $inventory->quantity;
        $inventory->quantity += $addedQty;
        $inventory->save();

        // 3. New InventoryItem detail
        $newItem = new InventoryItem();
        $newItem->product_id     = $baseItem->product_id;
        $newItem->lot_number     = $baseItem->lot_number;
        $newItem->warehouse_id   = $baseItem->warehouse_id;
        $newItem->invoice_id     = $invoice->id;
        $newItem->inventory_id   = $inventory->id;
        $newItem->expiry_date    = $baseItem->expiry_date;
        $newItem->variant_id     = $baseItem->variant_id;
        $newItem->segmentations  = $baseItem->segmentations;
        $newItem->price          = $baseItem->price;
        $newItem->purchase_price = $purchasePrice;
        $newItem->barcode        = $baseItem->barcode;
        $newItem->alert_quantity = $baseItem->alert_quantity ?? 5;
        $newItem->quantity       = $addedQty;
        $newItem->stock_out_mood = 'FIFO';
        $newItem->save();

        // Price history
        $history = $newItem->price_json ? json_decode($newItem->price_json, true) : [];
        $history[] = [
            'date'       => now()->format('Y-m-d'),
            'invoice_id' => $invoice->id,
            'price'      => $baseItem->price,
        ];
        $newItem->price_json = json_encode(array_values($history), JSON_UNESCAPED_SLASHES);
        $newItem->save();

        $this->customerWaitlistService->notifyPendingForProductOnRestock(
            (string) $baseItem->product_id,
            (string) $baseItem->warehouse_id,
            (string) (optional(Auth::user())->company_id ?? null)
        );

        // 4. InvoiceItem
        $invoiceItem = new InvoiceItem();
        $invoiceItem->invoice_id   = $invoice->id;
        $invoiceItem->inventory_id = $inventory->id;
        $invoiceItem->type         = 'purchase';
        $invoiceItem->date         = now()->format('Y-m-d');
        $invoiceItem->warehouse_id = $baseItem->warehouse_id;
        $invoiceItem->user_id      = Auth::id();
        $invoiceItem->product_id   = $baseItem->product_id;
        $invoiceItem->variant_id   = $baseItem->variant_id;
        $invoiceItem->qty          = $addedQty;
        $invoiceItem->lot_number   = $baseItem->lot_number;
        $invoiceItem->unit_price   = $purchasePrice;
        $invoiceItem->discount     = 0;
        $invoiceItem->total        = $lineTotal;
        $invoiceItem->vat_rate     = 0;
        $invoiceItem->vat          = 0;
        $invoiceItem->save();

        $newItem->invoice_item_id = $invoiceItem->id;
        $newItem->save();

        $this->stockMovementService->record([
            'company_id' => Auth::user()?->company_id,
            'product_id' => $baseItem->product_id,
            'inventory_id' => $inventory->id,
            'inventory_item_id' => $newItem->id,
            'warehouse_id' => $baseItem->warehouse_id,
            'type' => StockMovementService::TYPE_ADDED,
            'quantity_change' => $addedQty,
            'quantity_before' => $inventoryBefore,
            'quantity_after' => (float) $inventory->quantity,
            'reference_type' => StockMovementService::REF_INVOICE_ITEM,
            'reference_id' => $invoiceItem->id,
            'note' => 'Instant stock addition',
        ]);

        // 5. Barcode
        $barcode = new ProductBarcode();
        $barcode->product_id        = $baseItem->product_id;
        $barcode->inventory_id      = $inventory->id;
        $barcode->inventory_item_id = $newItem->id;
        $barcode->barcode           = $baseItem->barcode;
        $barcode->custom_barcode    = null;
        $barcode->use_custom_barcode = false;
        $barcode->save();

        // 6. Always create Cash Transaction (full amount)
        $transaction = new Transaction();
        $transaction->invoice_id       = $invoice->id;
        $transaction->user_id          = Auth::id();
        $transaction->amount           = $lineTotal;
        $transaction->payment_method   = 'Cash';
        $transaction->transaction_date = $invoice->date;
        $transaction->save();

        // 7. Copy Payment Schedules from original invoice (if any)
        if ($baseItem->invoice && $baseItem->invoice->paymentSchedules->count() > 0) {
            foreach ($baseItem->invoice->paymentSchedules as $oldSchedule) {
                $newSchedule = new PaymentSchedule();
                $newSchedule->invoice_id      = $invoice->id;
                $newSchedule->amount          = $oldSchedule->amount;
                $newSchedule->due_date        = $oldSchedule->due_date;
                $newSchedule->remainder_date  = $oldSchedule->remainder_date;
                $newSchedule->status          = $oldSchedule->status;
                $newSchedule->save();
            }
        }

        DB::commit();

        return response()->json([
            'status'  => 1,
            'message' => 'Stock added successfully with cash payment',
            'data'    => [
                'invoice_id'         => $invoice->id,
                'invoice_no'         => $invoice->referance_value,
                'added_quantity'     => $addedQty,
                'new_total_quantity' => $inventory->quantity,
                'total_amount'       => $lineTotal,
                'payment_method'     => 'Cash',
                'transaction_id'     => $transaction->id,
            ],
        ]);

    } catch (\Exception $e) {
        DB::rollBack();
        return response()->json([
            'status'  => 0,
            'message' => 'Failed to add stock',
            'error'   => $e->getMessage(),
            'line'    => $e->getLine(),
        ], 500);
    }
}

    private function resolveStockGuardRules(): array
    {
        if (!Schema::hasColumn('company', 'stockguard_unit_threshold') || !Schema::hasColumn('company', 'stockguard_value_threshold')) {
            return StockGuardConfig::options();
        }

        $companyId = Auth::user()?->company_id;
        if (!$companyId) {
            return StockGuardConfig::options();
        }

        $company = Company::query()
            ->select(['company_id', 'stockguard_unit_threshold', 'stockguard_value_threshold'])
            ->where('company_id', $companyId)
            ->first();

        return StockGuardConfig::options(
            $company ? (float) $company->stockguard_unit_threshold : null,
            $company ? (float) $company->stockguard_value_threshold : null
        );
    }

    public function getProductCombinations(Request $request, $productId)
    {
        try {
            $combinations = ProductCombination::where('product_id', $productId)->get();

            return response()->json([
                'status' => 1,
                'data' => $combinations->map(function ($combination) {
                    return [
                        'id' => $combination->id,
                        'combination' => $combination->combination,     // already an array
                        'segmentations' => $combination->segmentations, // already an array
                        'inventory_items' => $combination->inventoryItems(),
                    ];
                }),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Failed to fetch combinations',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'reference_no' => 'nullable|string|max:255|unique:purchases,reference_no,' . $id,
            'warehouse_id' => 'nullable|integer',
            'supplier_id' => 'nullable|integer|exists:suppliers,id',
            'currency_id' => 'nullable|integer|exists:currencies,id',
            'exchange_rate' => 'nullable|numeric',
            'item' => 'nullable|integer',
            'order_tax_rate' => 'nullable|numeric',
            'order_discount' => 'nullable|numeric',
            'shipping_cost' => 'nullable|numeric',
            'paid_amount' => 'nullable|numeric',
            'status' => 'nullable|string',
            'payment_status' => 'required|string',
            'document' => 'nullable|file|mimes:jpg,jpeg,png,pdf,webp|max:5120',
            'note' => 'nullable|string',

            'products' => 'required|array|min:1',
            'products.*.product_id' => 'required|string|exists:product,id',
            'products.*.product_batch_id' => 'nullable',
            'products.*.variant_id' => 'nullable',
            'products.*.qty' => 'required|numeric|min:0',
            'products.*.recieved' => 'nullable|numeric|min:0',
            'products.*.purchase_unit_id' => 'required|exists:units,id',
            'products.*.net_unit_cost' => 'required|numeric',
            'products.*.discount' => 'nullable|numeric',
            'products.*.tax_rate' => 'nullable|numeric',
            'products.*.tax' => 'nullable|numeric',
            'products.*.total' => 'required|numeric',
        ]);

        if ($validator->fails()) {
            return response()->json(
                [
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ],
                422,
            );
        }

        DB::beginTransaction();

        try {
            $purchase = Purchase::findOrFail($id);

            $purchase->reference_no = $request->reference_no;
            $purchase->warehouse_id = $request->warehouse_id;
            $purchase->supplier_id = $request->supplier_id;
            $purchase->currency_id = $request->currency_id;
            $purchase->exchange_rate = $request->exchange_rate ?? 1;
            $purchase->item = $request->item ?? count($request->products);
            $purchase->status = $request->status;
            $purchase->payment_status = $request->payment_status;

            if ($request->hasFile('document')) {
                $purchase->document = ImageService::upload($request->file('document'), 'purchase-documents', [
                    'extensions' => ['jpg', 'jpeg', 'png', 'pdf', 'webp'],
                    'mime_types' => ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'],
                    'max_kb' => 5120,
                    'field' => 'document',
                ]);
            }

            $purchase->note = $request->note;

            // === Server-side Calculations ===
            $totalQty = 0;
            $totalDiscount = 0;
            $totalTax = 0;
            $totalCost = 0;

            foreach ($request->products as $product) {
                $totalQty += $product['qty'];
                $totalDiscount += $product['discount'] ?? 0;
                $totalTax += $product['tax'] ?? 0;
                $totalCost += $product['total'];
            }

            $orderTaxRate = $request->order_tax_rate ?? 0;
            $orderDiscount = $request->order_discount ?? 0;
            $shippingCost = $request->shipping_cost ?? 0;

            $orderTax = $orderTaxRate > 0 ? $totalCost * ($orderTaxRate / 100) : 0;
            $grandTotal = $totalCost + $orderTax + $shippingCost - $orderDiscount;

            $purchase->total_qty = $totalQty;
            $purchase->total_discount = $totalDiscount;
            $purchase->total_tax = $totalTax;
            $purchase->total_cost = $totalCost;
            $purchase->order_tax_rate = $orderTaxRate;
            $purchase->order_tax = $orderTax;
            $purchase->order_discount = $orderDiscount;
            $purchase->shipping_cost = $shippingCost;
            $purchase->grand_total = $grandTotal;
            $purchase->paid_amount = $request->paid_amount ?? 0;

            $purchase->save();

            // === Remove existing product & inventory records ===
            PurchaseProduct::where('purchase_id', $purchase->id)->update(['is_deleted' => true]);
            PurchaseProduct::where('purchase_id', $purchase->id)->delete();
            Inventory::where('purchase_id', $purchase->id)->update(['is_deleted' => true]);
            Inventory::where('purchase_id', $purchase->id)->delete();

            // === Insert updated products and inventory ===
            foreach ($request->products as $product) {
                $purchaseProduct = new PurchaseProduct();
                $purchaseProduct->purchase_id = $purchase->id;
                $purchaseProduct->product_id = $product['product_id'];
                $purchaseProduct->product_batch_id = $product['product_batch_id'] ?? null;
                $purchaseProduct->variant_id = $product['variant_id'] ?? null;
                $purchaseProduct->qty = $product['qty'];
                $purchaseProduct->recieved = $product['recieved'] ?? $product['qty'];
                $purchaseProduct->purchase_unit_id = $product['purchase_unit_id'];
                $purchaseProduct->net_unit_cost = $product['net_unit_cost'];
                $purchaseProduct->discount = $product['discount'] ?? 0;
                $purchaseProduct->tax_rate = $product['tax_rate'] ?? 0;
                $purchaseProduct->tax = $product['tax'] ?? 0;
                $purchaseProduct->total = $product['total'];
                $purchaseProduct->save();

                $inventory = new Inventory();
                $inventory->warehouse_id = $request->warehouse_id;
                $inventory->product_id = $product['product_id'];
                $inventory->lot_number = null;
                $inventory->batch_number = null;
                $inventory->expiry_date = null;
                $inventory->barcode = null;
                $inventory->sku = null;
                $inventory->quantity = $product['qty'];
                $inventory->variant_id = $product['variant_id'] ?? null;
                $inventory->price = $product['net_unit_cost'];
                $inventory->purchase_price = $product['net_unit_cost'];
                $inventory->discount_amount = $product['discount'] ?? 0;
                $inventory->discount_type = 'flat';
                $inventory->tax = $product['tax'] ?? 0;
                $inventory->vat = 0;
                $inventory->purchase_id = $purchase->id;
                $inventory->save();

                $this->customerWaitlistService->notifyPendingForProductOnRestock(
                    (string) $product['product_id'],
                    (string) $request->warehouse_id,
                    (string) (optional(Auth::user())->company_id ?? null)
                );
            }

            DB::commit();

            return response()->json(
                [
                    'status' => 1,
                    'message' => 'Purchase updated successfully',
                    'data' => [
                        'id' => $purchase->id,
                        'reference_no' => $purchase->reference_no,
                        'warehouse_id' => $purchase->warehouse_id,
                        'total_qty' => $purchase->total_qty,
                        'grand_total' => $purchase->grand_total,
                        'status' => $purchase->status,
                        'payment_status' => $purchase->payment_status,
                    ],
                ],
                200,
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Failed to update purchase',
                    'error' => $e->getMessage(),
                ],
                500,
            );
        }
    }

    public function delete($id)
    {
        $purchase = Purchase::find($id);
        if (!$purchase) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Purchase not found',
                ],
                404,
            );
        }

        DB::beginTransaction();

        try {
            // Delete related products and inventory
            PurchaseProduct::where('purchase_id', $purchase->id)->update(['is_deleted' => true]);
            PurchaseProduct::where('purchase_id', $purchase->id)->delete();
            Inventory::where('purchase_id', $purchase->id)->update(['is_deleted' => true]);
            Inventory::where('purchase_id', $purchase->id)->delete();

            // Delete the purchase
            $purchase->is_deleted = true;
            $purchase->saveQuietly();
            $purchase->delete();

            DB::commit();

            return response()->json(
                [
                    'status' => 1,
                    'message' => 'Purchase deleted successfully',
                ],
                200,
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Failed to delete purchase',
                    'error' => $e->getMessage(),
                ],
                500,
            );
        }
    }

    public function getInvoice($invoiceNo = null)
    {
        if ($invoiceNo) {
            // Fetch a single invoice with related inventory, product, and stockGroup
            $invoice = Invoice::with(['items.product'])
                ->where('invoice_no', $invoiceNo)
                ->first();

            if ($invoice) {
               
                return response()->json([
                    'status' => 1,
                    'message' => 'Invoice fetched successfully',
                    'data' => $invoice,
                    'warehouse_id' => $invoice->warehouse_id,
                ], 200);
            }

            return response()->json([
                'status' => 0,
                'message' => 'Invoice not found',
                'data' => null,
            ], 422);
        }

        // If no invoice number, return all invoices
        $invoices = Invoice::with(['items.product'])->get();

        return response()->json([
            'status' => 1,
            'message' => 'All invoices fetched successfully',
            'data' => $invoices,
        ], 200);
    }

    public function storeInvoice(Request $request, $invoiceNo)
    {
        $validated = $request->validate([
            'supplier_id' => 'required|string|max:255',
            'invoice_date' => 'required|date',
            'total_amount' => 'required|numeric|min:0',
        ]);

        $existing = PurchaseInvoice::where('invoice_no', $invoiceNo)->first();
        if ($existing) {
            return response()->json(
                [
                    'status' => false,
                    'message' => 'Invoice already exists.',
                ],
                422,
            );
        }

        $invoice = PurchaseInvoice::create([
            'invoice_no' => $invoiceNo,
            'supplier_id' => $validated['supplier_id'],
            'invoice_date' => $validated['invoice_date'],
            'total_amount' => $validated['total_amount'],
        ]);

        return response()->json([
            'status' => true,
            'message' => 'Invoice created successfully.',
            'invoice' => $invoice,
        ]);
    }

    public function inventoryCheck(Request $request){
        $validator = Validator::make($request->all(), [
            'product_id' => 'required|exists:product,id',
            'combination' => 'nullable|json',
        ]);

        if ($validator->fails()) {
            return response()->json(
                [
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ],
                422,
            );
        }

        $combinationJson = $request->combination;
        $segmentationsJson = $request->segmentations ?? null;

        $inventoryQuery = Inventory::with('inventory_items')->where('product_id', $request->product_id);

        $variantId = null;
        if ($combinationJson && $combinationJson != '{}') {
            $productCombination = ProductCombination::where([
                'product_id' => $request->product_id,
                'combination' => $combinationJson,
            ])->first();

            $variantId = $productCombination ? $productCombination->id : null;

            if ($variantId) {
                $inventoryQuery = $productCombination->inventoryItems();
                $inventoryAllItems = $productCombination->AllInventoryItems();
                $inventory = Inventory::with('inventory_items')->where('id', $inventoryQuery->inventory_id)->first();
                if ($inventory) {
                    return response()->json([
                        'exists' => true,
                        'price' => $inventoryQuery->price,
                        'quantity' => $inventory->quantity,
                        'inventory_item' => $inventoryQuery,
                        'variant_id' => $variantId,
                        'variant' => true,
                    ]);
                } else {
                    return response()->json([
                        'exists' => false,
                    ]);
                }
            }else{
                return response()->json([
                    'exists' => false,
                ]);
            }
        }


        $inventory = $inventoryQuery->first();
        
        if ($inventory) {
            return response()->json([
                'exists' => true,
                'price' => $inventory->inventory_items()->orderBy('created_at', 'desc')->first()->price,
                'quantity' => $inventory->quantity,
                'inventory_item' => $inventory->inventory_items()->orderBy('created_at', 'desc')->first(),
                'variant_id' => $variantId,
                'variant' => false,
            ]);
        } else {
            return response()->json([
                'exists' => false,
            ]);
        }
    }
}

