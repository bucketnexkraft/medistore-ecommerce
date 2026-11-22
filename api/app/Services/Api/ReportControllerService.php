<?php

namespace App\Services\Api;

use App\Models\Category;
use App\Models\Inventory;
use App\Models\InventoryHistory;
use App\Models\InventoryItem;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\Timesheet;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class ReportControllerService
{
    public function dailyMonthlySalesReport(Request $request)
    {
        $type = $request->input('type', 'daily');
        $year = $request->input('year', date('Y'));
        $month = $request->input('month', date('m'));

        $query = Invoice::with('items.product', 'supplier', 'customer')
            ->where('type', 'sale') // Only count sales invoices
            ->whereYear('date', $year);

        // Apply month filter for daily reports
        if ($type == 'daily' && $month) {
            $query->whereMonth('date', $month);
        }

        // Group by day or month based on type
        $groupBy = $type === 'daily' ? 'DAY(date)' : 'MONTH(date)';
        $salesData = $query->selectRaw("
                {$groupBy} as period,
                COUNT(id) as invoice_count,
                SUM(discount) as total_discount,
                SUM(total) as grand_total,
                SUM(qty) as total_qty
            ")
            ->groupBy('period')
            ->get()
            ->keyBy('period')
            ->map(function ($item) {
                return [
                    'Order Discount' => $item->total_discount ?? 0,
                    'Product Tax'   => 0, // Adjust if product tax is separate
                    'Order Tax'     =>  0,
                    'Grand Total'   => $item->grand_total ?? 0,
                    'Quantity'      => $item->total_qty ?? 0,
                    'Number of Invoice' => $item->invoice_count ?? 0,
                ];
            });

        // Ensure all days (1-31) or months (1-12) are represented with zeros if no data
        $result = [];
        $periodRange = $type === 'daily' ? range(1, 31) : range(1, 12);
        foreach ($periodRange as $period) {
            $result[$period] = $salesData->get($period, [
                'Order Discount'    => 0,
                'Product Tax'       => 0,
                'Order Tax'         => 0,
                'Grand Total'       => 0,
                'Quantity'          => 0,
                'Number of Invoice' => 0,
            ]);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Sales report fetched successfully',
            'data' => $result,
            'meta' => [
                'type' => $type,
                'year' => $year,
                'month' => $month ? (int)$month : null,
            ],
        ], 200);
    }

    public function dailyMonthlyPurchaseReport(Request $request)
    {
        $type = $request->input('type', 'daily'); // 'daily' or 'monthly'
        $year = $request->input('year', date('Y')); // Default to current year (2025)
        $month = $request->input('month', date('m')); // Optional for daily reports (1-12)

        $query = Invoice::with('items.product', 'supplier', 'customer')
            ->where('type', 'purchase') // Only count sales invoices
            ->whereYear('date', $year);

        // Apply month filter for daily reports
        if ($type == 'daily' && $month) {
            $query->whereMonth('date', $month);
        }


        // Group by day or month based on type
        $groupBy = $type === 'daily' ? 'DAY(date)' : 'MONTH(date)';
        $salesData = $query->selectRaw("
            {$groupBy} as period,
            SUM(discount) as total_discount,
            SUM(total) as grand_total,
            SUM(qty) as total_qty
        ")
            ->groupBy('period')
            ->get()
            ->keyBy('period')
            ->map(function ($item) {
                return [
                    'Order Discount' => $item->total_discount ?? 0,
                    'Product Tax' => 0, // Assuming tax is already included in total_tax; adjust if separate
                    'Order Tax' => 0,
                    'Grand Total' => $item->grand_total ?? 0,
                    'Quantity' => $item->total_qty ?? 0,
                ];
            });

        // Ensure all days (1-31) or months (1-12) are represented with zeros if no data
        $result = [];
        $periodRange = $type === 'daily' ? range(1, 31) : range(1, 12);
        foreach ($periodRange as $period) {
            $result[$period] = $salesData->get($period, [
                'Order Discount' => 0,
                'Product Tax' => 0,
                'Order Tax' => 0,
                'Grand Total' => 0,
                'Quantity' => 0,
            ]);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Sales report fetched successfully',
            'data' => $result,
            'meta' => [
                'type' => $type,
                'year' => $year,
                'month' => $month ? (int)$month : null,
            ],
        ], 200);
    }

    public function supplierPurchaseReport(Request $request)
    {
        $perPage = (int) $request->input('perPage', 20);
        $page = max((int) $request->input('page', 1), 1);
        $search = trim((string) $request->input('search', ''));
        $supplierId = $request->input('supplier');
        $warehouseId = $request->input('warehouse');
        $paymentStatus = $request->input('payment_status');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
        $sortField = $request->input('sortField', 'grand_total');
        $sortOrder = strtolower($request->input('sortOrder', 'desc')) === 'asc' ? 'asc' : 'desc';

        $query = Invoice::query()
            ->with(['supplier', 'warehouse'])
            ->where('type', 'purchase');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('invoice_no', 'LIKE', "%{$search}%")
                    ->orWhere('referance_value', 'LIKE', "%{$search}%")
                    ->orWhereHas('supplier', function ($supplierQuery) use ($search) {
                        $supplierQuery->where('name', 'LIKE', "%{$search}%")
                            ->orWhere('email', 'LIKE', "%{$search}%")
                            ->orWhere('phone_number', 'LIKE', "%{$search}%");
                    });
            });
        }

        if (!empty($supplierId)) {
            $query->where('supplier_id', $supplierId);
        }

        if (!empty($warehouseId)) {
            $query->where('warehouse_id', $warehouseId);
        }

        if ($paymentStatus !== null && $paymentStatus !== '') {
            if (in_array($paymentStatus, ['0', '1', '2', 0, 1, 2], true)) {
                $query->where('payment_status', (int) $paymentStatus);
            } elseif ($paymentStatus === 'paid') {
                $query->where('payment_status', 1);
            } elseif ($paymentStatus === 'unpaid') {
                $query->where('payment_status', 0);
            } elseif ($paymentStatus === 'partial') {
                $query->where('payment_status', 2);
            }
        }

        if (!empty($startDate)) {
            $query->whereDate('date', '>=', $startDate);
        }

        if (!empty($endDate)) {
            $query->whereDate('date', '<=', $endDate);
        }

        $invoices = $query
            ->orderBy('date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        $groupedSuppliers = $invoices
            ->groupBy(function ($invoice) {
                return $invoice->supplier_id ?: 'walk-in';
            })
            ->map(function ($supplierInvoices, $key) {
                $supplier = $supplierInvoices->first()?->supplier;
                $warehouseNames = $supplierInvoices
                    ->pluck('warehouse.name')
                    ->filter()
                    ->unique()
                    ->values();

                $grandTotal = (float) $supplierInvoices->sum(fn($invoice) => (float) ($invoice->total ?? 0));
                $paidTotal = (float) $supplierInvoices->sum(fn($invoice) => (float) ($invoice->paid_amount ?? 0));
                $dueTotal = (float) $supplierInvoices->sum(fn($invoice) => (float) ($invoice->due_amount ?? 0));
                $discountTotal = (float) $supplierInvoices->sum(fn($invoice) => (float) ($invoice->discount ?? 0));
                $qtyTotal = (float) $supplierInvoices->sum(fn($invoice) => (float) ($invoice->qty ?? 0));
                $invoiceCount = $supplierInvoices->count();
                $lastPurchase = optional($supplierInvoices->sortByDesc('date')->first())->date;
                $firstPurchase = optional($supplierInvoices->sortBy('date')->first())->date;

                return [
                    'id' => $key === 'walk-in' ? null : $supplier?->id,
                    'key' => (string) $key,
                    'supplier_name' => $supplier?->name ?? 'Walk-in Supplier',
                    'email' => $supplier?->email,
                    'phone' => $supplier?->phone_number ?? $supplier?->phone,
                    'address' => $supplier?->address,
                    'invoice_count' => $invoiceCount,
                    'total_qty' => $qtyTotal,
                    'grand_total' => $grandTotal,
                    'paid_total' => $paidTotal,
                    'due_total' => $dueTotal,
                    'discount_total' => $discountTotal,
                    'average_invoice_value' => $invoiceCount > 0 ? $grandTotal / $invoiceCount : 0,
                    'warehouse_count' => $warehouseNames->count(),
                    'warehouses' => $warehouseNames->all(),
                    'first_purchase_date' => $firstPurchase,
                    'last_purchase_date' => $lastPurchase,
                    'status_breakdown' => [
                        'paid' => $supplierInvoices->where('payment_status', 1)->count(),
                        'unpaid' => $supplierInvoices->where('payment_status', 0)->count(),
                        'partial' => $supplierInvoices->where('payment_status', 2)->count(),
                    ],
                    'recent_invoices' => $supplierInvoices
                        ->sortByDesc('date')
                        ->take(5)
                        ->map(function ($invoice) {
                            return [
                                'id' => $invoice->id,
                                'invoice_no' => $invoice->invoice_no,
                                'date' => $invoice->date,
                                'warehouse' => $invoice->warehouse?->name,
                                'qty' => (float) ($invoice->qty ?? 0),
                                'grand_total' => (float) ($invoice->total ?? 0),
                                'paid_amount' => (float) ($invoice->paid_amount ?? 0),
                                'due_amount' => (float) ($invoice->due_amount ?? 0),
                                'payment_status' => (int) ($invoice->payment_status ?? 0),
                            ];
                        })
                        ->values()
                        ->all(),
                ];
            })
            ->values();

        $validSortFields = [
            'supplier_name',
            'invoice_count',
            'total_qty',
            'grand_total',
            'paid_total',
            'due_total',
            'discount_total',
            'average_invoice_value',
            'warehouse_count',
            'last_purchase_date',
            'first_purchase_date',
        ];

        $sortField = in_array($sortField, $validSortFields, true) ? $sortField : 'grand_total';

        $sortedSuppliers = $groupedSuppliers->sort(function ($a, $b) use ($sortField, $sortOrder) {
            $valueA = $a[$sortField] ?? null;
            $valueB = $b[$sortField] ?? null;

            if ($sortField === 'supplier_name') {
                $comparison = strcasecmp((string) $valueA, (string) $valueB);
            } else {
                $comparison = $valueA <=> $valueB;
            }

            return $sortOrder === 'asc' ? $comparison : -$comparison;
        })->values();

        $totalSuppliers = $sortedSuppliers->count();
        $paginatedData = $sortedSuppliers->forPage($page, $perPage)->values();

        return response()->json([
            'status' => 1,
            'message' => 'Supplier purchase report fetched successfully',
            'data' => $paginatedData,
            'meta' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $totalSuppliers,
                'last_page' => $perPage > 0 ? (int) ceil($totalSuppliers / $perPage) : 1,
            ],
            'others_data' => [
                'total_suppliers' => $groupedSuppliers->count(),
                'total_invoices' => $invoices->count(),
                'total_qty' => (float) $invoices->sum(fn($invoice) => (float) ($invoice->qty ?? 0)),
                'grand_total' => (float) $invoices->sum(fn($invoice) => (float) ($invoice->total ?? 0)),
                'paid_total' => (float) $invoices->sum(fn($invoice) => (float) ($invoice->paid_amount ?? 0)),
                'due_total' => (float) $invoices->sum(fn($invoice) => (float) ($invoice->due_amount ?? 0)),
                'discount_total' => (float) $invoices->sum(fn($invoice) => (float) ($invoice->discount ?? 0)),
                'average_invoice_value' => $invoices->count() > 0
                    ? (float) $invoices->sum(fn($invoice) => (float) ($invoice->total ?? 0)) / $invoices->count()
                    : 0,
                'payment_status_breakdown' => [
                    'paid' => $invoices->where('payment_status', 1)->count(),
                    'unpaid' => $invoices->where('payment_status', 0)->count(),
                    'partial' => $invoices->where('payment_status', 2)->count(),
                ],
            ],
        ], 200);
    }

    public function categoryWiseStockReport(Request $request)
    {
        $perPage = $request->input('perPage', 20);
        $page = $request->input('page', 1);
        $filterText = $request->input('search', '');
        $filterWarehouse = $request->input('warehouse', '');
        $dateFrom = $request->input('date_from', '');
        $dateTo = $request->input('date_to', '');
        $filterCategory = $request->input('category', '');
        $includeChildCategories = $request->input('include_child_categories', 0);

        // DEBUG: Start with InventoryItem as main table
        $debugQuery = InventoryItem::query()
            ->with(['product.category', 'warehouse'])
            ->where('quantity', '>', 0);

        // Apply filters
        if (!empty($filterWarehouse)) {
            $debugQuery->where('warehouse_id', $filterWarehouse);
        }
        if (!empty($dateFrom) && !empty($dateTo)) {
            $debugQuery->whereBetween('created_at', [$dateFrom, $dateTo . ' 23:59:59']);
        }
        
        // Category filter with child categories support
        if (!empty($filterCategory)) {
            if ($includeChildCategories) {
                // Get all child category IDs
                $categoryIds = [$filterCategory];
                $queue = [$filterCategory];
                
                while ($queue) {
                    $current = array_shift($queue);
                    $children = Category::where('ancestor_id', $current)->pluck('id')->toArray();
                    $categoryIds = array_merge($categoryIds, $children);
                    $queue = array_merge($queue, $children);
                }
                
                $debugQuery->whereHas('product.category', function($q) use ($categoryIds) {
                    $q->whereIn('id', $categoryIds);
                });
            } else {
                $debugQuery->whereHas('product.category', function($q) use ($filterCategory) {
                    $q->where('id', $filterCategory);
                });
            }
        }

        // Get all inventory items for debugging
        $allInventoryItems = $debugQuery->get();
        
        // Group by category for the report
        $categoryGroups = $allInventoryItems->groupBy(function ($item) {
            $category = $item->product->category ?? null;
            return $category ? $category->id : 'no-category';
        });

        // Get all categories for proper response structure
        $categoriesQuery = Category::query();
        if (!empty($filterText)) {
            $categoriesQuery->where('title', 'LIKE', "%{$filterText}%");
        }
        if (!empty($filterCategory)) {
            if ($includeChildCategories) {
                // Get all child category IDs for display
                $categoryIds = [$filterCategory];
                $queue = [$filterCategory];
                
                while ($queue) {
                    $current = array_shift($queue);
                    $children = Category::where('ancestor_id', $current)->pluck('id')->toArray();
                    $categoryIds = array_merge($categoryIds, $children);
                    $queue = array_merge($queue, $children);
                }
                
                $categoriesQuery->whereIn('id', $categoryIds);
            } else {
                $categoriesQuery->where('id', $filterCategory);
            }
        }

        $allCategories = $categoriesQuery->get();
        
        // Build the data array
        $data = collect();
        $grandProductCount = 0;
        $grandTotalQty = 0;
        $grandPurchasePrice = 0;
        $grandSellingPrice = 0;

        foreach ($allCategories as $category) {
            $categoryId = $category->id;
            $categoryItems = $categoryGroups->get($categoryId, collect());

            // Get unique products from inventory items
            $productIds = $categoryItems->pluck('product_id')->unique();
            $productCount = $productIds->count();

            // Calculate totals
            $totalQty = $categoryItems->sum('quantity');
            $totalPurchasePrice = $categoryItems->sum(function ($item) {
                return ($item->purchase_price ?? 0) * $item->quantity;
            });
            $totalSellingPrice = $categoryItems->sum(function ($item) {
                return ($item->price ?? 0) * $item->quantity;
            });

            $data->push([
                'category'       => $category->title ?? 'Unknown Category',
                'product_count'  => $productCount,
                'total_qty'      => $totalQty,
                'purchase_price' => $totalPurchasePrice,
                'selling_price'  => $totalSellingPrice,
                'debug_info'     => [
                    'category_id' => $categoryId,
                    'inventory_items_count' => $categoryItems->count(),
                    'unique_products' => $productIds->toArray(),
                ]
            ]);

            $grandProductCount += $productCount;
            $grandTotalQty += $totalQty;
            $grandPurchasePrice += $totalPurchasePrice;
            $grandSellingPrice += $totalSellingPrice;
        }

        // Handle items without category (only if not filtering by specific category)
        if ($categoryGroups->has('no-category') && !$filterCategory) {
            $noCategoryItems = $categoryGroups->get('no-category');
            $productIds = $noCategoryItems->pluck('product_id')->unique();
            $productCount = $productIds->count();

            $totalQty = $noCategoryItems->sum('quantity');
            $totalPurchasePrice = $noCategoryItems->sum(function ($item) {
                return ($item->purchase_price ?? 0) * $item->quantity;
            });
            $totalSellingPrice = $noCategoryItems->sum(function ($item) {
                return ($item->price ?? 0) * $item->quantity;
            });

            $data->push([
                'category'       => 'No Category',
                'product_count'  => $productCount,
                'total_qty'      => $totalQty,
                'purchase_price' => $totalPurchasePrice,
                'selling_price'  => $totalSellingPrice,
                'debug_info'     => [
                    'category_id' => null,
                    'inventory_items_count' => $noCategoryItems->count(),
                    'unique_products' => $productIds->toArray(),
                ]
            ]);

            $grandProductCount += $productCount;
            $grandTotalQty += $totalQty;
            $grandPurchasePrice += $totalPurchasePrice;
            $grandSellingPrice += $totalSellingPrice;
        }

        // Manual pagination
        $total = $data->count();
        $paginatedData = $data->slice(($page - 1) * $perPage, $perPage)->values();

        return response()->json(
            [
                'status'  => 1,
                'message' => 'Category-wise stock fetched successfully',
                'data'    => $paginatedData,
                'others'  => [
                    'total_product_count' => $grandProductCount,
                    'total_total_qty'     => $grandTotalQty,
                    'total_purchase_price' => $grandPurchasePrice,
                    'total_selling_price' => $grandSellingPrice,
                    'debug' => [
                        'total_inventory_items' => $allInventoryItems->count(),
                        'categories_found' => $allCategories->count(),
                        'categories_with_data' => $data->count(),
                        'include_child_categories' => $includeChildCategories,
                        'filter_category' => $filterCategory,
                    ]
                ],
                'meta'    => [
                    'current_page' => (int) $page,
                    'per_page'     => (int) $perPage,
                    'total'        => $total,
                    'last_page'    => ceil($total / $perPage),
                ],
            ],
            200
        );
    }


    public function categoryWiseSalesReport(Request $request)
    {
        $perPage = $request->input('perPage', 20);
        $page = $request->input('page', 1);
        $filterText = $request->input('search', '');
        $filterWarehouse = $request->input('warehouse', '');
        $dateFrom = $request->input('date_from', '');
        $dateTo = $request->input('date_to', '');
        $filterCategory = $request->input('category', '');
        $includeChildCategories = $request->input('include_child_categories', 0);
        $paymentMethod = $request->input('payment_method', '');
        $normalizedPaymentMethod = strtolower(trim((string) $paymentMethod));

        // Base query for categories
        $baseQuery = Category::query();

        if ($includeChildCategories) {
            // parent + child categories
        } else {
            // only parent categories
            $baseQuery->whereNull('ancestor_id');
        }

        if (!empty($filterCategory)) {
            if ($includeChildCategories) {
                $categoryIds = Category::where(function ($q) use ($filterCategory) {
                    $q->where('id', $filterCategory)
                        ->orWhere('ancestor_id', $filterCategory);
                })
                    ->pluck('id');
                $baseQuery->whereIn('id', $categoryIds);
            } else {
                $baseQuery->where('id', $filterCategory);
            }
        }

        if (!empty($filterText)) {
            $baseQuery->where('title', 'LIKE', "%{$filterText}%");
        }

        // eager load parent + child products
        $query = clone $baseQuery;
        $query->with([
            'products.invoiceItems' => function ($itemQuery) use ($filterWarehouse, $dateFrom, $dateTo, $paymentMethod, $normalizedPaymentMethod) {
                $itemQuery->where('type', 'sale');
                if (!empty($filterWarehouse)) {
                    $itemQuery->where('warehouse_id', $filterWarehouse);
                }
                if (!empty($dateFrom) && !empty($dateTo)) {
                    $itemQuery->whereBetween('date', [$dateFrom, $dateTo . ' 23:59:59']);
                }
                if (!empty($paymentMethod)) {
                    $itemQuery->whereHas('invoice', function ($q) use ($paymentMethod, $normalizedPaymentMethod) {
                        $q->where(function ($invoiceQuery) use ($paymentMethod, $normalizedPaymentMethod) {
                            $invoiceQuery
                                ->whereRaw('LOWER(TRIM(payment_method)) = ?', [$normalizedPaymentMethod])
                                ->orWhereHas('transactions', function ($transactionQuery) use ($normalizedPaymentMethod) {
                                    $transactionQuery->whereRaw(
                                        'LOWER(TRIM(payment_method)) = ?',
                                        [$normalizedPaymentMethod]
                                    );
                                });
                        });
                    });
                }
            },
            'children.products.invoiceItems' => function ($itemQuery) use ($filterWarehouse, $dateFrom, $dateTo, $paymentMethod, $normalizedPaymentMethod) {
                $itemQuery->where('type', 'sale');
                if (!empty($filterWarehouse)) {
                    $itemQuery->where('warehouse_id', $filterWarehouse);
                }
                if (!empty($dateFrom) && !empty($dateTo)) {
                    $itemQuery->whereBetween('date', [$dateFrom, $dateTo . ' 23:59:59']);
                }
                if (!empty($paymentMethod)) {
                    $itemQuery->whereHas('invoice', function ($q) use ($paymentMethod, $normalizedPaymentMethod) {
                        $q->where(function ($invoiceQuery) use ($paymentMethod, $normalizedPaymentMethod) {
                            $invoiceQuery
                                ->whereRaw('LOWER(TRIM(payment_method)) = ?', [$normalizedPaymentMethod])
                                ->orWhereHas('transactions', function ($transactionQuery) use ($normalizedPaymentMethod) {
                                    $transactionQuery->whereRaw(
                                        'LOWER(TRIM(payment_method)) = ?',
                                        [$normalizedPaymentMethod]
                                    );
                                });
                        });
                    });
                }
            }
        ]);

        $categories = $query->paginate($perPage, ['*'], 'page', $page);

        // 📊 Map data
        $data = $categories->getCollection()->map(function ($category) use ($includeChildCategories) {
            $products = $category->products ?? collect([]);
            $invoiceItems = $products->flatMap(fn($p) => $p->invoiceItems ?? collect([]));

            if (!$includeChildCategories) {
                // merge child products into parent total
                $childProducts = $category->children->flatMap(fn($child) => $child->products ?? collect([]));
                $products = $products->merge($childProducts);
                $invoiceItems = $products->flatMap(fn($p) => $p->invoiceItems ?? collect([]));
            }

            return [
                'category' => $category->title ?? 'Unknown Category',
                'product_count' => $products->count(),
                'total_qty_sold' => $invoiceItems->sum('qty') ?: 0,
                'total_sales' => $invoiceItems->sum('total') ?: 0,
            ];
        });

        // 🔹 Grand Totals (ignoring pagination)
        $allCategories = $baseQuery->with([
            'products.invoiceItems' => function ($itemQuery) use ($filterWarehouse, $dateFrom, $dateTo, $paymentMethod, $normalizedPaymentMethod) {
                $itemQuery->where('type', 'sale');
                if (!empty($filterWarehouse)) {
                    $itemQuery->where('warehouse_id', $filterWarehouse);
                }
                if (!empty($dateFrom) && !empty($dateTo)) {
                    $itemQuery->whereBetween('date', [$dateFrom, $dateTo . ' 23:59:59']);
                }
                if (!empty($paymentMethod)) {
                    $itemQuery->whereHas('invoice', function ($q) use ($paymentMethod, $normalizedPaymentMethod) {
                        $q->where(function ($invoiceQuery) use ($paymentMethod, $normalizedPaymentMethod) {
                            $invoiceQuery
                                ->whereRaw('LOWER(TRIM(payment_method)) = ?', [$normalizedPaymentMethod])
                                ->orWhereHas('transactions', function ($transactionQuery) use ($normalizedPaymentMethod) {
                                    $transactionQuery->whereRaw(
                                        'LOWER(TRIM(payment_method)) = ?',
                                        [$normalizedPaymentMethod]
                                    );
                                });
                        });
                    });
                }
            },
            'children.products.invoiceItems' => function ($itemQuery) use ($filterWarehouse, $dateFrom, $dateTo, $paymentMethod, $normalizedPaymentMethod) {
                $itemQuery->where('type', 'sale');
                if (!empty($filterWarehouse)) {
                    $itemQuery->where('warehouse_id', $filterWarehouse);
                }
                if (!empty($dateFrom) && !empty($dateTo)) {
                    $itemQuery->whereBetween('date', [$dateFrom, $dateTo . ' 23:59:59']);
                }
                if (!empty($paymentMethod)) {
                    $itemQuery->whereHas('invoice', function ($q) use ($paymentMethod, $normalizedPaymentMethod) {
                        $q->where(function ($invoiceQuery) use ($paymentMethod, $normalizedPaymentMethod) {
                            $invoiceQuery
                                ->whereRaw('LOWER(TRIM(payment_method)) = ?', [$normalizedPaymentMethod])
                                ->orWhereHas('transactions', function ($transactionQuery) use ($normalizedPaymentMethod) {
                                    $transactionQuery->whereRaw(
                                        'LOWER(TRIM(payment_method)) = ?',
                                        [$normalizedPaymentMethod]
                                    );
                                });
                        });
                    });
                }
            }
        ])->get();

        $grandTotalQty = 0;
        $grandTotalSales = 0;
        $grandTotalDiscount = 0;
        $grandItemsDiscount = 0;
        $invoice_total = 0;
        $invoice_total_vat = 0;
        $paymentMethodTotals = [];
        $cashTotal = 0;
        $cardTotal = 0;

        // Get all invoice IDs from the invoice items to calculate proper totals
        $allInvoiceIds = [];
        foreach ($allCategories as $category) {
            $products = $category->products ?? collect([]);
            $invoiceItems = $products->flatMap(fn($p) => $p->invoiceItems ?? collect([]));

            if (!$includeChildCategories) {
                $childProducts = $category->children->flatMap(fn($child) => $child->products ?? collect([]));
                $products = $products->merge($childProducts);
                $invoiceItems = $products->flatMap(fn($p) => $p->invoiceItems ?? collect([]));
            }

            $grandTotalQty += $invoiceItems->sum('qty');
            $grandTotalSales += $invoiceItems->sum('total');
            $grandItemsDiscount += $invoiceItems->sum('discount');

            
            // Collect invoice IDs for discount calculation
            $invoiceIds = $invoiceItems->pluck('invoice_id')->filter()->unique();
            $allInvoiceIds = array_merge($allInvoiceIds, $invoiceIds->toArray());
        }

        // Calculate invoice-level discounts
        if (!empty($allInvoiceIds)) {
            $filteredInvoiceIds = array_values(array_unique($allInvoiceIds));

            $invoiceDiscounts = Invoice::whereIn('id', $filteredInvoiceIds)
                ->where('type', 'sale')
                ->sum('discount');
            $grandTotalDiscount = $invoiceDiscounts;
            $invoice_total = Invoice::whereIn('id', $filteredInvoiceIds)
                ->where('type', 'sale')
                ->sum('total');

            $invoice_total_vat = Invoice::whereIn('id', $filteredInvoiceIds)
                ->where('type', 'sale')
                ->sum('vat');

            $transactionTotals = Transaction::query()
                ->whereIn('invoice_id', $filteredInvoiceIds)
                ->whereNotNull('payment_method')
                ->where('amount', '>', 0)
                ->selectRaw('TRIM(payment_method) as payment_method, SUM(amount) as amount')
                ->groupBy(DB::raw('TRIM(payment_method)'))
                ->get();

            foreach ($transactionTotals as $row) {
                $methodName = trim((string) $row->payment_method);
                if ($methodName === '') {
                    continue;
                }
                $paymentMethodTotals[$methodName] =
                    ($paymentMethodTotals[$methodName] ?? 0) + (float) $row->amount;
            }

            // Fallback for legacy invoices without transaction rows.
            $invoiceFallbackTotals = Invoice::query()
                ->whereIn('id', $filteredInvoiceIds)
                ->where('type', 'sale')
                ->whereNotNull('payment_method')
                ->where('paid_amount', '>', 0)
                ->whereDoesntHave('transactions')
                ->selectRaw('TRIM(payment_method) as payment_method, SUM(paid_amount) as amount')
                ->groupBy(DB::raw('TRIM(payment_method)'))
                ->get();

            foreach ($invoiceFallbackTotals as $row) {
                $methodName = trim((string) $row->payment_method);
                if ($methodName === '') {
                    continue;
                }
                $paymentMethodTotals[$methodName] =
                    ($paymentMethodTotals[$methodName] ?? 0) + (float) $row->amount;
            }
        }

        foreach ($paymentMethodTotals as $methodName => $amount) {
            $method = strtolower($methodName);
            $isCash = in_array($method, ['cash', 'cash on delivery', 'cod']);
            $isCard = str_contains($method, 'card') || in_array($method, ['credit card', 'debit card', 'visa', 'mastercard']);
            if ($isCash) {
                $cashTotal += $amount;
            } elseif ($isCard) {
                $cardTotal += $amount;
            }
        }


        return response()->json(
            [
                'status' => 1,
                'message' => 'Category-wise sales fetched successfully',
                'data' => $data,
                'others' => [
                    'total_qty_sold' => $grandTotalQty,
                    'total_sales' => $grandTotalSales,
                    'total_discount' => $grandTotalDiscount,
                    'invoice_total' => $invoice_total,
                    'items_discount' => $grandItemsDiscount,
                    'invoice_total_vat' => $invoice_total_vat,
                    'payment_method_totals' => $paymentMethodTotals,
                    'cash_total' => $cashTotal,
                    'card_total' => $cardTotal,
                ],
                'meta' => [
                    'current_page' => $categories->currentPage(),
                    'per_page' => $categories->perPage(),
                    'total' => $categories->total(),
                    'last_page' => $categories->lastPage(),
                ],
            ],
            200
        );
    }

    public function duePaymentsList(Request $request)
    {
        $perPage = $request->input('perPage', 20); // Default to 20 items per page
        $page = $request->input('page', 1);
        $filterText = $request->input('filterText', '');
        $filterWarehouse = $request->input('filterWarehouse', '');
        $filterUser = $request->input('filterUser', '');
        $filterType = $request->input('filterType', '');
        $filterStatus = $request->input('statusFilter', ''); // Changed from 'status' to match frontend
        $startDate = $request->input('startDate', '');
        $endDate = $request->input('endDate', '');
        $sortField = $request->input('sortField', 'created_at'); // Default to 'created_at'
        $sortOrder = $request->input('sortOrder', 'desc'); // Default to descending

        $query = Invoice::with('items.product', 'supplier', 'customer', 'paymentSchedules');
        $allowedDueTypes = ['sale', 'purchase'];

        // Apply filters
        if (!empty($filterText)) {
            $query->where(function ($q) use ($filterText) {
                $q->where('invoice_no', 'LIKE', "%{$filterText}%");
            });
        }

        // Due payment report should only include payable invoices, not quotations/drafts/returns.
        $query->whereIn('type', $allowedDueTypes);

        if (!empty($filterType)) {
            if (in_array($filterType, $allowedDueTypes, true)) {
                $query->where('type', $filterType);
            }
        }

        if (!empty($filterStatus)) {
            if ($filterStatus == 'unpaid') {
                $query->where('payment_status', 0);
            } else if ($filterStatus == 'partially_paid') {
                $query->where('payment_status', 2);
            }
        } else {
            $query->whereIn('payment_status', [0, 2]);
        }

        if ($filterWarehouse) {
            $query->where('warehouse_id', $filterWarehouse);
        }

        if ($filterUser) {
            $query->where('user_id', $filterUser);
        }

        if (!empty($startDate)) {
            $query->whereDate('date', '>=', $startDate);
        }

        if (!empty($endDate)) {
            $query->whereDate('date', '<=', $endDate);
        }

        // Apply sorting
        $query->orderBy($sortField, $sortOrder);

        // Fetch paginated data
        $invoices = $query->paginate($perPage, ['*'], 'page', $page);

        // Transform result for API
        $data = $invoices->map(function ($invoice) {
            return [
                'id' => $invoice->id,
                'type' => $invoice->type,
                'company_id' => $invoice->company_id ?? null,
                'user_id' => $invoice->user_id,
                'warehouse_id' => $invoice->warehouse_id,
                'invoice_no' => $invoice->invoice_no ?? null,
                'date' => $invoice->date ? date('d F, Y', strtotime($invoice->date)) : null,
                'qty' => $invoice->qty,
                'discount' => $invoice->discount,
                'tax_rate' => $invoice->tax_rate,
                'tax' => $invoice->tax,
                'vat_rate' => $invoice->vat_rate,
                'vat' => $invoice->vat,
                'total' => $invoice->total,
                'sub_total' => $invoice->sub_total,
                'note' => $invoice->note,
                'paid_amount' => $invoice->paid_amount,
                'payment_status' => $invoice->payment_status,
                'isFracture' => $invoice->isFracture,
                'payment_method' => $invoice->payment_method,
                'due_amount' => $invoice->due_amount,
                'return_amount' => $invoice->return_amount,
                'change_due' => $invoice->change_due,
                'status' => $invoice->payment_status, // Changed to payment_status to match frontend
                'customer' =>  [
                    'id' => $invoice?->customer?->id,
                    'name' => $invoice?->customer?->first_name . ' ' . $invoice?->customer?->last_name,
                    'phone' =>  $invoice?->customer?->phone,
                    'email' =>  $invoice?->customer?->email,
                ],
                'supplier' =>  [
                    'id' => $invoice?->supplier?->id,
                    'name' => $invoice?->supplier?->name ?? null,
                    'phone' =>  $invoice?->supplier?->phone,
                    'email' =>  $invoice?->supplier?->email,
                ],
                'items' => $invoice->items,
                'payment_schedules' => $invoice->paymentSchedules
            ];
        });

        $invoices->setCollection($data);

        return response()->json([
            'status' => 1,
            'message' => 'Invoice fetched successfully',
            'data' => $invoices->items(),
            'meta' => [
                'current_page' => $invoices->currentPage(),
                'per_page' => $invoices->perPage(),
                'total' => $invoices->total(),
                'last_page' => $invoices->lastPage(),
            ],
            'others_data' => [],
        ], 200);
    }

    public function productLedger(Request $request)
    {
        $request->validate([
            'product_id'         => 'required|string|exists:product,id',
            'variant_selection'  => 'nullable|array',
            'variant_selection.*'=> 'nullable|string',
            'startDate'         => 'nullable|date',
            'endDate'           => 'nullable|date',
            'type'               => 'nullable|in:purchase,sale,stock_adjustment,return',
            'page'               => 'nullable|integer|min:1',
            'per_page'           => 'nullable|integer|min:1|max:100',
        ]);

        $productId   = $request->product_id;
        $variantSel  = $request->input('variant_selection', []);
        $startDate   = $request->startDate;
        $endDate     = $request->endDate;
        $typeFilter  = $request->type;
        $perPage     = $request->get('per_page', 50);

        // Build variant JSON string for exact match
        $variantJson = null;
        if (!empty($variantSel)) {
            $clean = array_filter($variantSel, fn($v) => $v !== null && $v !== '');
            if ($clean) {
                $variantJson = json_encode($clean, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
        }

        // Main Query: Start from InvoiceItem → join with Invoice for correct data
        $query = InvoiceItem::query()
            ->with([
                'invoice', // Load only needed fields
                'invoice.customer',   // If customer is User
                'invoice.supplier',   // If supplier is Supplier model
                'inventory_item'
            ])
            ->where('product_id', $productId)
            ->when($variantJson, fn($q) => $q->where('variant_id', $variantJson))
            // CORRECT DATE FILTERING
            ->when($startDate || $endDate, function ($q) use ($startDate, $endDate) {
                $q->whereHas('invoice', function ($sq) use ($startDate, $endDate) {
                    if ($startDate) {
                        $sq->whereDate('date', '>=', $startDate);
                    }
                    if ($endDate) {
                        $sq->whereDate('date', '<=', $endDate);
                    }
                });
            })
            ->when($typeFilter, fn($q) => $q->where('type', $typeFilter))
            ->select([
                'invoice_items.id',
                'invoice_items.company_id',
                'invoice_items.variant_id',
                'invoice_items.date',
                'invoice_items.type',
                'invoice_items.invoice_id',
                'invoice_items.qty',
                'invoice_items.lot_number',
                'invoice_items.created_at',
                'invoice_items.unit_price',
            ])
            ->orderBy('invoice_items.date', 'asc')
            ->orderBy('invoice_items.created_at', 'asc');

        // Paginate
        $items = $query->paginate($perPage);

        // Transform with running balance
        $balance   = 0;
        $totalIn   = 0;
        $totalOut  = 0;

        $ledger = $items->getCollection()->map(function ($item) use (&$balance, &$totalIn, &$totalOut) {
            $qty = (int) $item->qty;

            // Determine In / Out
            if ($item->type === 'purchase') {
                $in  = $qty;
                $out = 0;
                $totalIn += $in;
            } elseif ($item->type === 'sale') {
                $in  = 0;
                $out = $qty;
                $totalOut += $out;
            } else {
                $in  = $qty > 0 ? $qty : 0;
                $out = $qty < 0 ? abs($qty) : 0;
                $totalIn  += $in;
                $totalOut += $out;
            }

            $balance += $in - $out;

            // === VARIANT DISPLAY LOGIC ===
            $variantDisplay = '-';

            if ($item->variant_id) {
                $variantDisplay = collect($item->variant_id ?? [])
                            ->map(fn($val, $key) => ucfirst($key) . ': ' . $val)
                            ->implode(', ') ?: 'N/A';
            }

            // === CUSTOMER / SUPPLIER NAME ===
            $invoice = $item->invoice;

            $reference = $item->type === 'purchase'
                ? ($invoice?->supplier?->name ?? 'Walk-in Supplier')
                : (
                    $invoice?->customer
                        ? trim($invoice->customer->first_name . ' ' . $invoice->customer->last_name) ?: 'Walk-in Customer'
                        : 'Walk-in Customer'
                );

            return [
                'date'        => $item->date,
                'type'        => $item->type,
                'invoice_no'  => $invoice?->invoice_no ?? '#DELETED',
                'reference'   => $reference,
                'in_qty'      => $in,
                'out_qty'     => $out,
                'balance'     => $balance,
                'variant'     => $variantDisplay,        // ← NEW FIELD
                'notes'       => $item->lot_number ?? '', // or $item->note if you prefer
                'unit_price'  => $item->unit_price
            ];
        });

        // Replace collection
        $items->setCollection(collect($ledger));

        return response()->json([
            'status' => true,
            'data'   => $ledger,
            'summary' => [
                'current_stock' => $balance,
                'total_in'      => $totalIn,
                'total_out'     => $totalOut,
            ],
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page'    => $items->lastPage(),
                'per_page'     => $items->perPage(),
                'total'        => $items->total(),
            ]
        ]);
    }

    // time sheefint report 
    public function timesheetReport(Request $request)
    {
        $perPage = $request->input('perPage', 15);
        $search = $request->input('search');
        $cashierId = $request->input('cashier_id');
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');
        $status = $request->input('shift_status'); // active, closed

        $user = Auth::user();
        // Main query for paginated shifts
        $query = Timesheet::query()
            ->with(['subjectUser:id,first_name,last_name', 'sourceUser:id,first_name,last_name'])
            ->select([
                'id',
                'subject_user_id',
                'source_user_id',
                'start_time',
                'end_time',
                'cash_in_hand',
                'cash_out_hand',
                'comments',
                DB::raw('TIMEDIFF(end_time, start_time) as duration')
            ])
            ->where('subject_user_id', $user->id)
            ->orderBy('start_time', 'desc');

        // Search
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->whereHas('subjectUser', function ($q) use ($search) {
                    $q->whereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"])
                    ->orWhere('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%");
                })->orWhere('comments', 'like', "%{$search}%");
            });
        }

        // Filters
        if ($cashierId) {
            $query->where('subject_user_id', $cashierId);
        }

        if ($dateFrom) {
            $query->whereDate('start_time', '>=', $dateFrom);
        }

        if ($dateTo) {
            $query->whereDate('start_time', '<=', $dateTo);
        }

        if ($status === 'active') {
            $query->whereNull('end_time');
        } elseif ($status === 'closed') {
            $query->whereNotNull('end_time');
        }

        // Clone query for summary and RESET the select
        $summaryQuery = clone $query;
        $summaryQuery->getQuery()->columns = null; // Clear existing select columns
        $summaryQuery->getQuery()->orders = null;  // Clear order by
        $summaryQuery->getQuery()->limit = null;   // Clear limit if any
        $summaryQuery->getQuery()->offset = null;  // Clear offset if any

        $summaryQuery->selectRaw('
            COUNT(*) as total_shifts,
            COALESCE(SUM(cash_in_hand), 0) as total_cash_in,
            COALESCE(SUM(cash_out_hand), 0) as total_cash_out
        ');
        // Get paginated results
        $shifts = $query->paginate($perPage);

        // Get summary (this is now a clean aggregate query)
        $summary = $summaryQuery->first();

        $summary->net_cash = $summary->total_cash_out - $summary->total_cash_in;

        $handoverLogsQuery = DB::table('timesheet_cash_handovers as tch')
            ->leftJoin('user as cashier', function ($join) {
                $join->whereRaw('BINARY cashier.id = BINARY tch.cashier_user_id');
            })
            ->leftJoin('user as receiver', function ($join) {
                $join->whereRaw('BINARY receiver.id = BINARY tch.received_by_user_id');
            })
            ->leftJoin('timesheet as ts', 'ts.id', '=', 'tch.timesheet_id')
            ->select([
                'tch.id',
                'tch.timesheet_id',
                'tch.cashier_user_id',
                'tch.received_by_user_id',
                'tch.amount',
                'tch.notes',
                'tch.created_at',
                DB::raw("CONCAT(COALESCE(cashier.first_name, ''), ' ', COALESCE(cashier.last_name, '')) as cashier_name"),
                DB::raw("CONCAT(COALESCE(receiver.first_name, ''), ' ', COALESCE(receiver.last_name, '')) as receiver_name"),
                'ts.start_time as shift_start_time',
                'ts.end_time as shift_end_time',
            ])
            ->whereRaw('BINARY tch.company_id = ?', [$user->company_id]);

        if ($cashierId) {
            $handoverLogsQuery->whereRaw('BINARY tch.cashier_user_id = ?', [$cashierId]);
        }

        if ($dateFrom) {
            $handoverLogsQuery->whereDate('tch.created_at', '>=', $dateFrom);
        }
        if ($dateTo) {
            $handoverLogsQuery->whereDate('tch.created_at', '<=', $dateTo);
        }

        if ($search) {
            $handoverLogsQuery->where(function ($q) use ($search) {
                $q->where('tch.notes', 'like', "%{$search}%")
                    ->orWhereRaw("CONCAT(COALESCE(cashier.first_name, ''), ' ', COALESCE(cashier.last_name, '')) LIKE ?", ["%{$search}%"])
                    ->orWhereRaw("CONCAT(COALESCE(receiver.first_name, ''), ' ', COALESCE(receiver.last_name, '')) LIKE ?", ["%{$search}%"]);
            });
        }

        $cashHandoverLogs = $handoverLogsQuery
            ->orderByDesc('tch.created_at')
            ->limit(100)
            ->get();

        return response()->json([
            'status' => true,
            'data' => $shifts->items(),
            'cash_handover_logs' => $cashHandoverLogs,
            'meta' => [
                'current_page' => $shifts->currentPage(),
                'last_page' => $shifts->lastPage(),
                'per_page' => $shifts->perPage(),
                'total' => $shifts->total(),
            ],
            'summary' => $summary,
        ]);
    }
    /**
     * Get list of cashiers who have ever worked a shift
     */
    public function cashiers(Request $request)
    {
        $authUser = Auth::user();

        $cashiers = User::query()
            ->when($authUser && !$authUser->isSuperAdmin(), fn($q) => $q->where('company_id', $authUser->company_id))
            ->where(function ($q) {
                $q->whereHas('shifts')
                    ->orWhereHas('receivedShifts', fn($shiftQuery) => $shiftQuery->from('timesheet')->whereColumn('source_user_id', 'user.id'));
            })
            ->orderBy('first_name')
            ->get();

        // Fallback: all users with role cashier (adjust role name as per your system)
        if ($cashiers->isEmpty()) {
            $cashiers = User::query()
                ->when($authUser && !$authUser->isSuperAdmin(), fn($q) => $q->where('company_id', $authUser->company_id))
                ->where('role', 'cashier')
                ->where('role', '<>', 2)
                ->orderBy('first_name')
                ->get();
        }

        return response()->json([
            'status' => true,
            'data' => $cashiers,
        ]);
    }

    /**
     * Verify product return by unified search (invoice first, then barcode)
     */
    public function verifyProductReturn(Request $request)
    {
        $request->validate([
            'search_value' => 'required|string',
        ]);

        $searchValue = $request->search_value;
        $companyId = Auth::user()->company_id;

        try {
            // First try to search by invoice number
            $results = InventoryHistory::with([
                'product' => function($query) {
                    $query->select('id', 'name', 'description', 'code', 'category_id', 'brand_id');
                },
                'product.category' => function($query) {
                    $query->select('id', 'title');
                },
                'product.brand' => function($query) {
                    $query->select('id', 'title');
                },
                'invoice' => function($query) {
                    $query->select('id', 'invoice_no', 'date', 'total', 'discount', 'customer_id');
                },
                'invoice.customer' => function($query) {
                    $query->select('id', 'first_name', 'last_name', 'phone', 'email');
                },
                'createdBy' => function($query) {
                    $query->select('id', 'first_name', 'last_name');
                }
            ])
            ->where('company_id', $companyId)
            ->where('type', 'sale')
            ->whereHas('invoice', function($query) use ($searchValue) {
                $query->where('invoice_no', 'like', '%' . $searchValue . '%');
            })
            ->orderBy('created_at', 'desc')
            ->get();

            // If no results from invoice search, try barcode search
            if ($results->isEmpty()) {
                $results = InventoryHistory::with([
                    'product' => function($query) {
                        $query->select('id', 'name', 'description', 'code', 'category_id', 'brand_id');
                    },
                    'product.category' => function($query) {
                        $query->select('id', 'title');
                    },
                    'product.brand' => function($query) {
                        $query->select('id', 'title');
                    },
                    'invoice' => function($query) {
                        $query->select('id', 'invoice_no', 'date', 'total', 'discount', 'customer_id');
                    },
                    'invoice.customer' => function($query) {
                        $query->select('id', 'first_name', 'last_name', 'phone', 'email');
                    },
                    'createdBy' => function($query) {
                        $query->select('id', 'first_name', 'last_name');
                    }
                ])
                ->where('company_id', $companyId)
                ->where('type', 'sale')
                ->where('barcode', 'like', '%' . $searchValue . '%')
                ->orderBy('created_at', 'desc')
                ->get();
            }

            if ($results->isEmpty()) {
                return response()->json([
                    'status' => false,
                    'message' => 'No sales records found for the given search value',
                    'data' => []
                ]);
            }

            $returnedQtyMapWithLot = collect();
            $returnedQtyMapNoLot = collect();
            if (Schema::hasTable('sales_returns') && Schema::hasTable('sales_return_items')) {
                $invoiceIds = $results->pluck('invoice_id')->filter()->unique()->values()->all();
                if (!empty($invoiceIds)) {
                    $returnedRows = DB::table('sales_return_items')
                        ->join('sales_returns', 'sales_returns.id', '=', 'sales_return_items.sales_return_id')
                        ->whereIn('sales_returns.original_invoice_id', $invoiceIds)
                        ->whereNull('sales_returns.deleted_at')
                        ->whereNull('sales_return_items.deleted_at')
                        ->selectRaw('sales_returns.original_invoice_id, sales_return_items.product_id, COALESCE(sales_return_items.lot_number, "") as lot_number, SUM(ABS(sales_return_items.return_qty)) as returned_qty')
                        ->groupBy('sales_returns.original_invoice_id', 'sales_return_items.product_id', 'sales_return_items.lot_number')
                        ->get();

                    $returnedQtyMapWithLot = $returnedRows->mapWithKeys(function ($row) {
                            $key = $row->original_invoice_id . '|' . $row->product_id . '|' . ($row->lot_number ?? '');
                            return [$key => (float) $row->returned_qty];
                        });

                    $returnedQtyMapNoLot = $returnedRows
                        ->groupBy(function ($row) {
                            return $row->original_invoice_id . '|' . $row->product_id;
                        })
                        ->map(function ($group) {
                            return (float) collect($group)->sum('returned_qty');
                        });
                }
            }

            // Format the results for better frontend display
            $formattedResults = $results->map(function($item) use ($returnedQtyMapWithLot, $returnedQtyMapNoLot) {
                $lotNumber = (string) ($item->lot_number ?? '');
                $invoiceProductKey = ($item->invoice_id ?? '') . '|' . ($item->product_id ?? '');
                $returnedKeyWithLot = $invoiceProductKey . '|' . $lotNumber;
                $returnedQtyFromSalesReturn = (float) ($returnedQtyMapWithLot->get($returnedKeyWithLot, 0));
                if ($returnedQtyFromSalesReturn <= 0) {
                    $returnedQtyFromSalesReturn = (float) ($returnedQtyMapNoLot->get($invoiceProductKey, 0));
                }

                $returnedQtyFromInvoiceItems = abs((float) InvoiceItem::query()
                    ->where('type', 'return')
                    ->where('product_id', $item->product_id)
                    ->when(!empty($item->lot_number), fn($q) => $q->where('lot_number', $item->lot_number))
                    ->whereHas('invoice', function($query) use ($item) {
                        $query->where('original_invoice_id', $item->invoice_id);
                    })
                    ->sum('qty'));

                $returnedQty = max($returnedQtyFromSalesReturn, $returnedQtyFromInvoiceItems);

                return [
                    'id' => $item->id,
                    'invoice_no' => $item->invoice?->invoice_no,
                    'invoice_date' => $item->invoice?->date,
                    'product_name' => $item->product?->name,
                    'product_description' => strip_tags((string) ($item->product?->description ?? '')),
                    'product_code' => $item->product?->code,
                    'barcode' => $item->barcode,
                    'category' => $item->product?->category?->title,
                    'brand' => $item->product?->brand?->title,
                    'variant' => $item->variant,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'original_unit_price' => $item->original_unit_price,
                    'discount' => $item->discount,
                    'discount_amount' => $item->discount_amount,
                    'total' => $item->total,
                    'is_returned' => $returnedQty > 0,
                    'returned_qty' => $returnedQty,
                    'customer_name' => $item->invoice?->customer ? 
                        trim($item->invoice->customer->first_name . ' ' . $item->invoice->customer->last_name) : 
                        'Walk-in Customer',
                    'customer_phone' => $item->invoice?->customer?->phone,
                    'customer_email' => $item->invoice?->customer?->email,
                    'sold_by' => $item->createdBy ? 
                        trim($item->createdBy->first_name . ' ' . $item->createdBy->last_name) : 
                        'Unknown',
                    'created_at' => $item->created_at,
                    'invoice_total' => $item->invoice?->total,
                    'invoice_discount' => $item->invoice?->discount,
                ];
            });

            return response()->json([
                'status' => true,
                'message' => 'Sales records found successfully',
                'data' => $formattedResults,
                'count' => $formattedResults->count()
            ]);

        } catch (\Exception $e) {
            Log::error('Product return verification error: ' . $e->getMessage());
            
            return response()->json([
                'status' => false,
                'message' => 'An error occurred while verifying the product return',
                'error' => config('app.debug') ? $e->getMessage() : 'Server error'
            ], 500);
        }
    }

    public function profitMarginReport(Request $request)
    {
        $perPage = $request->input('perPage', 20);
        $page = $request->input('page', 1);
        $filterText = $request->input('search', '');
        $filterWarehouse = $request->input('warehouse', '');
        $dateFrom = $request->input('date_from', '');
        $dateTo = $request->input('date_to', '');
        $filterCategory = $request->input('category', '');
        $includeChildCategories = $request->input('include_child_categories', 0);
        $paymentMethod = $request->input('payment_method', '');
        $normalizedPaymentMethod = strtolower(trim((string) $paymentMethod));
        $groupBy = $request->input('groupBy', 'category'); // 'category' or 'product'

        $lineCostCalculator = function ($item) {
            $qty = (float) ($item->qty ?? 0);
            if ($qty <= 0) {
                return 0.0;
            }

            // Prefer explicit matched inventory item cost first.
            $purchasePrice = (float) ($item->inventoryItem->purchase_price ?? 0);
            if ($purchasePrice <= 0) {
                $purchasePrice = (float) ($item->inventory_item->purchase_price ?? 0);
            }

            // Fallback by inventory_id + product_id to get the latest known purchase cost.
            if ($purchasePrice <= 0 && !empty($item->inventory_id)) {
                $fallbackPurchasePrice = InventoryItem::query()
                    ->where('inventory_id', $item->inventory_id)
                    ->when(!empty($item->product_id), function ($q) use ($item) {
                        $q->where('product_id', $item->product_id);
                    })
                    ->orderByDesc('created_at')
                    ->value('purchase_price');

                $purchasePrice = (float) ($fallbackPurchasePrice ?? 0);
            }

            // Last fallback: no profit assumption avoids artificial fixed margins.
            if ($purchasePrice <= 0) {
                $purchasePrice = (float) ($item->unit_price ?? 0);
            }

            return $qty * $purchasePrice;
        };

        // Helper function to collect category IDs including children
        $collectCategoryIds = function ($rootId) {
            $categoryIds = [$rootId];
            $queue = [$rootId];

            while (!empty($queue)) {
                $current = array_shift($queue);
                $children = Category::where('ancestor_id', $current)->pluck('id')->toArray();
                foreach ($children as $childId) {
                    if (!in_array($childId, $categoryIds, true)) {
                        $categoryIds[] = $childId;
                        $queue[] = $childId;
                    }
                }
            }

            return $categoryIds;
        };

        // Filter for invoice items
        $invoiceItemFilters = function ($q) use ($filterWarehouse, $dateFrom, $dateTo, $paymentMethod, $normalizedPaymentMethod) {
            $q->where('type', 'sale');
            
            if (!empty($filterWarehouse)) {
                $q->where('warehouse_id', $filterWarehouse);
            }
            
            if (!empty($dateFrom) && !empty($dateTo)) {
                $q->whereBetween('date', [$dateFrom, $dateTo . ' 23:59:59']);
            }
            
            if (!empty($paymentMethod)) {
                $q->whereHas('invoice', function ($invoiceQuery) use ($paymentMethod, $normalizedPaymentMethod) {
                    $invoiceQuery->where(function ($innerInvoiceQuery) use ($paymentMethod, $normalizedPaymentMethod) {
                        $innerInvoiceQuery
                            ->whereRaw('LOWER(TRIM(payment_method)) = ?', [$normalizedPaymentMethod])
                            ->orWhereHas('transactions', function ($transactionQuery) use ($normalizedPaymentMethod) {
                                $transactionQuery->whereRaw(
                                    'LOWER(TRIM(payment_method)) = ?',
                                    [$normalizedPaymentMethod]
                                );
                            });
                    });
                });
            }
        };

        if ($groupBy === 'product') {
            // Product-wise profit margin report
            $query = Product::query();

            if (!empty($filterCategory)) {
                $categoryIds = $includeChildCategories
                    ? $collectCategoryIds($filterCategory)
                    : [$filterCategory];
                $query->whereIn('category_id', $categoryIds);
            }

            if (!empty($filterText)) {
                $query->where('name', 'LIKE', "%{$filterText}%");
            }

            $query->with([
                'category',
                'invoiceItems' => $invoiceItemFilters,
                'invoiceItems.inventory_item',
                'invoiceItems.inventoryItem'
            ]);

            $products = $query->paginate($perPage, ['*'], 'page', $page);

            $data = $products->getCollection()->map(function ($product) use ($lineCostCalculator) {
                $invoiceItems = $product->invoiceItems ?? collect([]);
                
                $totalSales = $invoiceItems->sum('total');
                $totalCost = 0;
                $totalQtySold = $invoiceItems->sum('qty');

                // Calculate cost based on inventory items
                foreach ($invoiceItems as $item) {
                    $totalCost += $lineCostCalculator($item);
                }

                $profit = $totalSales - $totalCost;
                $profitMargin = $totalSales > 0 ? ($profit / $totalSales) * 100 : 0;
                $profitOnCostMargin = $totalCost > 0 ? ($profit / $totalCost) * 100 : 0;

                return [
                    'product_name' => $product->name ?? 'Unknown Product',
                    'category' => $product->category->title ?? 'Unknown Category',
                    'total_sales' => $totalSales,
                    'total_cost' => $totalCost,
                    'profit' => $profit,
                    'profit_margin' => $profitMargin,
                    'profit_on_cost_margin' => $profitOnCostMargin,
                    'total_qty_sold' => $totalQtySold,
                ];
            });

            // Calculate grand totals for all products
            $allProductsQuery = Product::query();
            
            if (!empty($filterCategory)) {
                $categoryIds = $includeChildCategories
                    ? $collectCategoryIds($filterCategory)
                    : [$filterCategory];
                $allProductsQuery->whereIn('category_id', $categoryIds);
            }
            
            if (!empty($filterText)) {
                $allProductsQuery->where('name', 'LIKE', "%{$filterText}%");
            }

            $allProducts = $allProductsQuery->with([
                'invoiceItems' => $invoiceItemFilters,
                'invoiceItems.inventory_item',
                'invoiceItems.inventoryItem'
            ])->get();

            $grandTotalSales = 0;
            $grandTotalCost = 0;
            $grandTotalQtySold = 0;

            foreach ($allProducts as $product) {
                $invoiceItems = $product->invoiceItems ?? collect([]);
                $grandTotalSales += $invoiceItems->sum('total');
                $grandTotalQtySold += $invoiceItems->sum('qty');

                foreach ($invoiceItems as $item) {
                    $grandTotalCost += $lineCostCalculator($item);
                }
            }

            $grandTotalProfit = $grandTotalSales - $grandTotalCost;

        } else {
            // Category-wise profit margin report
            $baseQuery = Category::query();

            if (!$includeChildCategories) {
                $baseQuery->whereNull('ancestor_id');
            }

            if (!empty($filterCategory)) {
                $categoryIds = $includeChildCategories
                    ? $collectCategoryIds($filterCategory)
                    : [$filterCategory];
                $baseQuery->whereIn('id', $categoryIds);
            }

            if (!empty($filterText)) {
                $baseQuery->where('title', 'LIKE', "%{$filterText}%");
            }

            $query = clone $baseQuery;
            $query->with([
                'products.invoiceItems' => $invoiceItemFilters,
                'products.invoiceItems.inventory_item',
                'products.invoiceItems.inventoryItem',
                'children.products.invoiceItems' => $invoiceItemFilters,
                'children.products.invoiceItems.inventory_item',
                'children.products.invoiceItems.inventoryItem'
            ]);

            $categories = $query->paginate($perPage, ['*'], 'page', $page);

            $data = $categories->getCollection()->map(function ($category) use ($includeChildCategories, $lineCostCalculator) {
                $products = $category->products ?? collect([]);
                $invoiceItems = $products->flatMap(fn($p) => $p->invoiceItems ?? collect([]));

                if (!$includeChildCategories) {
                    $childProducts = $category->children->flatMap(fn($child) => $child->products ?? collect([]));
                    $products = $products->merge($childProducts);
                    $invoiceItems = $products->flatMap(fn($p) => $p->invoiceItems ?? collect([]));
                }

                $totalSales = $invoiceItems->sum('total');
                $totalCost = 0;
                $totalQtySold = $invoiceItems->sum('qty');

                // Calculate cost based on inventory items
                foreach ($invoiceItems as $item) {
                    $totalCost += $lineCostCalculator($item);
                }

                $profit = $totalSales - $totalCost;
                $profitMargin = $totalSales > 0 ? ($profit / $totalSales) * 100 : 0;
                $profitOnCostMargin = $totalCost > 0 ? ($profit / $totalCost) * 100 : 0;

                return [
                    'category' => $category->title ?? 'Unknown Category',
                    'total_sales' => $totalSales,
                    'total_cost' => $totalCost,
                    'profit' => $profit,
                    'profit_margin' => $profitMargin,
                    'profit_on_cost_margin' => $profitOnCostMargin,
                    'total_qty_sold' => $totalQtySold,
                ];
            });

            // Calculate grand totals for all categories
            $allCategories = $baseQuery->with([
                'products.invoiceItems' => $invoiceItemFilters,
                'products.invoiceItems.inventory_item',
                'products.invoiceItems.inventoryItem',
                'children.products.invoiceItems' => $invoiceItemFilters,
                'children.products.invoiceItems.inventory_item',
                'children.products.invoiceItems.inventoryItem'
            ])->get();

            $grandTotalSales = 0;
            $grandTotalCost = 0;
            $grandTotalQtySold = 0;

            foreach ($allCategories as $category) {
                $products = $category->products ?? collect([]);
                $invoiceItems = $products->flatMap(fn($p) => $p->invoiceItems ?? collect([]));

                if (!$includeChildCategories) {
                    $childProducts = $category->children->flatMap(fn($child) => $child->products ?? collect([]));
                    $products = $products->merge($childProducts);
                    $invoiceItems = $products->flatMap(fn($p) => $p->invoiceItems ?? collect([]));
                }

                $grandTotalSales += $invoiceItems->sum('total');
                $grandTotalQtySold += $invoiceItems->sum('qty');

                foreach ($invoiceItems as $item) {
                    $grandTotalCost += $lineCostCalculator($item);
                }
            }

            $grandTotalProfit = $grandTotalSales - $grandTotalCost;
        }

        return response()->json([
            'status' => 1,
            'message' => 'Profit margin report fetched successfully',
            'data' => $data,
            'others' => [
                'total_sales' => $grandTotalSales,
                'total_cost' => $grandTotalCost,
                'total_profit' => $grandTotalProfit,
                'total_profit_margin' => $grandTotalSales > 0 ? ($grandTotalProfit / $grandTotalSales) * 100 : 0,
                'total_profit_on_cost_margin' => $grandTotalCost > 0 ? ($grandTotalProfit / $grandTotalCost) * 100 : 0,
                'total_qty_sold' => $grandTotalQtySold,
            ],
            'meta' => [
                'current_page' => $groupBy === 'product' ? $products->currentPage() : $categories->currentPage(),
                'per_page' => $groupBy === 'product' ? $products->perPage() : $categories->perPage(),
                'total' => $groupBy === 'product' ? $products->total() : $categories->total(),
                'last_page' => $groupBy === 'product' ? $products->lastPage() : $categories->lastPage(),
            ],
        ], 200);
    }

    public function expireProductReport(Request $request)
    {
        $perPage = max((int) $request->input('perPage', 20), 1);
        $page = max((int) $request->input('page', 1), 1);
        $search = trim((string) $request->input('search', ''));
        $warehouseId = (string) $request->input('warehouse_id', '');
        $status = (string) $request->input('status', 'all'); // all|expired|expiring
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');
        $daysToExpire = max((int) $request->input('days_to_expire', 30), 0);

        $today = now()->startOfDay();
        $expireUntil = now()->startOfDay()->addDays($daysToExpire);

        $query = InventoryItem::query()
            ->with(['product:id,name,code', 'warehouse:id,name'])
            ->where('quantity', '>', 0)
            ->whereNotNull('expiry_date');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('lot_number', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhereHas('product', function ($pq) use ($search) {
                        $pq->where('name', 'like', "%{$search}%")
                            ->orWhere('code', 'like', "%{$search}%");
                    });
            });
        }

        if ($warehouseId !== '') {
            $query->where('warehouse_id', $warehouseId);
        }

        if (!empty($dateFrom)) {
            $query->whereDate('expiry_date', '>=', $dateFrom);
        }

        if (!empty($dateTo)) {
            $query->whereDate('expiry_date', '<=', $dateTo);
        }

        if ($status === 'expired') {
            $query->whereDate('expiry_date', '<', $today);
        } elseif ($status === 'expiring') {
            $query->whereDate('expiry_date', '>=', $today)
                ->whereDate('expiry_date', '<=', $expireUntil);
        }

        $paginator = $query->orderBy('expiry_date')->paginate($perPage, ['*'], 'page', $page);

        $rows = collect($paginator->items())->map(function ($item) use ($today) {
            $expiryDate = \Carbon\Carbon::parse($item->expiry_date)->startOfDay();
            $daysLeft = (int) $today->diffInDays($expiryDate, false);

            return [
                'id' => $item->id,
                'product_name' => $item->product?->name ?? 'N/A',
                'product_code' => $item->product?->code ?? 'N/A',
                'warehouse_name' => $item->warehouse?->name ?? 'N/A',
                'lot_number' => $item->lot_number,
                'barcode' => $item->barcode,
                'sku' => $item->sku,
                'quantity' => (float) ($item->quantity ?? 0),
                'expiry_date' => $item->expiry_date,
                'days_left' => $daysLeft,
                'expiry_status' => $daysLeft < 0 ? 'expired' : ($daysLeft <= 30 ? 'expiring' : 'valid'),
            ];
        })->values();

        $summaryBase = InventoryItem::query()
            ->where('quantity', '>', 0)
            ->whereNotNull('expiry_date');

        if ($warehouseId !== '') {
            $summaryBase->where('warehouse_id', $warehouseId);
        }

        $expiredCount = (clone $summaryBase)->whereDate('expiry_date', '<', $today)->count();
        $expiringCount = (clone $summaryBase)->whereDate('expiry_date', '>=', $today)->whereDate('expiry_date', '<=', $expireUntil)->count();

        return response()->json([
            'status' => 1,
            'message' => 'Expire product report fetched successfully',
            'data' => $rows,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
            'others_data' => [
                'expired_count' => $expiredCount,
                'expiring_count' => $expiringCount,
                'days_to_expire' => $daysToExpire,
            ],
        ], 200);
    }

    public function accountsReport(Request $request)
    {
        if ($request->filled('warehouse') && !$request->filled('warehouse_id')) {
            $request->merge(['warehouse_id' => $request->input('warehouse')]);
        }

        if ($request->filled('salesman_id') && !$request->filled('cashier_id')) {
            $request->merge(['cashier_id' => $request->input('salesman_id')]);
        }

        [$dateFrom, $dateTo] = $this->resolveAccountsReportDateRange($request);

        $baseQuery = $this->accountsTransactionBaseQuery($request, $dateFrom, $dateTo, false);

        if ($request->filled('collection_type')) {
            $paymentTypeExpression = $this->accountsPaymentTypeExpression();
            if ($request->collection_type === 'due') {
                $baseQuery->whereRaw("({$paymentTypeExpression}) = 'due_sale'");
            } elseif ($request->collection_type === 'direct') {
                $baseQuery->whereRaw("({$paymentTypeExpression}) = 'direct_sale'");
            }
        }

        $perPage = (int) $request->input('perPage', 20);
        $perPage = $perPage > 0 ? min($perPage, 500) : 20;

        $summary = $this->accountsSummary(clone $baseQuery);
        $paymentMethodBreakdown = $this->accountsPaymentMethodBreakdown(clone $baseQuery);

        $invoiceQuery = Invoice::query()
            ->whereIn('type', ['sale', 'purchase'])
            ->when($dateFrom, fn($q) => $q->whereDate('date', '>=', $dateFrom))
            ->when($dateTo, fn($q) => $q->whereDate('date', '<=', $dateTo))
            ->when($request->filled('warehouse_id'), fn($q) => $q->where('warehouse_id', $request->warehouse_id))
            ->when($request->filled('invoice_type') && in_array($request->invoice_type, ['sale', 'purchase'], true), fn($q) => $q->where('type', $request->invoice_type));

        $authUser = Auth::user();
        if ($authUser && !$authUser->isSuperAdmin()) {
            $invoiceQuery->where('company_id', $authUser->company_id);
        } elseif ($request->filled('company_id')) {
            $invoiceQuery->where('company_id', $request->company_id);
        }

        $invoiceTotals = (clone $invoiceQuery)
            ->selectRaw("
                COALESCE(SUM(CASE WHEN type = 'sale' THEN total ELSE 0 END), 0) as sale_total,
                COALESCE(SUM(CASE WHEN type = 'purchase' THEN total ELSE 0 END), 0) as purchase_total,
                COALESCE(SUM(CASE WHEN type = 'sale' THEN paid_amount ELSE 0 END), 0) as sale_collected_total
            ")
            ->first();

        $paymentCompletion = [
            'sales' => [
                'complete' => (float) ((clone $invoiceQuery)->where('type', 'sale')->where('payment_status', 1)->sum('paid_amount')),
                'pending' => (float) ((clone $invoiceQuery)->where('type', 'sale')->where('payment_status', '!=', 1)->sum('due_amount')),
            ],
            'purchase' => [
                'complete' => (float) ((clone $invoiceQuery)->where('type', 'purchase')->where('payment_status', 1)->sum('paid_amount')),
                'pending' => (float) ((clone $invoiceQuery)->where('type', 'purchase')->where('payment_status', '!=', 1)->sum('due_amount')),
            ],
        ];

        $agingInvoices = (clone $invoiceQuery)
            ->where('due_amount', '>', 0)
            ->get(['type', 'date', 'due_amount']);

        $agingBuckets = [
            ['label' => '0-30 days', 'min' => 0, 'max' => 30],
            ['label' => '31-60 days', 'min' => 31, 'max' => 60],
            ['label' => '61-90 days', 'min' => 61, 'max' => 90],
            ['label' => '90+ days', 'min' => 91, 'max' => null],
        ];

        $aging = collect($agingBuckets)->map(function ($bucket) use ($agingInvoices) {
            $receivable = 0.0;
            $payable = 0.0;
            $today = now()->startOfDay();

            foreach ($agingInvoices as $invoice) {
                $days = \Carbon\Carbon::parse($invoice->date)->startOfDay()->diffInDays($today, false) * -1;
                if ($days < 0) {
                    $days = 0;
                }

                $inBucket = $bucket['max'] === null
                    ? $days >= $bucket['min']
                    : ($days >= $bucket['min'] && $days <= $bucket['max']);

                if (!$inBucket) {
                    continue;
                }

                if ($invoice->type === 'sale') {
                    $receivable += (float) $invoice->due_amount;
                } elseif ($invoice->type === 'purchase') {
                    $payable += (float) $invoice->due_amount;
                }
            }

            return [
                'label' => $bucket['label'],
                'receivable' => round($receivable, 2),
                'payable' => round($payable, 2),
            ];
        })->values();

        $ledgerQuery = (clone $baseQuery)->selectRaw("
            DATE(transactions.transaction_date) as date,
            invoices.invoice_no as reference,
            CASE WHEN {$this->accountsReturnTransactionCondition()} THEN 'return' ELSE invoices.type END as type,
            CASE WHEN ({$this->accountsPaymentTypeExpression()}) = 'due_sale' THEN 'due'
                 WHEN ({$this->accountsPaymentTypeExpression()}) = 'direct_sale' THEN 'direct'
                 ELSE 'others' END as collection_type,
            COALESCE(CONCAT(customers.first_name, ' ', COALESCE(customers.last_name, '')), suppliers.name, 'N/A') as payer,
            COALESCE(CONCAT(cashier.first_name, ' ', COALESCE(cashier.last_name, '')), 'N/A') as collector,
            COALESCE(CONCAT(cashier.first_name, ' ', COALESCE(cashier.last_name, '')), 'N/A') as salesman,
            transactions.payment_method as method,
            COALESCE(invoices.total, 0) as invoice_total,
            COALESCE(invoices.paid_amount, 0) as invoice_paid,
            COALESCE(invoices.due_amount, 0) as invoice_pending,
            CASE invoices.payment_status WHEN 1 THEN 'Paid' WHEN 2 THEN 'Partial' ELSE 'Unpaid' END as payment_status,
            CASE WHEN {$this->accountsCashInCondition()} THEN transactions.amount ELSE 0 END as money_in,
            CASE WHEN {$this->accountsCashOutCondition()} THEN transactions.amount ELSE 0 END as money_out,
            CASE WHEN {$this->accountsCashInCondition()} THEN transactions.amount ELSE -transactions.amount END as signed_amount
        ")
            ->orderBy('transactions.transaction_date', 'desc')
            ->orderBy('transactions.id', 'desc');

        $ledgerPaginated = $ledgerQuery->paginate($perPage);
        $runningBalance = 0.0;
        $ledgerRows = collect($ledgerPaginated->items())->reverse()->map(function ($row) use (&$runningBalance) {
            $runningBalance += (float) $row->signed_amount;
            return [
                'date' => $row->date,
                'reference' => $row->reference,
                'type' => $row->type,
                'collection_type' => $row->collection_type,
                'payer' => trim((string) $row->payer),
                'collector' => trim((string) $row->collector),
                'salesman' => trim((string) $row->salesman),
                'method' => $row->method,
                'invoice_total' => (float) $row->invoice_total,
                'invoice_paid' => (float) $row->invoice_paid,
                'invoice_pending' => (float) $row->invoice_pending,
                'payment_status' => $row->payment_status,
                'in' => round((float) $row->money_in, 2),
                'out' => round((float) $row->money_out, 2),
                'balance' => round($runningBalance, 2),
            ];
        })->reverse()->values();

        $pageTotalIn = round($ledgerRows->sum('in'), 2);
        $pageTotalOut = round($ledgerRows->sum('out'), 2);
        $overallTotalIn = round((float) ($summary['cash_in'] ?? 0), 2);
        $overallTotalOut = round((float) ($summary['cash_out'] ?? 0), 2);

        $customers = User::query()
            ->where('role', 2)
            ->when($authUser && !$authUser->isSuperAdmin(), fn($q) => $q->where('company_id', $authUser->company_id))
            ->limit(500)
            ->get(['id', 'first_name', 'last_name', 'phone'])
            ->map(fn($u) => ['id' => $u->id, 'name' => trim(($u->first_name ?? '') . ' ' . ($u->last_name ?? '')), 'phone' => $u->phone])
            ->values();

        $salesmen = User::query()
            ->where('role', '<>', 2)
            ->when($authUser && !$authUser->isSuperAdmin(), fn($q) => $q->where('company_id', $authUser->company_id))
            ->limit(500)
            ->get(['id', 'first_name', 'last_name', 'phone'])
            ->map(fn($u) => ['id' => $u->id, 'name' => trim(($u->first_name ?? '') . ' ' . ($u->last_name ?? '')), 'phone' => $u->phone])
            ->values();

        return response()->json([
            'status' => 1,
            'message' => 'Accounting report fetched successfully',
            'data' => [
                'summary_cards' => [
                    'sales' => round((float) ($invoiceTotals->sale_total ?? 0), 2),
                    'purchase' => round((float) ($invoiceTotals->purchase_total ?? 0), 2),
                    'collected' => round((float) ($invoiceTotals->sale_collected_total ?? 0), 2),
                    'profit' => round((float) (($invoiceTotals->sale_total ?? 0) - ($invoiceTotals->purchase_total ?? 0)), 2),
                ],
                'payment_completion' => $paymentCompletion,
                'payment_method_totals' => collect($paymentMethodBreakdown)->map(fn($row) => [
                    'method' => $row['payment_method'] ?? 'Unknown',
                    'amount' => round((float) (($row['cash_in'] ?? 0) + ($row['cash_out'] ?? 0)), 2),
                    'tx_count' => (int) ($row['transaction_count'] ?? 0),
                ])->values(),
                'aging' => $aging,
                'ledger' => $ledgerRows,
                'ledger_summary' => [
                    'overall' => [
                        'total_in' => $overallTotalIn,
                        'total_out' => $overallTotalOut,
                        'closing_balance' => round($overallTotalIn - $overallTotalOut, 2),
                        'sale_collection_total' => round((float) ($summary['sales_received'] ?? 0), 2),
                        'purchase_payment_total' => round((float) ($summary['purchase_payments'] ?? 0), 2),
                        'direct_sale_collection_total' => 0,
                        'due_sale_collection_total' => 0,
                    ],
                    'page' => [
                        'total_in' => $pageTotalIn,
                        'total_out' => $pageTotalOut,
                        'closing_balance' => round($pageTotalIn - $pageTotalOut, 2),
                    ],
                ],
                'options' => [
                    'customers' => $customers,
                    'salesmen' => $salesmen,
                ],
            ],
            'meta' => [
                'current_page' => $ledgerPaginated->currentPage(),
                'per_page' => $ledgerPaginated->perPage(),
                'total' => $ledgerPaginated->total(),
                'last_page' => $ledgerPaginated->lastPage(),
            ],
        ]);
    }

    private function resolveAccountsReportDateRange(Request $request): array
    {
        $quickRange = $request->input('quick_range');
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        if ($quickRange && $quickRange !== 'custom') {
            $today = now();

            switch ($quickRange) {
                case 'today':
                    return [$today->toDateString(), $today->toDateString()];
                case 'yesterday':
                    $yesterday = $today->copy()->subDay();
                    return [$yesterday->toDateString(), $yesterday->toDateString()];
                case 'this_week':
                    return [
                        $today->copy()->startOfWeek()->toDateString(),
                        $today->copy()->endOfWeek()->toDateString(),
                    ];
                case 'last_month':
                    $lastMonth = $today->copy()->subMonthNoOverflow();
                    return [
                        $lastMonth->copy()->startOfMonth()->toDateString(),
                        $lastMonth->copy()->endOfMonth()->toDateString(),
                    ];
                case 'this_year':
                    return [
                        $today->copy()->startOfYear()->toDateString(),
                        $today->copy()->endOfYear()->toDateString(),
                    ];
                case 'this_month':
                default:
                    return [
                        $today->copy()->startOfMonth()->toDateString(),
                        $today->copy()->endOfMonth()->toDateString(),
                    ];
            }
        }

        if (!$dateFrom && !$dateTo) {
            $today = now();
            return [
                $today->copy()->startOfMonth()->toDateString(),
                $today->copy()->endOfMonth()->toDateString(),
            ];
        }

        return [$dateFrom, $dateTo];
    }

    private function resolveAccountsPreviousDateRange(?string $dateFrom, ?string $dateTo): array
    {
        if (!$dateFrom || !$dateTo) {
            return [null, null];
        }

        $start = \Carbon\Carbon::parse($dateFrom)->startOfDay();
        $end = \Carbon\Carbon::parse($dateTo)->startOfDay();
        $days = $start->diffInDays($end) + 1;

        return [
            $start->copy()->subDays($days)->toDateString(),
            $start->copy()->subDay()->toDateString(),
        ];
    }

    private function accountsTransactionBaseQuery(Request $request, ?string $dateFrom, ?string $dateTo, bool $includeDeleted = false)
    {
        $query = $includeDeleted ? Transaction::withTrashed() : Transaction::query();
        $user = Auth::user();

        $query->from('transactions')
            ->join('invoices', function ($join) {
                $join->whereRaw('BINARY transactions.invoice_id = BINARY invoices.id');
            })
            ->leftJoin('user as cashier', function ($join) {
                $join->whereRaw('BINARY transactions.user_id = BINARY cashier.id');
            })
            ->leftJoin('user as customers', function ($join) {
                $join->whereRaw('BINARY invoices.customer_id = BINARY customers.id');
            })
            ->leftJoin('suppliers', 'invoices.supplier_id', '=', 'suppliers.id')
            ->leftJoin('warehouses', function ($join) {
                $join->whereRaw('BINARY invoices.warehouse_id = BINARY warehouses.id');
            })
            ->whereNotNull('transactions.amount')
            ->where('transactions.amount', '>', 0)
            ->whereNotIn('invoices.type', ['draft']);

        if (!$includeDeleted) {
            $query->whereNull('invoices.deleted_at');
        }

        if ($user && !$user->isSuperAdmin()) {
            $query->whereRaw('BINARY invoices.company_id = BINARY ?', [$user->company_id]);
        } elseif ($request->filled('company_id')) {
            $query->whereRaw('BINARY invoices.company_id = BINARY ?', [$request->company_id]);
        }

        if ($dateFrom) {
            $query->whereDate('transactions.transaction_date', '>=', $dateFrom);
        }

        if ($dateTo) {
            $query->whereDate('transactions.transaction_date', '<=', $dateTo);
        }

        if ($request->filled('direction')) {
            if ($request->direction === 'in') {
                $query->whereRaw($this->accountsCashInCondition());
            } elseif ($request->direction === 'out') {
                $query->whereRaw($this->accountsCashOutCondition());
            }
        }

        if ($request->filled('invoice_type')) {
            if ($request->invoice_type === 'return') {
                $query->whereRaw($this->accountsReturnTransactionCondition());
            } elseif ($request->invoice_type === 'sale') {
                $query->whereRaw($this->accountsCashInCondition());
            } else {
                $query->where('invoices.type', $request->invoice_type);
            }
        }

        if ($request->filled('payment_status')) {
            $status = $request->payment_status;
            $statusMap = [
                'unpaid' => 0,
                'paid' => 1,
                'partial' => 2,
                'due' => 2,
            ];

            $query->where('invoices.payment_status', $statusMap[$status] ?? $status);
        }

        if ($request->filled('payment_type')) {
            $query->whereRaw('(' . $this->accountsPaymentTypeExpression() . ') = ?', [$request->payment_type]);
        }

        if ($request->filled('payment_method')) {
            $query->where('transactions.payment_method', $request->payment_method);
        }

        if ($request->filled('warehouse_id')) {
            $query->whereRaw('BINARY invoices.warehouse_id = BINARY ?', [$request->warehouse_id]);
        }

        if ($request->filled('cashier_id')) {
            $query->whereRaw('BINARY transactions.user_id = BINARY ?', [$request->cashier_id]);
        }

        if ($request->filled('customer_id')) {
            $query->whereRaw('BINARY invoices.customer_id = BINARY ?', [$request->customer_id]);
        }

        if ($request->filled('supplier_id')) {
            $query->where('invoices.supplier_id', $request->supplier_id);
        }

        if ($request->filled('amount_min')) {
            $query->where('transactions.amount', '>=', $request->amount_min);
        }

        if ($request->filled('amount_max')) {
            $query->where('transactions.amount', '<=', $request->amount_max);
        }

        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('invoices.invoice_no', 'LIKE', "%{$search}%")
                    ->orWhere('transactions.id', 'LIKE', "%{$search}%")
                    ->orWhere('transactions.payment_method', 'LIKE', "%{$search}%")
                    ->orWhere('transactions.card_last_digits', 'LIKE', "%{$search}%")
                    ->orWhere('transactions.mf_number', 'LIKE', "%{$search}%")
                    ->orWhere('transactions.qr_transaction_id', 'LIKE', "%{$search}%")
                    ->orWhere('suppliers.name', 'LIKE', "%{$search}%")
                    ->orWhere(DB::raw("CONCAT(cashier.first_name, ' ', COALESCE(cashier.last_name, ''))"), 'LIKE', "%{$search}%")
                    ->orWhere(DB::raw("CONCAT(customers.first_name, ' ', COALESCE(customers.last_name, ''))"), 'LIKE', "%{$search}%");
            });
        }

        return $query;
    }

    private function accountsSummary($query): array
    {
        $cashInCondition = $this->accountsCashInCondition();
        $cashOutCondition = $this->accountsCashOutCondition();
        $returnCondition = $this->accountsReturnTransactionCondition();
        $paymentTypeExpression = $this->accountsPaymentTypeExpression();

        $row = $query->selectRaw("
                COUNT(transactions.id) as transaction_count,
                COALESCE(SUM(CASE WHEN {$cashInCondition} THEN transactions.amount ELSE 0 END), 0) as cash_in,
                COALESCE(SUM(CASE WHEN {$cashOutCondition} THEN transactions.amount ELSE 0 END), 0) as cash_out,
                COALESCE(SUM(CASE WHEN {$cashInCondition} THEN transactions.amount ELSE -transactions.amount END), 0) as net_cash_flow,
                COALESCE(SUM(CASE WHEN {$cashInCondition} THEN transactions.amount ELSE 0 END), 0) as sales_received,
                COALESCE(SUM(CASE WHEN invoices.type = 'purchase' THEN transactions.amount ELSE 0 END), 0) as purchase_payments,
                COALESCE(SUM(CASE WHEN invoices.type = 'expense' THEN transactions.amount ELSE 0 END), 0) as expense_payments,
                COALESCE(SUM(CASE WHEN {$returnCondition} OR invoices.type = 'return' THEN transactions.amount ELSE 0 END), 0) as refund_payments,
                COALESCE(SUM(CASE WHEN ({$paymentTypeExpression}) = 'direct_sale' THEN transactions.amount ELSE 0 END), 0) as direct_sale_payments,
                COALESCE(SUM(CASE WHEN ({$paymentTypeExpression}) = 'sale_advance' THEN transactions.amount ELSE 0 END), 0) as sale_advance_payments,
                COALESCE(SUM(CASE WHEN ({$paymentTypeExpression}) = 'due_sale' THEN transactions.amount ELSE 0 END), 0) as due_sale_payments,
                COALESCE(SUM(CASE WHEN ({$paymentTypeExpression}) = 'direct_purchase' THEN transactions.amount ELSE 0 END), 0) as direct_purchase_payments,
                COALESCE(SUM(CASE WHEN ({$paymentTypeExpression}) = 'purchase_advance' THEN transactions.amount ELSE 0 END), 0) as purchase_advance_payments,
                COALESCE(SUM(CASE WHEN ({$paymentTypeExpression}) = 'due_purchase' THEN transactions.amount ELSE 0 END), 0) as due_purchase_payments
            ")
            ->first();

        return [
            'transaction_count' => (int) ($row->transaction_count ?? 0),
            'cash_in' => round((float) ($row->cash_in ?? 0), 2),
            'cash_out' => round((float) ($row->cash_out ?? 0), 2),
            'net_cash_flow' => round((float) ($row->net_cash_flow ?? 0), 2),
            'sales_received' => round((float) ($row->sales_received ?? 0), 2),
            'purchase_payments' => round((float) ($row->purchase_payments ?? 0), 2),
            'expense_payments' => round((float) ($row->expense_payments ?? 0), 2),
            'refund_payments' => round((float) ($row->refund_payments ?? 0), 2),
            'direct_sale_payments' => round((float) ($row->direct_sale_payments ?? 0), 2),
            'sale_advance_payments' => round((float) ($row->sale_advance_payments ?? 0), 2),
            'due_sale_payments' => round((float) ($row->due_sale_payments ?? 0), 2),
            'direct_purchase_payments' => round((float) ($row->direct_purchase_payments ?? 0), 2),
            'purchase_advance_payments' => round((float) ($row->purchase_advance_payments ?? 0), 2),
            'due_purchase_payments' => round((float) ($row->due_purchase_payments ?? 0), 2),
        ];
    }

    private function accountsPaymentMethodBreakdown($query)
    {
        $cashInCondition = $this->accountsCashInCondition();
        $cashOutCondition = $this->accountsCashOutCondition();

        return $query->selectRaw("
                COALESCE(transactions.payment_method, 'Unknown') as payment_method,
                COUNT(transactions.id) as transaction_count,
                COALESCE(SUM(CASE WHEN {$cashInCondition} THEN transactions.amount ELSE 0 END), 0) as cash_in,
                COALESCE(SUM(CASE WHEN {$cashOutCondition} THEN transactions.amount ELSE 0 END), 0) as cash_out,
                COALESCE(SUM(CASE WHEN {$cashInCondition} THEN transactions.amount ELSE -transactions.amount END), 0) as net_amount
            ")
            ->groupBy(DB::raw("COALESCE(transactions.payment_method, 'Unknown')"))
            ->orderByDesc('transaction_count')
            ->get()
            ->map(function ($row) {
                return [
                    'payment_method' => $row->payment_method,
                    'transaction_count' => (int) $row->transaction_count,
                    'cash_in' => round((float) $row->cash_in, 2),
                    'cash_out' => round((float) $row->cash_out, 2),
                    'net_amount' => round((float) $row->net_amount, 2),
                ];
            });
    }

    private function accountsPaymentTypeBreakdown($query)
    {
        $cashInCondition = $this->accountsCashInCondition();
        $cashOutCondition = $this->accountsCashOutCondition();
        $paymentTypeExpression = $this->accountsPaymentTypeExpression();

        $typedRows = $query->select([
            'transactions.id as transaction_id',
            DB::raw($paymentTypeExpression . ' as payment_type'),
            DB::raw("CASE WHEN {$cashInCondition} THEN transactions.amount ELSE 0 END as cash_in"),
            DB::raw("CASE WHEN {$cashOutCondition} THEN transactions.amount ELSE 0 END as cash_out"),
            DB::raw("CASE WHEN {$cashInCondition} THEN transactions.amount ELSE -transactions.amount END as net_amount"),
        ]);

        return DB::query()
            ->fromSub($typedRows, 'account_payment_rows')
            ->selectRaw("
                payment_type,
                COUNT(transaction_id) as transaction_count,
                COALESCE(SUM(cash_in), 0) as cash_in,
                COALESCE(SUM(cash_out), 0) as cash_out,
                COALESCE(SUM(net_amount), 0) as net_amount
            ")
            ->groupBy('payment_type')
            ->orderByDesc('transaction_count')
            ->get()
            ->map(function ($row) {
                return [
                    'payment_type' => $row->payment_type,
                    'label' => $this->accountsPaymentTypeLabel($row->payment_type),
                    'transaction_count' => (int) $row->transaction_count,
                    'cash_in' => round((float) $row->cash_in, 2),
                    'cash_out' => round((float) $row->cash_out, 2),
                    'net_amount' => round((float) $row->net_amount, 2),
                ];
            });
    }

    private function accountsGroupedBreakdown($query, string $groupBy)
    {
        if ($groupBy === 'none') {
            return [];
        }

        if ($groupBy === 'payment_type') {
            return $this->accountsPaymentTypeBreakdown($query)
                ->map(function ($row) {
                    return [
                        'key' => $row['payment_type'],
                        'label' => $row['label'],
                        'transaction_count' => $row['transaction_count'],
                        'cash_in' => $row['cash_in'],
                        'cash_out' => $row['cash_out'],
                        'net_amount' => $row['net_amount'],
                    ];
                });
        }

        if ($groupBy === 'invoice_type') {
            return $this->accountsInvoiceTypeGroupedBreakdown($query);
        }

        $cashInCondition = $this->accountsCashInCondition();
        $cashOutCondition = $this->accountsCashOutCondition();
        $groupExpression = "DATE(transactions.transaction_date)";
        $labelExpression = "DATE(transactions.transaction_date)";

        if ($groupBy === 'week') {
            $groupExpression = "YEARWEEK(transactions.transaction_date, 3)";
            $labelExpression = "CONCAT(YEAR(transactions.transaction_date), '-W', LPAD(WEEK(transactions.transaction_date, 3), 2, '0'))";
        } elseif ($groupBy === 'month') {
            $groupExpression = "DATE_FORMAT(transactions.transaction_date, '%Y-%m')";
            $labelExpression = "DATE_FORMAT(transactions.transaction_date, '%Y-%m')";
        } elseif ($groupBy === 'payment_method') {
            $groupExpression = "COALESCE(transactions.payment_method, 'Unknown')";
            $labelExpression = "COALESCE(transactions.payment_method, 'Unknown')";
        } elseif ($groupBy === 'cashier') {
            $groupExpression = "transactions.user_id";
            $labelExpression = "COALESCE(NULLIF(TRIM(CONCAT(cashier.first_name, ' ', COALESCE(cashier.last_name, ''))), ''), 'Unknown')";
        } elseif ($groupBy === 'warehouse') {
            $groupExpression = "invoices.warehouse_id";
            $labelExpression = "COALESCE(warehouses.name, 'Unknown')";
        }

        return $query->selectRaw("
                {$groupExpression} as group_key,
                {$labelExpression} as label,
                COUNT(transactions.id) as transaction_count,
                COALESCE(SUM(CASE WHEN {$cashInCondition} THEN transactions.amount ELSE 0 END), 0) as cash_in,
                COALESCE(SUM(CASE WHEN {$cashOutCondition} THEN transactions.amount ELSE 0 END), 0) as cash_out,
                COALESCE(SUM(CASE WHEN {$cashInCondition} THEN transactions.amount ELSE -transactions.amount END), 0) as net_amount
            ")
            ->groupBy(DB::raw($groupExpression), DB::raw($labelExpression))
            ->orderBy(DB::raw('MIN(transactions.transaction_date)'), 'desc')
            ->limit(100)
            ->get()
            ->map(function ($row) use ($groupBy) {
                return [
                    'key' => $row->group_key,
                    'label' => $groupBy === 'payment_type'
                        ? $this->accountsPaymentTypeLabel($row->group_key)
                        : ($row->label ?: 'Unknown'),
                    'transaction_count' => (int) $row->transaction_count,
                    'cash_in' => round((float) $row->cash_in, 2),
                    'cash_out' => round((float) $row->cash_out, 2),
                    'net_amount' => round((float) $row->net_amount, 2),
                ];
            });
    }

    private function accountsInvoiceTypeGroupedBreakdown($query)
    {
        $cashInCondition = $this->accountsCashInCondition();
        $cashOutCondition = $this->accountsCashOutCondition();
        $invoiceTypeExpression = $this->accountsTransactionTypeExpression();

        $typedRows = $query->select([
            'transactions.id as transaction_id',
            DB::raw($invoiceTypeExpression . ' as invoice_type'),
            DB::raw("CASE WHEN {$cashInCondition} THEN transactions.amount ELSE 0 END as cash_in"),
            DB::raw("CASE WHEN {$cashOutCondition} THEN transactions.amount ELSE 0 END as cash_out"),
            DB::raw("CASE WHEN {$cashInCondition} THEN transactions.amount ELSE -transactions.amount END as net_amount"),
        ]);

        return DB::query()
            ->fromSub($typedRows, 'account_invoice_type_rows')
            ->selectRaw("
                invoice_type,
                COUNT(transaction_id) as transaction_count,
                COALESCE(SUM(cash_in), 0) as cash_in,
                COALESCE(SUM(cash_out), 0) as cash_out,
                COALESCE(SUM(net_amount), 0) as net_amount
            ")
            ->groupBy('invoice_type')
            ->orderByDesc('transaction_count')
            ->get()
            ->map(function ($row) {
                return [
                    'key' => $row->invoice_type,
                    'label' => ucfirst((string) ($row->invoice_type ?: 'unknown')),
                    'transaction_count' => (int) $row->transaction_count,
                    'cash_in' => round((float) $row->cash_in, 2),
                    'cash_out' => round((float) $row->cash_out, 2),
                    'net_amount' => round((float) $row->net_amount, 2),
                ];
            });
    }

    private function accountsFilterOptions(Request $request): array
    {
        $user = Auth::user();
        $companyId = null;

        if ($user && !$user->isSuperAdmin()) {
            $companyId = $user->company_id;
        } elseif ($request->filled('company_id')) {
            $companyId = $request->company_id;
        }

        $warehouses = DB::table('warehouses')
            ->select('id', 'name')
            ->when($companyId, fn($query) => $query->where('company_id', $companyId))
            ->orderBy('name')
            ->limit(500)
            ->get();

        $cashiers = DB::table('user')
            ->select('id', 'first_name', 'last_name', 'email')
            ->where('status', 1)
            ->where('role', '<>', 2)
            ->when($companyId, fn($query) => $query->where('company_id', $companyId))
            ->orderBy('first_name')
            ->limit(500)
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => trim($user->first_name . ' ' . $user->last_name),
                    'email' => $user->email,
                ];
            });

        $customers = DB::table('user')
            ->select('id', 'first_name', 'last_name', 'phone')
            ->where('status', 1)
            ->where('role', 2)
            ->when($companyId, fn($query) => $query->where('company_id', $companyId))
            ->orderBy('first_name')
            ->limit(500)
            ->get()
            ->map(function ($customer) {
                return [
                    'id' => $customer->id,
                    'name' => trim($customer->first_name . ' ' . $customer->last_name),
                    'phone' => $customer->phone,
                ];
            });

        $suppliers = DB::table('suppliers')
            ->select('id', 'name', 'phone_number as phone')
            ->when($companyId, fn($query) => $query->where('company_id', $companyId))
            ->orderBy('name')
            ->limit(500)
            ->get();

        $paymentMethods = DB::table('transactions')
            ->join('invoices', function ($join) {
                $join->whereRaw('BINARY transactions.invoice_id = BINARY invoices.id');
            })
            ->when($companyId, fn($query) => $query->whereRaw('BINARY invoices.company_id = BINARY ?', [$companyId]))
            ->whereNotNull('transactions.payment_method')
            ->where('transactions.payment_method', '<>', '')
            ->distinct()
            ->orderBy('transactions.payment_method')
            ->pluck('transactions.payment_method')
            ->values();

        return [
            'warehouses' => $warehouses,
            'cashiers' => $cashiers,
            'customers' => $customers,
            'suppliers' => $suppliers,
            'payment_methods' => $paymentMethods,
            'payment_types' => $this->accountsPaymentTypeOptions(),
        ];
    }

    private function accountsDirectionExpression(): string
    {
        return "CASE WHEN " . $this->accountsCashInCondition() . " THEN 'in' ELSE 'out' END";
    }

    private function accountsSignedAmountExpression(): string
    {
        return "CASE WHEN " . $this->accountsCashInCondition() . " THEN transactions.amount ELSE -transactions.amount END";
    }

    private function accountsTransactionTypeExpression(): string
    {
        return "CASE WHEN " . $this->accountsReturnTransactionCondition() . " THEN 'return' ELSE invoices.type END";
    }

    private function accountsPaymentTypeExpression(): string
    {
        $scheduleCondition = $this->accountsSchedulePaymentCondition();
        $invoiceHasScheduleCondition = $this->accountsInvoiceHasScheduleCondition();
        $returnCondition = $this->accountsReturnTransactionCondition();

        return "CASE
            WHEN {$returnCondition} OR invoices.type = 'return' THEN 'refund'
            WHEN invoices.type = 'expense' THEN 'expense'
            WHEN invoices.type = 'sale' AND {$scheduleCondition} THEN 'due_sale'
            WHEN invoices.type = 'purchase' AND {$scheduleCondition} THEN 'due_purchase'
            WHEN invoices.type = 'sale'
                AND NOT ({$invoiceHasScheduleCondition})
                AND (invoices.payment_status = 1 OR transactions.amount >= COALESCE(invoices.total, 0))
                THEN 'direct_sale'
            WHEN invoices.type = 'purchase'
                AND NOT ({$invoiceHasScheduleCondition})
                AND (invoices.payment_status = 1 OR transactions.amount >= COALESCE(invoices.total, 0))
                THEN 'direct_purchase'
            WHEN invoices.type = 'sale' THEN 'sale_advance'
            WHEN invoices.type = 'purchase' THEN 'purchase_advance'
            ELSE 'other'
        END";
    }

    private function accountsPaymentTypeLabel(?string $type): string
    {
        return $this->accountsPaymentTypeLabels()[$type] ?? 'Other Payment';
    }

    private function accountsPaymentTypeOptions(): array
    {
        return collect($this->accountsPaymentTypeLabels())
            ->map(fn($label, $value) => [
                'value' => $value,
                'label' => $label,
            ])
            ->values()
            ->all();
    }

    private function accountsPaymentTypeLabels(): array
    {
        return [
            'direct_sale' => 'Direct Sale Payment',
            'sale_advance' => 'Sale Advance Payment',
            'due_sale' => 'Due Payment',
            'direct_purchase' => 'Direct Purchase Payment',
            'purchase_advance' => 'Purchase Advance Payment',
            'due_purchase' => 'Purchase Due Payment',
            'expense' => 'Expense Payment',
            'refund' => 'Refund Payment',
            'other' => 'Other Payment',
        ];
    }

    private function accountsCashInCondition(): string
    {
        return "(invoices.type = 'sale' AND NOT (" . $this->accountsReturnTransactionCondition() . "))";
    }

    private function accountsCashOutCondition(): string
    {
        return "(invoices.type IN ('purchase', 'expense', 'return') OR " . $this->accountsReturnTransactionCondition() . ")";
    }

    private function accountsReturnTransactionCondition(): string
    {
        return "EXISTS (
            SELECT 1
            FROM invoice_items as return_items
            WHERE BINARY return_items.invoice_id = BINARY transactions.invoice_id
                AND return_items.type = 'return'
                AND return_items.is_returned = 1
                AND return_items.deleted_at IS NULL
                AND return_items.created_at <= transactions.created_at
                AND DATE(return_items.created_at) = DATE(transactions.created_at)
        )";
    }

    private function accountsSchedulePaymentCondition(): string
    {
        $table = $this->accountsPaymentScheduleTable();

        if (!$table) {
            return '0 = 1';
        }

        $conditions = [
            "BINARY schedule_payments.invoice_id = BINARY transactions.invoice_id",
        ];

        if (Schema::hasColumn($table, 'deleted_at')) {
            $conditions[] = 'schedule_payments.deleted_at IS NULL';
        }

        if (Schema::hasColumn($table, 'paid_amount')) {
            $conditions[] = 'schedule_payments.paid_amount > 0';
        }

        if (Schema::hasColumn($table, 'created_at')) {
            $conditions[] = 'schedule_payments.created_at < transactions.created_at';
        }

        if (Schema::hasColumn($table, 'status')) {
            $conditions[] = "UPPER(schedule_payments.status) IN ('PAID', 'PARTIAL')";
        }

        if (Schema::hasColumn($table, 'paid_date')) {
            $conditions[] = "(DATE(schedule_payments.paid_date) = DATE(transactions.transaction_date)"
                . (Schema::hasColumn($table, 'updated_at') ? ' OR schedule_payments.updated_at >= transactions.created_at' : '')
                . ')';
        } elseif (Schema::hasColumn($table, 'updated_at')) {
            $conditions[] = 'schedule_payments.updated_at >= transactions.created_at';
        }

        return "EXISTS (
            SELECT 1
            FROM {$table} as schedule_payments
            WHERE " . implode(' AND ', $conditions) . "
        )";
    }

    private function accountsInvoiceHasScheduleCondition(): string
    {
        $table = $this->accountsPaymentScheduleTable();

        if (!$table) {
            return '0 = 1';
        }

        $conditions = [
            "BINARY invoice_schedules.invoice_id = BINARY transactions.invoice_id",
        ];

        if (Schema::hasColumn($table, 'deleted_at')) {
            $conditions[] = 'invoice_schedules.deleted_at IS NULL';
        }

        return "EXISTS (
            SELECT 1
            FROM {$table} as invoice_schedules
            WHERE " . implode(' AND ', $conditions) . "
        )";
    }

    private function accountsPaymentScheduleTable(): ?string
    {
        if (Schema::hasTable('payment_schedule')) {
            return 'payment_schedule';
        }

        if (Schema::hasTable('payment_schedules')) {
            return 'payment_schedules';
        }

        return null;
    }
}
