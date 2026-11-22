<?php

namespace App\Services\Api;

use App\Data\FeaturePreference;
use App\Helpers\Helper;
use App\Jobs\SendInvoiceEmail;
use App\Models\DiscountHistory;
use App\Models\DiscountSetup;
use App\Models\Inventory;
use App\Models\InventoryHistory;
use App\Models\InventoryItem;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\PaymentSchedule;
use App\Models\PosSetting;
use App\Models\ProductBundle;
use App\Models\RewordCard;
use App\Models\RewordHistory;
use App\Models\RewordSetup;
use App\Models\SalesReturn;
use App\Models\SalesReturnApproval;
use App\Models\SalesReturnItem;
use App\Models\SalesReturnPayment;
use App\Models\SalesChannel as InventorySalesChannel;
use App\Models\Transaction;
use App\Models\User;
use App\Utils\PermissionUtils;
use App\Models\Warehouse;
use App\Services\ProductBundleService;
use App\Services\StockMovementService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Milon\Barcode\DNS1D;

class InvoiceService
{
    private function currentCompanyId(): ?string
    {
        return Auth::user()?->company_id ? (string) Auth::user()->company_id : null;
    }

    private function setupDiscountForLine(?InventoryItem $inventoryItem, ?string $productId, float $unitPrice, ?string $companyId = null): array
    {
        if (!$inventoryItem || !$productId || $unitPrice <= 0) {
            return ['type' => 'percent', 'value' => 0, 'amount' => 0];
        }

        $product = $inventoryItem->product;
        if (!$product) {
            return ['type' => 'percent', 'value' => 0, 'amount' => 0];
        }

        $setupQuery = DiscountSetup::query()
            ->where('type', 'discount')
            ->where('is_active', true)
            ->whereDate('form_date', '<=', now()->toDateString())
            ->whereDate('to_date', '>=', now()->toDateString())
            ->where(function ($query) use ($product, $inventoryItem) {
                $query->whereJsonContains('products', (string) $product->id)
                    ->orWhere(function ($scopedQuery) use ($product, $inventoryItem) {
                        $scopedQuery->where(function ($scopeQuery) use ($product) {
                            $scopeQuery->whereJsonContains('categories', (string) $product->category_id);

                            if (!blank($product->brand_id)) {
                                $scopeQuery->orWhereJsonContains('brands', (string) $product->brand_id);
                            }

                            $scopeQuery->orWhere(function ($globalQuery) {
                                $globalQuery
                                    ->where(function ($q) {
                                        $q->whereNull('products')->orWhereJsonLength('products', 0);
                                    })
                                    ->where(function ($q) {
                                        $q->whereNull('categories')->orWhereJsonLength('categories', 0);
                                    })
                                    ->where(function ($q) {
                                        $q->whereNull('brands')->orWhereJsonLength('brands', 0);
                                    });
                            });
                        });

                        if (Schema::hasColumn('discount_setup', 'warehouses')) {
                            $scopedQuery->where(function ($warehouseQuery) use ($inventoryItem) {
                                $warehouseQuery
                                    ->whereNull('warehouses')
                                    ->orWhereJsonLength('warehouses', 0)
                                    ->orWhereJsonContains('warehouses', (string) $inventoryItem->warehouse_id);
                            });
                        }
                    });
            });

        if (!blank($companyId)) {
            $setupQuery->where('company_id', $companyId);
        }

        $setup = $setupQuery->latest('id')->first();

        if (!$setup) {
            return ['type' => 'percent', 'value' => 0, 'amount' => 0];
        }

        $type = $setup->discount_type === 'percent' ? 'percent' : 'fixed';
        $value = (float) $setup->amount;
        $amount = $type === 'percent'
            ? $unitPrice * ($value / 100)
            : $value;

        return [
            'type' => $type,
            'value' => $value,
            'amount' => round(min(max($amount, 0), $unitPrice), 2),
        ];
    }

    private function lineDiscountAmount(float $basePrice, float $discountValue, ?string $discountType, float $quantity = 1): float
    {
        $type = strtolower((string) ($discountType ?: 'percent'));
        $amount = in_array($type, ['fixed', 'flat'], true)
            ? abs($quantity) * $discountValue
            : $basePrice * ($discountValue / 100);

        return round(min(max($amount, 0), $basePrice), 2);
    }

    private function defaultPaymentMethods(): array
    {
        return [
            ['name' => 'Cash', 'config' => [], 'enabled' => true],
            ['name' => 'Card', 'config' => ['last_digit_length' => [5, 6], 'require_last_digits' => false], 'enabled' => true],
            ['name' => 'QR Payment', 'config' => ['providers' => ['bKash', 'Nagad', 'Rocket', 'Upay']], 'enabled' => false],
            ['name' => 'Reward Points', 'config' => [], 'enabled' => false],
            ['name' => 'Cash Refund', 'config' => [], 'enabled' => false],
            ['name' => 'Refund to Card', 'config' => ['last_digit_length' => [5, 6], 'require_last_digits' => true], 'enabled' => false],
            ['name' => 'Refund to MF', 'config' => ['providers' => ['bKash', 'Nagad', 'Rocket', 'Upay']], 'enabled' => false],
        ];
    }

    private function normalizePaymentMethods(mixed $value): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $value = json_last_error() === JSON_ERROR_NONE ? $decoded : null;
        }

        if (!is_array($value)) {
            return $this->defaultPaymentMethods();
        }

        $methods = array_values(array_filter($value, fn ($item) => is_array($item) && !empty($item['name'])));

        if ($methods === []) {
            return $this->defaultPaymentMethods();
        }

        return array_map(function (array $method) {
            return [
                'name' => trim((string) ($method['name'] ?? '')),
                'enabled' => (bool) ($method['enabled'] ?? false),
                'config' => is_array($method['config'] ?? null) ? $method['config'] : [],
            ];
        }, $methods);
    }

    private function findPaymentMethod(array $paymentMethods, ?string $value): ?array
    {
        $needle = strtolower(trim((string) $value));

        foreach ($paymentMethods as $method) {
            $methodName = strtolower(trim((string) ($method['name'] ?? '')));
            if ($needle !== '' && $methodName === $needle) {
                return $method;
            }
        }

        return null;
    }

    public function list(Request $request)
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

        $query = Invoice::with('items.product', 'items.bundle', 'supplier', 'customer', 'paymentSchedules', 'invoiceHistory');

        // Apply filters
        if (!empty($filterText)) {
            $query->where(function ($q) use ($filterText) {
                $q->where('invoice_no', 'LIKE', "%{$filterText}%");
            });
        }

        if (!empty($filterType)) {
            $query->where('type', $filterType);
        } else {
            $query->where('type', '!=', 'draft');
        }

        if (!empty($filterStatus)) {
            if ($filterStatus == 'paid') {
                $query->where('payment_status', 1);
            } else if ($filterStatus == 'unpaid') {
                $query->where('payment_status', 0);
            } else if ($filterStatus == 'partially_paid') {
                $query->where('payment_status', 2);
            }
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

        $fetchAll = (string) $perPage === 'all';

        // Fetch data (paginated by default, full set when perPage=all)
        $invoices = $fetchAll
            ? $query->get()
            : $query->paginate($perPage, ['*'], 'page', $page);

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
                    'address' => $invoice?->customer?->address,
                ],
                'supplier' =>  [
                    'id' => $invoice?->supplier?->id,
                    'name' => $invoice?->supplier?->name ?? null,
                    'phone' =>  $invoice?->supplier?->phone,
                    'email' =>  $invoice?->supplier?->email,
                    'address' => $invoice?->supplier?->address,
                ],
                'items' => $invoice->items,
                'payment_schedules' => $invoice->paymentSchedules,
                'history' => $invoice->invoiceHistory,
            ];
        });

        if ($fetchAll) {
            $responseData = $data->values()->all();
            $responseMeta = [
                'current_page' => 1,
                'per_page' => count($responseData),
                'total' => count($responseData),
                'last_page' => 1,
            ];
        } else {
            $invoices->setCollection($data);
            $responseData = $invoices->items();
            $responseMeta = [
                'current_page' => $invoices->currentPage(),
                'per_page' => $invoices->perPage(),
                'total' => $invoices->total(),
                'last_page' => $invoices->lastPage(),
            ];
        }

        $fullQuery = Invoice::query(); // Clone the same filters but without pagination

        // Re-apply all the same filters to fullQuery
        if (!empty($filterText)) {
            $fullQuery->where(function ($q) use ($filterText) {
                $q->where('invoice_no', 'LIKE', "%{$filterText}%");
            });
        }

        if (!empty($filterType)) {
            $fullQuery->where('type', $filterType);
        } else {
            $fullQuery->where('type', '!=', 'draft');
        }

        if (!empty($filterStatus)) {
            if ($filterStatus == 'paid') {
                $fullQuery->where('payment_status', 1);
            } else if ($filterStatus == 'unpaid') {
                $fullQuery->where('payment_status', 0);
            } else if ($filterStatus == 'partially_paid') {
                $fullQuery->where('payment_status', 2);
            }
        }

        if ($filterWarehouse) {
            $fullQuery->where('warehouse_id', $filterWarehouse);
        }

        if ($filterUser) {
            $fullQuery->where('user_id', $filterUser);
        }

        if (!empty($startDate)) {
            $fullQuery->whereDate('date', '>=', $startDate);
        }

        if (!empty($endDate)) {
            $fullQuery->whereDate('date', '<=', $endDate);
        }

        // Get aggregated totals grouped by type
        $totalsByType = (clone $fullQuery)
            ->selectRaw('
                type,
                SUM(qty) as total_qty,
                SUM(discount) as total_discount,
                SUM(total) as total_amount,
                SUM(paid_amount) as total_paid,
                SUM(due_amount) as total_due
            ')
            ->groupBy('type')
            ->get();

        // Calculate payment-method breakdown from transaction rows
        $filteredInvoicesForPayments = (clone $fullQuery)->select('id', 'type');

        $paymentBreakdownFromTransactions = DB::query()
            ->fromSub($filteredInvoicesForPayments, 'filtered_invoices')
            ->join('transactions', 'transactions.invoice_id', '=', 'filtered_invoices.id')
            ->selectRaw('
                filtered_invoices.type as type,
                TRIM(transactions.payment_method) as payment_method,
                SUM(transactions.amount) as amount
            ')
            ->whereNotNull('transactions.payment_method')
            ->whereNull('transactions.deleted_at')
            ->where('transactions.is_deleted', false)
            ->where('transactions.amount', '>', 0)
            ->groupBy('filtered_invoices.type', DB::raw('TRIM(transactions.payment_method)'))
            ->get();

        // Fallback for older invoices that might not have transaction rows
        $paymentBreakdownFromInvoices = (clone $fullQuery)
            ->whereNotNull('payment_method')
            ->where('paid_amount', '>', 0)
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('transactions')
                    ->whereColumn('transactions.invoice_id', 'invoices.id')
                    ->whereNull('transactions.deleted_at')
                    ->where('transactions.is_deleted', false);
            })
            ->selectRaw('
                type,
                TRIM(payment_method) as payment_method,
                SUM(paid_amount) as amount
            ')
            ->groupBy('type', DB::raw('TRIM(payment_method)'))
            ->get();

        $paymentBreakdown = $paymentBreakdownFromTransactions->concat($paymentBreakdownFromInvoices);

        // Organize totals
        $summary = [
            'sale' => [
                'qty' => 0,
                'discount' => 0,
                'total' => 0,
                'paid_amount' => 0,
                'due_amount' => 0,
                'cash' => 0,
                'card' => 0,
                'payment_methods' => [],
            ],
            'purchase' => [
                'qty' => 0,
                'discount' => 0,
                'total' => 0,
                'paid_amount' => 0,
                'due_amount' => 0,
                'cash' => 0,
                'card' => 0,
                'payment_methods' => [],
            ],
        ];

        foreach ($totalsByType as $row) {
            $type = $row->type;
            if (isset($summary[$type])) {
                $summary[$type]['qty'] = $row->total_qty ?? 0;
                $summary[$type]['discount'] = $row->total_discount ?? 0;
                $summary[$type]['total'] = $row->total_amount ?? 0;
                $summary[$type]['paid_amount'] = $row->total_paid ?? 0;
                $summary[$type]['due_amount'] = $row->total_due ?? 0;
            }
        }

        foreach ($paymentBreakdown as $row) {
            $type = $row->type;
            $methodName = trim((string) $row->payment_method);
            $method = strtolower($methodName);
            $amount = (float) ($row->amount ?? 0);

            if ($methodName === '' || !isset($summary[$type])) {
                continue;
            }

            $isCash = in_array($method, ['cash', 'cash on delivery', 'cod']);
            $isCard = str_contains($method, 'card') || in_array($method, ['credit card', 'debit card', 'visa', 'mastercard']);

            $summary[$type]['payment_methods'][$methodName] =
                ($summary[$type]['payment_methods'][$methodName] ?? 0) + $amount;

            if ($isCash) {
                $summary[$type]['cash'] += $amount;
            } elseif ($isCard) {
                $summary[$type]['card'] += $amount;
            }
        }

        $grandPaymentMethods = [];
        foreach (['sale', 'purchase'] as $invoiceType) {
            foreach ($summary[$invoiceType]['payment_methods'] as $methodName => $amount) {
                $grandPaymentMethods[$methodName] =
                    ($grandPaymentMethods[$methodName] ?? 0) + $amount;
            }
        }

        // Also calculate grand total
        $grandTotal = [
            'qty' => $summary['sale']['qty'] + $summary['purchase']['qty'],
            'discount' => $summary['sale']['discount'] + $summary['purchase']['discount'],
            'total' => $summary['sale']['total'] + $summary['purchase']['total'],
            'paid_amount' => $summary['sale']['paid_amount'] + $summary['purchase']['paid_amount'],
            'due_amount' => $summary['sale']['due_amount'] + $summary['purchase']['due_amount'],
            'cash' => $summary['sale']['cash'] + $summary['purchase']['cash'],
            'card' => $summary['sale']['card'] + $summary['purchase']['card'],
            'payment_methods' => $grandPaymentMethods,
        ];

        return response()->json([
            'status' => 1,
            'message' => 'Invoice fetched successfully',
            'data' => $responseData,
            'meta' => $responseMeta,
            'summary' => [
                'sales' => $summary['sale'],
                'purchases' => $summary['purchase'],
                'grand' => $grandTotal,
            ]
        ], 200);
    }

    public function draftsList(Request $request)
    {
        $limit = max(1, min((int) $request->input('limit', 100), 500));
        $authUser = Auth::user();

        if (!$authUser) {
            return response()->json([
                'status' => 0,
                'message' => 'Unauthorized',
            ], 401);
        }

        $canViewAnyDrafts = Helper::hasRight('invoice.sale.draft.finalize.any', $authUser->role);

        $draftQuery = Invoice::with(['items.product', 'customer'])
            ->where('type', 'draft');

        if (!$canViewAnyDrafts) {
            $draftQuery->where('user_id', $authUser->id);
        }

        $drafts = $draftQuery
            ->latest('updated_at')
            ->limit($limit)
            ->get()
            ->map(function ($invoice) {
                $customerName = trim(
                    (($invoice?->customer?->first_name ?? '') . ' ' . ($invoice?->customer?->last_name ?? ''))
                );

                return [
                    'id' => $invoice->id,
                    'invoice_no' => $invoice->invoice_no,
                    'date' => $invoice->date,
                    'customer_id' => $invoice->customer_id,
                    'customer_name' => $customerName ?: 'Walk-in',
                    'total' => (float) ($invoice->total ?? 0),
                    'sub_total' => (float) ($invoice->sub_total ?? 0),
                    'discount' => (float) ($invoice->discount ?? 0),
                    'vat' => (float) ($invoice->vat ?? 0),
                    'paid_amount' => (float) ($invoice->paid_amount ?? 0),
                    'due_amount' => (float) ($invoice->due_amount ?? 0),
                    'change_due' => (float) ($invoice->change_due ?? 0),
                    'note' => $invoice->note,
                    'qty' => (float) ($invoice->qty ?? 0),
                    'created_at' => $invoice->created_at,
                    'updated_at' => $invoice->updated_at,
                    'customer' => [
                        'id' => $invoice?->customer?->id,
                        'name' => $customerName ?: 'Walk-in',
                        'phone' => $invoice?->customer?->phone,
                        'email' => $invoice?->customer?->email,
                        'address' => $invoice?->customer?->address,
                        'reward_points' => $invoice?->customer?->total_reword ?? 0,
                    ],
                    'items' => $invoice->items,
                    'draft_payload' => $invoice->draft_payload,
                ];
            });

        return response()->json([
            'status' => 1,
            'message' => 'Drafts fetched successfully',
            'data' => $drafts,
        ]);
    }

    public function store(Request $request, ProductBundleService $productBundleService, ?string $channelCode = null)
    {
        $settings = PosSetting::where('key', 'payment_methods')->first();
        $paymentMethods = $this->normalizePaymentMethods($settings?->value);
        $validator = Validator::make($request->all(), [
            'type' => 'required|in:sale,purchase,return,draft,quotation',
            'draft_id' => 'nullable|exists:invoices,id',
            'company_id' => 'nullable|exists:companies,id',
            'warehouse_id' => 'nullable|exists:warehouses,id',
            'customer_id' => 'nullable|exists:user,id',
            'date' => 'required|date',
            'items' => 'required|array|min:1',
            'items.*.item_type' => 'nullable|in:product,bundle',
            'items.*.product_id' => 'nullable|exists:product,id',
            'items.*.bundle_id' => 'nullable|exists:product_bundles,id',
            'items.*.inventory_id' => 'nullable|exists:inventory,id',
            'items.*.variant_id' => 'nullable|exists:product_variants,id',
            'items.*.qty' => 'required|numeric',
            'items.*.unit_price' => 'nullable|numeric|min:0',
            'items.*.discount' => 'nullable|numeric|min:0',
            'items.*.discount_type' => 'nullable|in:percent,fixed,flat',
            'discount' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|in:percent,flat',
            'global_tax_percentage' => 'nullable|numeric|min:0|max:100',
            'global_vat_percentage' => 'nullable|numeric|min:0|max:100',
            'paid_amount' => 'nullable|numeric|min:0',
            'change_due' => 'nullable|numeric|min:0',
            'grandTotal' => 'required|numeric|min:0',
            'payments' => 'nullable|array',
            'payments.*.payment_method' => ['required', function ($attribute, $value, $fail) use ($paymentMethods) {
                $method = $this->findPaymentMethod($paymentMethods, $value);
                if (!$method || !$method['enabled']) {
                    $fail('The selected payment method is not enabled.');
                }
            }],
            'payments.*.amount' => 'required|numeric|min:0',
            'payments.*.card_type' => 'nullable|string',
            'payments.*.card_last_digits' => [function ($attribute, $value, $fail) use ($request, $paymentMethods) {
                // Extract payment method index from attribute name (e.g., payments.0.card_last_digits)
                preg_match('/payments\.(\d+)\./', $attribute, $matches);
                $index = $matches[1] ?? null;
                
                if ($index !== null && isset($request->payments[$index])) {
                    $paymentMethod = $request->payments[$index]['payment_method'] ?? null;
                    if ($paymentMethod && in_array($paymentMethod, ['Card', 'Refund to Card'])) {
                        $method = $this->findPaymentMethod($paymentMethods, $paymentMethod);
                        if ($method && $method['config']['require_last_digits']) {
                            if (!$value) {
                                $fail('Card last digits are required.');
                            } else {
                                $allowedLengths = $method['config']['last_digit_length'] ?? [5, 6];
                                if (!in_array(strlen($value), $allowedLengths)) {
                                    $fail("Card last digits must be " . implode(' or ', $allowedLengths) . " digits.");
                                }
                            }
                        }
                    }
                }
            }],
            'payments.*.mf_type' => [function ($attribute, $value, $fail) use ($request, $paymentMethods) {
                // Extract payment method index from attribute name
                preg_match('/payments\.(\d+)\./', $attribute, $matches);
                $index = $matches[1] ?? null;
                
                if ($index !== null && isset($request->payments[$index])) {
                    $paymentMethod = $request->payments[$index]['payment_method'] ?? null;
                    if ($paymentMethod === 'Refund to MF' && !$value) {
                        $fail('Mobile financial service type is required for refund.');
                    } elseif ($paymentMethod === 'Refund to MF' && $value) {
                        $method = $this->findPaymentMethod($paymentMethods, 'Refund to MF');
                        $allowedProviders = $method['config']['providers'] ?? [];
                        if (!in_array($value, $allowedProviders)) {
                            $fail('Invalid mobile financial service provider for refund.');
                        }
                    }
                }
            }],
            'payments.*.mf_number' => 'nullable|required_if:payments.*.payment_method,Refund to MF|regex:/^\+?\d{10,15}$/',
            'payments.*.qr_provider' => [function ($attribute, $value, $fail) use ($request, $paymentMethods) {
                // Extract payment method index from attribute name
                preg_match('/payments\.(\d+)\./', $attribute, $matches);
                $index = $matches[1] ?? null;
                
                if ($index !== null && isset($request->payments[$index])) {
                    $paymentMethod = $request->payments[$index]['payment_method'] ?? null;
                    if ($paymentMethod === 'QR Payment' && !$value) {
                        $fail('QR provider is required.');
                    } elseif ($paymentMethod === 'QR Payment' && $value) {
                        $method = $this->findPaymentMethod($paymentMethods, 'QR Payment');
                        $allowedProviders = $method['config']['providers'] ?? [];
                        if (!in_array($value, $allowedProviders)) {
                            $fail('Invalid QR provider.');
                        }
                    }
                }
            }],
            'payments.*.qr_transaction_id' => 'nullable|required_if:payments.*.payment_method,QR Payment',
            'points_used' => 'nullable|numeric|min:0',
            'points_earned' => 'nullable|numeric|min:0',
            'is_fracture' => 'nullable',
            'original_invoice_id' => 'required_if:type,return|exists:invoices,id',
            'payment_schedule' => 'nullable|array',
            'payment_schedule.*.amount' => 'required_with:payment_schedule|numeric|min:0',
            'payment_schedule.*.due_date' => 'required_with:payment_schedule|date|after_or_equal:today',
            'payment_schedule.*.remainder_date' => 'nullable|date|after_or_equal:due_date',
            'draft_payload' => 'nullable|array',
        ], [
            'type.required' => 'Transaction type is required.',
            'type.in' => 'Transaction type must be sale, purchase, return, draft, or quotation.',
            'date.required' => 'Invoice date is required.',
            'date.date' => 'Invoice date format is invalid.',
            'items.required' => 'At least one item is required.',
            'items.array' => 'Items must be sent as a list.',
            'items.min' => 'At least one item is required.',
            'items.*.product_id.required' => 'Product is required for each item row.',
            'items.*.product_id.exists' => 'One or more selected products are invalid.',
            'items.*.inventory_id.required_if' => 'Inventory is required for each item row.',
            'items.*.inventory_id.exists' => 'One or more selected inventories are invalid.',
            'items.*.qty.required' => 'Quantity is required for each item row.',
            'items.*.qty.numeric' => 'Quantity must be a number.',
            'items.*.unit_price.required' => 'Unit price is required for each item row.',
            'items.*.unit_price.numeric' => 'Unit price must be a number.',
            'items.*.unit_price.min' => 'Unit price cannot be negative.',
            'payments.array' => 'Payments must be sent as a list.',
            'payments.*.payment_method.required' => 'Payment method is required for each payment row.',
            'payments.*.amount.required' => 'Payment amount is required for each payment row.',
            'payments.*.amount.numeric' => 'Payment amount must be a number.',
            'payments.*.amount.min' => 'Payment amount cannot be negative.',
            'payments.*.mf_number.regex' => 'Mobile number must be 10 to 15 digits.',
            'payment_schedule.array' => 'Payment schedule must be sent as a list.',
            'payment_schedule.*.amount.required_with' => 'Schedule amount is required.',
            'payment_schedule.*.amount.numeric' => 'Schedule amount must be a number.',
            'payment_schedule.*.amount.min' => 'Schedule amount cannot be negative.',
            'payment_schedule.*.due_date.required_with' => 'Schedule due date is required.',
            'payment_schedule.*.due_date.date' => 'Schedule due date format is invalid.',
            'payment_schedule.*.due_date.after_or_equal' => 'Schedule due date cannot be earlier than today.',
            'payment_schedule.*.remainder_date.date' => 'Reminder date format is invalid.',
            'payment_schedule.*.remainder_date.after_or_equal' => 'Reminder date cannot be earlier than due date.',
        ], [
            'items.*.product_id' => 'item product',
            'items.*.inventory_id' => 'item inventory',
            'items.*.qty' => 'item quantity',
            'items.*.unit_price' => 'item unit price',
            'payments.*.payment_method' => 'payment method',
            'payments.*.amount' => 'payment amount',
            'payments.*.card_last_digits' => 'card last digits',
            'payments.*.mf_type' => 'mobile financial service type',
            'payments.*.mf_number' => 'mobile number',
            'payments.*.qr_provider' => 'QR provider',
            'payments.*.qr_transaction_id' => 'QR transaction ID',
            'payment_schedule.*.amount' => 'schedule amount',
            'payment_schedule.*.due_date' => 'schedule due date',
            'payment_schedule.*.remainder_date' => 'schedule reminder date',
        ]);

        $validator->after(function ($validator) use ($request) {
            foreach ((array) $request->input('items', []) as $index => $item) {
                $itemType = $item['item_type'] ?? (!empty($item['bundle_id']) ? 'bundle' : 'product');
                $hasProduct = !empty($item['product_id']);
                $hasBundle = !empty($item['bundle_id']);

                if (!$hasProduct && !$hasBundle) {
                    $validator->errors()->add("items.{$index}.product_id", 'Each item must contain either a product or a bundle.');
                }

                if ($hasProduct && $hasBundle) {
                    $validator->errors()->add("items.{$index}.bundle_id", 'An item cannot contain both a product and a bundle.');
                }

                if ($itemType === 'bundle' && !in_array($request->type, ['sale', 'draft', 'quotation'], true)) {
                    $validator->errors()->add("items.{$index}.bundle_id", 'Bundles are only supported for sale, draft, or quotation transactions.');
                }

                $isReturnLine = filter_var($item['is_return'] ?? false, FILTER_VALIDATE_BOOLEAN);
                $canResolveReturnInventory = $request->type === 'return'
                    && $isReturnLine
                    && !empty($item['original_sale_item_id']);

                if (
                    $itemType === 'product'
                    && in_array($request->type, ['return', 'draft'], true)
                    && empty($item['inventory_item_id'])
                    && !$canResolveReturnInventory
                ) {
                    $validator->errors()->add("items.{$index}.inventory_item_id", 'Inventory item is required for each product row.');
                }
            }
        });

        if ($validator->fails()) {
            $firstError = collect($validator->errors()->all())->first() ?? 'Validation failed. Please check highlighted fields.';
            return response()->json([
                'status' => 0,
                'message' => $firstError,
                'errors' => $validator->errors(),
            ], 422);
        }

        DB::beginTransaction();

        try {
            $isReturn = $request->type === 'return';
            $isDraft = $request->type === 'draft';
            $isQuotation = $request->type === 'quotation';
            $channelCode = (!$isDraft && !$isQuotation && $request->type === 'sale')
                ? $channelCode
                : null;
            $couponData = null;
            $existingDraft = null;

            if ($isDraft && $request->filled('draft_id')) {
                $existingDraft = Invoice::where('id', $request->draft_id)
                    ->where('type', 'draft')
                    ->first();

                if (!$existingDraft) {
                    throw new \Exception('Draft not found');
                }

                $canViewAnyDrafts = Helper::hasRight('invoice.sale.draft.finalize.any', optional(Auth::user())->role);
                if (!$canViewAnyDrafts && $existingDraft->user_id !== Auth::id()) {
                    throw new \Exception('You are not allowed to update this draft');
                }
            }

            // Verify coupon/gift card if provided and not in return mode
            if (!$isReturn && !$isDraft && !$isQuotation && $request->coupon_code) {
                $code = $request->coupon_code;

                // Check for valid Coupon
                $coupon = DiscountSetup::where('code', $code)
                    ->where('is_active', true)
                    ->where('type', 'coupon')
                    ->where('form_date', '<=', now())
                    ->where('to_date', '>=', now())
                    ->first();

                if ($coupon) {
                    $couponData = [
                        'setup_id' => $coupon->id,
                        'code' => $coupon->code,
                        'discount_amount' => $coupon->amount,
                        'discount_type' => $coupon->discount_type,
                    ];
                } else {
                    // Check for valid Gift Card
                    $giftCard = RewordCard::where('card_number', $code)
                        ->where('is_redeemed', false)
                        ->whereHas('setup', function ($query) {
                            $query->where('is_active', true)
                                ->where('type', 'reward_card')
                                ->where('form_date', '<=', now())
                                ->where('to_date', '>=', now());
                        })
                        ->first();

                    if ($giftCard) {
                        $couponData = [
                            'setup_id' => $giftCard->id,
                            'code' => $giftCard->card_number,
                            'discount_amount' => $giftCard->setup->amount,
                            'discount_type' => $giftCard->setup->discount_type,
                            'is_gift_card' => true,
                        ];
                    } else {
                        throw new \Exception('Invalid or expired coupon/gift card code');
                    }
                }
            }

            /** -------------------------
             *  RETURN FLOW
             *  ------------------------*/
            if ($isReturn) {
                $originalInvoice = Invoice::findOrFail($request->original_invoice_id);
                if ($originalInvoice->type !== 'sale') {
                    throw new \Exception('Only sale invoices can be returned.');
                }
                if ($this->invoiceAlreadyUsedForReturn($originalInvoice)) {
                    throw new \Exception('This invoice has already been used for return.');
                }

                $returnInvoice = new Invoice();
                $returnInvoice->type = 'return';
                $returnInvoice->original_invoice_id = $originalInvoice->id;
                $returnInvoice->warehouse_id = $originalInvoice->warehouse_id;
                $returnInvoice->user_id = Auth::id();
                $returnInvoice->customer_id = $originalInvoice->customer_id;
                $returnInvoice->date = $request->date;
                $returnInvoice->note = $request->note ?? null;
                $returnInvoice->card_type = $request->card_type ?? null;
                $returnInvoice->card_last_digits = $request->card_last_digits ?? null;
                $returnInvoice->mf_type = $request->mf_type ?? null;
                $returnInvoice->mf_number = $request->mf_number ?? null;
                $returnInvoice->qr_provider = $request->qr_provider ?? null;
                $returnInvoice->qr_transaction_id = $request->qr_transaction_id ?? null;
                $returnInvoice->points_used = 0;
                $returnInvoice->points_earned = 0;
                $returnInvoice->save();

                $subTotal = 0;
                $totalTax = 0;
                $totalVat = 0;
                $totalDiscount = 0;
                $totalQty = 0;
                $returnReverseSubtotal = 0;
                $returnReverseTax = 0;
                $returnReverseVat = 0;
                $validReturnLineFound = false;
                $salesReturnItemsPayload = [];

                foreach ($request->items as $item) {
                    $isReturnLine = filter_var($item['is_return'] ?? false, FILTER_VALIDATE_BOOLEAN);
                    if (!$isReturnLine) {
                        $exchangeQty = abs((float) ($item['qty'] ?? 0));
                        if ($exchangeQty <= 0) {
                            continue;
                        }

                        $inventoryItem = InventoryItem::query()
                            ->lockForUpdate()
                            ->find($item['inventory_item_id'] ?? null);
                        if (!$inventoryItem) {
                            throw new \Exception("Inventory item not found for exchange product ID: {$item['product_id']}");
                        }

                        $exchangeInventory = Inventory::query()
                            ->lockForUpdate()
                            ->find($item['inventory_id'] ?? $inventoryItem->inventory_id);
                        if (!$exchangeInventory || (float) $exchangeInventory->quantity < $exchangeQty) {
                            throw new \Exception("Insufficient inventory for exchange product ID: {$item['product_id']}");
                        }
                        if ((float) $inventoryItem->quantity < $exchangeQty) {
                            throw new \Exception("Insufficient inventory item stock for exchange product ID: {$item['product_id']}");
                        }

                        $basePrice = $exchangeQty * (float) ($item['unit_price'] ?? 0);
                        $discountAmount = $basePrice * ((float) ($item['discount'] ?? 0) / 100);
                        $taxAmount = $exchangeQty * (float) ($item['unit_price'] ?? 0) * ((float) ($item['tax_rate'] ?? 0) / 100);
                        $vatAmount = $exchangeQty * (float) ($item['unit_price'] ?? 0) * ((float) ($item['vat_rate'] ?? 0) / 100);
                        $itemTotal = $basePrice - $discountAmount + $taxAmount + $vatAmount;

                        $invoiceItem = new InvoiceItem();
                        $invoiceItem->warehouse_id = $returnInvoice->warehouse_id;
                        $invoiceItem->invoice_id = $returnInvoice->id;
                        $invoiceItem->type = 'sale';
                        $invoiceItem->date = $returnInvoice->date;
                        $invoiceItem->user_id = Auth::id();
                        $invoiceItem->company_id = $originalInvoice->company_id;
                        $invoiceItem->item_type = 'product';
                        $invoiceItem->bundle_id = null;
                        $invoiceItem->bundle_name = null;
                        $invoiceItem->product_id = $item['product_id'];
                        if (Schema::hasColumn('invoice_items', 'inventory_item_id')) {
                            $invoiceItem->inventory_item_id = $inventoryItem->id;
                        }
                        $invoiceItem->variant_id = is_array($inventoryItem->variant_id) ? $inventoryItem->variant_id : null;
                        $invoiceItem->inventory_id = $inventoryItem->inventory_id;
                        $invoiceItem->lot_number = $item['lot_number'] ?? $inventoryItem->lot_number;
                        $invoiceItem->qty = $exchangeQty;
                        $invoiceItem->unit_price = (float) ($item['unit_price'] ?? 0);
                        $invoiceItem->discount = (float) ($item['discount'] ?? 0);
                        $invoiceItem->discount_amount = $discountAmount;
                        if (Schema::hasColumn('invoice_items', 'tax_rate')) {
                            $invoiceItem->tax_rate = (float) ($item['tax_rate'] ?? 0);
                        }
                        if (Schema::hasColumn('invoice_items', 'tax')) {
                            $invoiceItem->tax = $taxAmount;
                        }
                        if (Schema::hasColumn('invoice_items', 'vat_rate')) {
                            $invoiceItem->vat_rate = (float) ($item['vat_rate'] ?? 0);
                        }
                        if (Schema::hasColumn('invoice_items', 'vat')) {
                            $invoiceItem->vat = $vatAmount;
                        }
                        $invoiceItem->total = $itemTotal;
                        $invoiceItem->save();

                        $exchangeInventoryBefore = (float) $exchangeInventory->quantity;
                        $exchangeInventory->quantity = round($exchangeInventoryBefore - $exchangeQty, 6);
                        $exchangeInventory->save();

                        $inventoryItem->quantity = round((float) $inventoryItem->quantity - $exchangeQty, 6);
                        $inventoryItem->save();

                        $invoiceHistory = new InventoryHistory();
                        $invoiceHistory->invoice_id = $returnInvoice->id;
                        $invoiceHistory->type = 'sale';
                        $invoiceHistory->company_id = $originalInvoice->company_id;
                        $invoiceHistory->product_id = $item['product_id'];
                        $invoiceHistory->inventory_item_id = $inventoryItem->id;
                        $invoiceHistory->variant = is_array($inventoryItem->variant_id)
                            ? json_encode($inventoryItem->variant_id, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
                            : null;
                        $invoiceHistory->inventory_id = $inventoryItem->inventory_id;
                        $invoiceHistory->lot_number = $item['lot_number'] ?? $inventoryItem->lot_number;
                        $invoiceHistory->barcode = $item['barcode'] ?? $inventoryItem->barcode;
                        $invoiceHistory->quantity = $exchangeQty;
                        $invoiceHistory->unit_price = (float) ($item['unit_price'] ?? 0);
                        $invoiceHistory->original_unit_price = (float) ($inventoryItem->price ?? 0);
                        $invoiceHistory->discount = (float) ($item['discount'] ?? 0);
                        $invoiceHistory->discount_amount = $discountAmount;
                        $invoiceHistory->total = $itemTotal;
                        $invoiceHistory->save();

                        app(StockMovementService::class)->record([
                            'company_id' => $originalInvoice->company_id,
                            'product_id' => $item['product_id'],
                            'inventory_id' => $exchangeInventory->id,
                            'inventory_item_id' => $inventoryItem->id,
                            'warehouse_id' => $invoiceItem->warehouse_id,
                            'type' => StockMovementService::TYPE_SOLD,
                            'quantity_change' => -1 * $exchangeQty,
                            'quantity_before' => $exchangeInventoryBefore,
                            'quantity_after' => (float) $exchangeInventory->quantity,
                            'reference_type' => StockMovementService::REF_INVOICE_ITEM,
                            'reference_id' => $invoiceItem->id,
                            'note' => 'Exchange product sold',
                        ]);

                        $subTotal += $itemTotal;
                        $totalTax += $taxAmount;
                        $totalVat += $vatAmount;
                        $totalDiscount += $discountAmount;
                        $totalQty += $exchangeQty;

                        continue;
                    }
                    $validReturnLineFound = true;

                    $originalSaleItemId = $item['original_sale_item_id'] ?? null;
                    if (!$originalSaleItemId) {
                        throw new \Exception('Original sale item is required for all return rows.');
                    }

                    $originalSaleItem = InvoiceItem::query()->findOrFail($originalSaleItemId);
                    if ($originalSaleItem->invoice_id !== $originalInvoice->id) {
                        throw new \Exception('One or more return items do not belong to the selected original invoice.');
                    }

                    $requestedQty = abs((float) ($item['qty'] ?? 0));
                    if ($requestedQty <= 0) {
                        throw new \Exception('Return quantity must be greater than zero.');
                    }

                    $alreadyReturnedQty = abs((float) InvoiceItem::query()
                        ->where('original_sale_item_id', $originalSaleItemId)
                        ->where('type', 'return')
                        ->sum('qty'));
                    $saleQty = abs((float) $originalSaleItem->qty);
                    $remainingQty = round($saleQty - $alreadyReturnedQty, 6);
                    if ($remainingQty <= 0) {
                        throw new \Exception('This item has already been fully returned.');
                    }
                    if ($requestedQty > $remainingQty) {
                        throw new \Exception("Return quantity exceeds available return quantity. Remaining: {$remainingQty}");
                    }

                    $inventory = Inventory::query()->lockForUpdate()->findOrFail($originalSaleItem->inventory_id);
                    $inventoryItem = InventoryItem::withTrashed()->lockForUpdate()
                        ->where('id', $item['inventory_item_id'] ?? ($originalSaleItem->inventory_item_id ?? null))
                        ->first();
                    if (!$inventoryItem) {
                        $inventoryItem = InventoryItem::withTrashed()->lockForUpdate()
                            ->where('invoice_item_id', $originalSaleItem->id)
                            ->first();
                    }
                    if (!$inventoryItem) {
                        $inventoryItem = InventoryItem::withTrashed()->lockForUpdate()
                            ->where('inventory_id', $originalSaleItem->inventory_id)
                            ->where('product_id', $originalSaleItem->product_id)
                            ->where('lot_number', $originalSaleItem->lot_number)
                            ->first();
                    }
                    if (!$inventoryItem) {
                        $inventoryItem = InventoryItem::withTrashed()->lockForUpdate()
                            ->where('inventory_id', $originalSaleItem->inventory_id)
                            ->where('product_id', $originalSaleItem->product_id)
                            ->when(!empty($item['barcode']), function ($query) use ($item) {
                                $query->where(function ($inner) use ($item) {
                                    $inner->where('barcode', $item['barcode'])
                                        ->orWhere('sku', $item['barcode']);
                                });
                            })
                            ->first();
                    }
                    if ($inventoryItem && method_exists($inventoryItem, 'trashed') && $inventoryItem->trashed()) {
                        $inventoryItem->restore();
                    }
                    if (!$inventoryItem) {
                        throw new \Exception('Inventory item not found for one or more return rows.');
                    }

                    $inventory->quantity = round((float) $inventory->quantity + $requestedQty, 6);
                    $inventory->save();

                    $inventoryItem->quantity = round((float) $inventoryItem->quantity + $requestedQty, 6);
                    $inventoryItem->save();

                    $unitPrice = (float) ($originalSaleItem->unit_price ?? $item['unit_price'] ?? 0);
                    $basePrice = $requestedQty * $unitPrice;
                    $taxRate = (float) ($originalSaleItem->tax_rate ?? $item['tax_rate'] ?? 0);
                    $vatRate = (float) ($originalSaleItem->vat_rate ?? $item['vat_rate'] ?? 0);
                    $taxAmount = round($basePrice * ($taxRate / 100), 2);
                    $vatAmount = round($basePrice * ($vatRate / 100), 2);
                    $discountAmount = 0;
                    $itemTotal = round($basePrice + $taxAmount + $vatAmount - $discountAmount, 2);

                    $invoiceItem = new InvoiceItem();
                    $invoiceItem->warehouse_id = $returnInvoice->warehouse_id;
                    $invoiceItem->invoice_id = $returnInvoice->id;
                    $invoiceItem->type = 'return';
                    $invoiceItem->date = $returnInvoice->date;
                    $invoiceItem->user_id = Auth::id();
                    $invoiceItem->company_id = $originalInvoice->company_id;
                    $invoiceItem->item_type = 'product';
                    $invoiceItem->bundle_id = null;
                    $invoiceItem->bundle_name = null;
                    $invoiceItem->product_id = $originalSaleItem->product_id;
                    $invoiceItem->variant_id = $originalSaleItem->variant_id;
                    $invoiceItem->inventory_id = $originalSaleItem->inventory_id;
                    $invoiceItem->lot_number = $originalSaleItem->lot_number;
                    $invoiceItem->qty = -$requestedQty;
                    $invoiceItem->unit_price = $unitPrice;
                    $invoiceItem->discount = 0;
                    $invoiceItem->discount_amount = 0;
                    if (Schema::hasColumn('invoice_items', 'tax_rate')) {
                        $invoiceItem->tax_rate = $taxRate;
                    }
                    if (Schema::hasColumn('invoice_items', 'tax')) {
                        $invoiceItem->tax = $taxAmount;
                    }
                    if (Schema::hasColumn('invoice_items', 'vat_rate')) {
                        $invoiceItem->vat_rate = $vatRate;
                    }
                    if (Schema::hasColumn('invoice_items', 'vat')) {
                        $invoiceItem->vat = $vatAmount;
                    }
                    $invoiceItem->total = -$itemTotal;
                    $invoiceItem->is_returned = 1;
                    $invoiceItem->original_sale_item_id = $originalSaleItemId;
                    $invoiceItem->save();

                    $invoiceHistory = new InventoryHistory();
                    $invoiceHistory->invoice_id = $returnInvoice->id;
                    $invoiceHistory->type = 'return';
                    $invoiceHistory->company_id = $originalInvoice->company_id;
                    $invoiceHistory->product_id = $originalSaleItem->product_id;
                    $invoiceHistory->inventory_item_id = $inventoryItem->id;
                    $invoiceHistory->variant = is_array($inventoryItem->variant_id)
                        ? json_encode($inventoryItem->variant_id, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
                        : null;
                    $invoiceHistory->inventory_id = $originalSaleItem->inventory_id;
                    $invoiceHistory->lot_number = $originalSaleItem->lot_number;
                    $invoiceHistory->barcode = $item['barcode'] ?? null;
                    $invoiceHistory->quantity = -$requestedQty;
                    $invoiceHistory->unit_price = $unitPrice;
                    $invoiceHistory->original_unit_price = (float) ($inventoryItem->price ?? 0);
                    $invoiceHistory->discount = 0;
                    $invoiceHistory->discount_amount = 0;
                    $invoiceHistory->total = -$itemTotal;
                    $invoiceHistory->save();

                    $subTotal -= $itemTotal;
                    $totalTax -= $taxAmount;
                    $totalVat -= $vatAmount;
                    $totalDiscount += $discountAmount;
                    $totalQty -= $requestedQty;
                    $returnReverseSubtotal += $itemTotal;
                    $returnReverseTax += $taxAmount;
                    $returnReverseVat += $vatAmount;

                    $salesReturnItemsPayload[] = [
                        'original_sale_item_id' => $originalSaleItem->id,
                        'product_id' => $originalSaleItem->product_id,
                        'inventory_id' => $originalSaleItem->inventory_id,
                        'inventory_item_id' => $inventoryItem->id,
                        'lot_number' => $originalSaleItem->lot_number,
                        'sold_qty' => $saleQty,
                        'returned_before_qty' => $alreadyReturnedQty,
                        'return_qty' => $requestedQty,
                        'unit_price' => $unitPrice,
                        'discount_reverse' => $discountAmount,
                        'tax_reverse' => $taxAmount,
                        'vat_reverse' => $vatAmount,
                        'line_total_reverse' => $itemTotal,
                        'reason_code' => null,
                        'is_damaged' => false,
                        'restock_type' => 'good',
                    ];
                }

                if (!$validReturnLineFound) {
                    throw new \Exception('No valid return items found in request.');
                }

                // Apply global tax and VAT on subtotal
                $globalTaxAmount = $subTotal * ($request->global_tax_percentage / 100 ?? 0);
                $globalVatAmount = $subTotal * ($request->global_vat_percentage / 100 ?? 0);
                $invoiceDiscount = $request->discount_type === 'percent'
                    ? $subTotal * ($request->discount / 100 ?? 0)
                    : ($request->discount ?? 0);
                $grandTotal = $subTotal + $globalTaxAmount + $globalVatAmount - $invoiceDiscount;
                $settlementTotal = abs($grandTotal);

                $totalPaid = 0;
                if ($request->has('payments') && is_array($request->payments)) {
                    foreach ($request->payments as $payment) {
                        $totalPaid += (float) ($payment['amount'] ?? 0);
                    }
                } else {
                    $totalPaid = (float) ($request->paid_amount ?? $settlementTotal);
                }

                $returnInvoice->qty = $totalQty;
                $returnInvoice->discount = $totalDiscount + $invoiceDiscount;
                $returnInvoice->vat_rate = $request->global_vat_percentage ?? 0;
                $returnInvoice->vat = $globalVatAmount;
                $returnInvoice->sub_total = $settlementTotal;
                $returnInvoice->total = $settlementTotal;
                $returnInvoice->due_amount = max($settlementTotal - $totalPaid, 0);
                $returnInvoice->paid_amount = $totalPaid;
                $returnInvoice->change_due = max($totalPaid - $settlementTotal, 0);
                $returnInvoice->payment_status = abs($totalPaid - $settlementTotal) < 0.01 ? 1 : (($totalPaid > 0) ? 2 : 0);
                if ($request->has('payments') && is_array($request->payments) && count($request->payments) > 0) {
                    $returnInvoice->payment_method = $request->payments[0]['payment_method'] ?? null;
                } else {
                    $returnInvoice->payment_method = $request->payment_method ?? null;
                }
                $returnInvoice->save();

                if ($request->has('payments') && is_array($request->payments)) {
                    foreach ($request->payments as $payment) {
                        $amount = (float) ($payment['amount'] ?? 0);
                        if ($amount <= 0) {
                            continue;
                        }
                        Transaction::create([
                            'invoice_id' => $returnInvoice->id,
                            'user_id' => Auth::id(),
                            'amount' => $amount,
                            'payment_method' => $payment['payment_method'] ?? null,
                            'card_type' => $payment['card_type'] ?? null,
                            'card_last_digits' => $payment['card_last_digits'] ?? null,
                            'mf_type' => $payment['mf_type'] ?? null,
                            'mf_number' => $payment['mf_number'] ?? null,
                            'qr_provider' => $payment['qr_provider'] ?? null,
                            'qr_transaction_id' => $payment['qr_transaction_id'] ?? null,
                            'transaction_date' => $request->date,
                        ]);
                    }
                } elseif ($totalPaid > 0) {
                    Transaction::create([
                        'invoice_id' => $returnInvoice->id,
                        'user_id' => Auth::id(),
                        'amount' => $totalPaid,
                        'payment_method' => $request->payment_method,
                        'card_last_digits' => $request->card_last_digits ?? null,
                        'mf_type' => $request->mf_type ?? null,
                        'mf_number' => $request->mf_number ?? null,
                        'qr_provider' => $request->qr_provider ?? null,
                        'qr_transaction_id' => $request->qr_transaction_id ?? null,
                        'transaction_date' => $request->date,
                    ]);
                }

                // Sell return log for POS return flow
                $exchangeTotal = max($subTotal + $returnReverseSubtotal, 0);
                $refundAmount = max($returnReverseSubtotal - $exchangeTotal, 0);
                $extraPayable = max($exchangeTotal - $returnReverseSubtotal, 0);
                $reverseSubtotal = max($returnReverseSubtotal - $returnReverseTax - $returnReverseVat, 0);
                $salesReturn = SalesReturn::create([
                    'company_id' => $originalInvoice->company_id,
                    'branch_id' => optional(Auth::user())->branch_id ?? null,
                    'warehouse_id' => $originalInvoice->warehouse_id,
                    'original_invoice_id' => $originalInvoice->id,
                    'return_invoice_id' => $returnInvoice->id,
                    'customer_id' => $originalInvoice->customer_id,
                    'cashier_id' => Auth::id(),
                    'return_type' => 'refund',
                    'status' => 'completed',
                    'subtotal_reverse' => $reverseSubtotal,
                    'tax_reverse' => $returnReverseTax,
                    'vat_reverse' => $returnReverseVat,
                    'total_reverse' => $returnReverseSubtotal,
                    'exchange_total' => $exchangeTotal,
                    'refund_amount' => $refundAmount,
                    'extra_payable' => $extraPayable,
                    'refund_method' => $returnInvoice->payment_method,
                    'approval_required' => false,
                    'approved_by' => null,
                    'approved_at' => null,
                    'note' => $request->note ?? null,
                ]);

                foreach ($salesReturnItemsPayload as $row) {
                    SalesReturnItem::create(array_merge($row, [
                        'sales_return_id' => $salesReturn->id,
                    ]));
                }

                if ($request->has('payments') && is_array($request->payments)) {
                    foreach ($request->payments as $payment) {
                        $amount = (float) ($payment['amount'] ?? 0);
                        if ($amount <= 0) {
                            continue;
                        }

                        SalesReturnPayment::create([
                            'sales_return_id' => $salesReturn->id,
                            'payment_method' => $payment['payment_method'] ?? 'Cash Refund',
                            'amount' => $amount,
                            'status' => 'completed',
                        ]);
                    }
                } elseif ($totalPaid > 0) {
                    SalesReturnPayment::create([
                        'sales_return_id' => $salesReturn->id,
                        'payment_method' => $returnInvoice->payment_method ?? 'Cash Refund',
                        'amount' => $totalPaid,
                        'status' => 'completed',
                    ]);
                }

                DB::commit();

                return response()->json([
                    'status' => 1,
                    'message' => 'Return invoice created successfully',
                    'data' => [
                        'id' => $returnInvoice->id,
                        'type' => $returnInvoice->type,
                        'company_id' => $returnInvoice->company_id ?? null,
                        'user_id' => $returnInvoice->user_id,
                        'warehouse_id' => $returnInvoice->warehouse_id,
                        'invoice_no' => $returnInvoice->invoice_no ?? null,
                        'date' => $returnInvoice->date ? date('d F, Y', strtotime($returnInvoice->date)) : null,
                        'qty' => $returnInvoice->qty,
                        'discount' => $returnInvoice->discount,
                        'tax_rate' => $returnInvoice->tax_rate ?? 0,
                        'tax' => $returnInvoice->tax,
                        'vat' => $returnInvoice->vat,
                        'total' => $returnInvoice->total,
                        'sub_total' => $returnInvoice->sub_total,
                        'note' => $returnInvoice->note,
                        'paid_amount' => $returnInvoice->paid_amount,
                        'payment_status' => $returnInvoice->payment_status,
                        'isFracture' => $returnInvoice->isFracture,
                        'payment_method' => $returnInvoice->payment_method,
                        'due_amount' => $returnInvoice->due_amount,
                        'status' => $returnInvoice->status,
                        'customer' => [
                            'id' => $originalInvoice?->customer?->id,
                            'name' => $originalInvoice?->customer?->first_name . ' ' . $originalInvoice?->customer?->last_name,
                            'phone' => $originalInvoice?->customer?->phone,
                            'email' => $originalInvoice?->customer?->email,
                            'address' => $originalInvoice?->customer?->address,
                        ],
                        'supplier' => [
                            'id' => $originalInvoice?->supplier?->id,
                            'name' => $originalInvoice?->supplier?->name ?? null,
                            'phone' => $originalInvoice?->supplier?->phone,
                            'email' => $originalInvoice?->supplier?->email,
                        ],
                        'items' => InvoiceItem::with('product')->where('invoice_id', $returnInvoice->id)->get(),
                        'history' => InventoryHistory::where('invoice_id', $returnInvoice->id)->get(),
                    ]
                ], 200);
            }

            /** -------------------------
             *  SALE / PURCHASE FLOW
             *  ------------------------*/
            $totalQty = 0;
            $totalDiscount = 0;
            $totalTax = 0;
            $totalVat = 0;
            $subTotal = 0;

            $reward = null;
            $customer = null;

            if ($request->customer_id && $request->customer_id !== 'walk-in') {
                $customer = User::find($request->customer_id);
                if (!$customer) {
                    throw new \Exception('Customer not found');
                }
            }

            if (!$isDraft && !$isQuotation && ($request->points_used > 0 || $request->points_earned > 0)) {
                $reward = RewordSetup::where('company_id', Auth::user()->company_id)->first() ?? RewordSetup::first();
                if (!$reward) {
                    throw new \Exception('Reward system is not configured');
                }

                $currentDate = now();
                $fromDate = \Carbon\Carbon::parse($reward->form_date);
                $toDate = \Carbon\Carbon::parse($reward->to_date);
                if ($currentDate < $fromDate || $currentDate > $toDate) {
                    throw new \Exception('Reward system is not active');
                }

                if ($request->points_used > 0) {
                    if (!$customer || $request->customer_id === 'walk-in') {
                        throw new \Exception('Reward points cannot be used for walk-in customers');
                    }
                    if (!in_array($reward->redeem_type, ['sale', 'both'])) {
                        throw new \Exception('Reward points redemption is not allowed for sales');
                    }
                    if ($request->points_used > $customer->total_reword) {
                        throw new \Exception('Insufficient reward points');
                    }
                }
            }

            if (!$isDraft && $request->type === 'sale') {
                $waitlistService = app(\App\Services\CustomerWaitlistService::class);
                $waitlistedItems = [];

                foreach ($request->items as $item) {
                    $itemType = $item['item_type'] ?? (!empty($item['bundle_id']) ? 'bundle' : 'product');
                    if ($itemType !== 'product') {
                        continue;
                    }

                    $requestedQty = (float) ($item['qty'] ?? 0);
                    if ($requestedQty <= 0) {
                        continue;
                    }

                    $inventoryItem = !empty($item['inventory_item_id'])
                        ? InventoryItem::query()->lockForUpdate()->find($item['inventory_item_id'])
                        : null;
                    $inventory = !empty($item['inventory_id'])
                        ? Inventory::query()->lockForUpdate()->find($item['inventory_id'])
                        : null;

                    $availableItemQty = (float) ($inventoryItem->quantity ?? 0);
                    $availableInventoryQty = (float) ($inventory->quantity ?? 0);
                    $availableQty = min(max($availableItemQty, 0), max($availableInventoryQty, 0));
                    $channelAvailableQty = null;

                    if ($channelCode && $inventoryItem) {
                        $channelAvailableQty = (float) InventorySalesChannel::query()
                            ->where('inventory_id', (string) $inventoryItem->id)
                            ->where('channel_code', $channelCode)
                            ->value('quantity');
                        $availableQty = min($availableQty, max($channelAvailableQty, 0));
                    }

                    if (!$inventoryItem || !$inventory || $availableQty < $requestedQty) {
                        $waitlistService->createWaitlistEntry([
                            'company_id' => optional(Auth::user())->company_id,
                            'warehouse_id' => optional(Auth::user())->warehouse_id ?? optional(Warehouse::where('is_default', 1)->first())->id,
                            'customer_id' => $request->customer_id,
                            'product_id' => $item['product_id'],
                            'requested_qty' => $requestedQty,
                            'notes' => 'Created from POS sale due to out-of-stock/insufficient stock.',
                        ]);

                        $waitlistedItems[] = [
                            'product_id' => $item['product_id'],
                            'product_name' => $inventoryItem?->product?->name ?? 'Product',
                            'requested_qty' => $requestedQty,
                            'available_qty' => max($availableQty, 0),
                            'channel_code' => $channelCode,
                        ];
                    }
                }

                if (!empty($waitlistedItems)) {
                    DB::commit();
                    return response()->json([
                        'status' => 0,
                        'message' => 'Out-of-stock items were added to customer waitlist.',
                        'waitlisted_items' => $waitlistedItems,
                    ], 409);
                }
            }

            $invoice = $existingDraft ?? new Invoice();
            $invoice->type = $request->type;
            if (!$existingDraft && $isQuotation) {
                $invoice->invoice_no = Invoice::generateQuotationNo();
            }
            $invoice->warehouse_id = optional(Auth::user())->warehouse_id ?? optional(Warehouse::where('is_default', 1)->first())->id;
            if (!$existingDraft) {
                $invoice->user_id = Auth::id();
            }
            $invoice->customer_id = $request->customer_id;
            $invoice->date = $request->date;
            $invoice->note = $request->note ?? null;
            $invoice->card_type = $request->card_type ?? null;
            $invoice->card_last_digits = $request->card_last_digits ?? null;
            $invoice->mf_type = $request->mf_type ?? null;
            $invoice->mf_number = $request->mf_number ?? null;
            $invoice->qr_provider = $request->qr_provider ?? null;
            $invoice->qr_transaction_id = $request->qr_transaction_id ?? null;
            $invoice->points_used = $request->points_used ?? 0;
            $invoice->points_earned = $request->points_earned ?? 0;
            $invoice->save();

            if ($existingDraft) {
                InvoiceItem::where('invoice_id', $invoice->id)->update(['is_deleted' => true]);
                InvoiceItem::where('invoice_id', $invoice->id)->delete();
            }

            $hasInvoiceItemTaxRateColumn = Schema::hasColumn('invoice_items', 'tax_rate');
            $hasInvoiceItemTaxColumn = Schema::hasColumn('invoice_items', 'tax');
            $hasInvoiceItemVatRateColumn = Schema::hasColumn('invoice_items', 'vat_rate');
            $hasInvoiceItemVatColumn = Schema::hasColumn('invoice_items', 'vat');

            foreach ($request->items as $item) {
                $itemType = $item['item_type'] ?? (!empty($item['bundle_id']) ? 'bundle' : 'product');

                if ($itemType === 'bundle') {
                    $bundle = ProductBundle::with(['bundleItems.product', 'product'])->findOrFail($item['bundle_id']);

                    if (!$bundle->is_active) {
                        throw new \Exception("Bundle [{$bundle->name}] is inactive.");
                    }

                    $bundleQty = (float) $item['qty'];
                    $bundleProductId = $bundle->product_id;
                    if (!$bundleProductId) {
                        throw new \Exception("Bundle [{$bundle->name}] is not linked to an inventory product.");
                    }

                    $bundleInventoryItem = InventoryItem::query()
                        ->where('product_id', $bundleProductId)
                        ->where('warehouse_id', $invoice->warehouse_id)
                        ->where('quantity', '>', 0)
                        ->orderBy('created_at')
                        ->lockForUpdate()
                        ->first();

                    $currentBundleStock = (float) ($bundleInventoryItem?->quantity ?? 0);

                    if (!$isDraft && !$isQuotation && $bundleQty > $currentBundleStock) {
                        throw new \Exception("Insufficient bundle stock for [{$bundle->name}]. Available: {$currentBundleStock}");
                    }

                    if ($isDraft || $isQuotation) {
                        $bundleSale = $productBundleService->calculateBundle($bundle, $invoice->warehouse_id, $bundleQty, true);
                    } else {
                        // Always deduct component stock when a bundle is sold:
                        // required component qty = quantity_per_bundle * sold bundle qty.
                        $bundleSale = $productBundleService->deductBundleStock($bundle, $invoice->warehouse_id, $bundleQty);
                    }

                    $taxRate = (float) ($item['tax_rate'] ?? 0);
                    $vatRate = (float) ($item['vat_rate'] ?? 0);
                    $basePrice = (float) $bundleSale['bundle_total'];
                    $taxAmount = round($basePrice * ($taxRate / 100), 2);
                    $vatAmount = round($basePrice * ($vatRate / 100), 2);
                    $itemTotal = round($basePrice + $taxAmount + $vatAmount, 2);

                    $invoiceItem = new InvoiceItem();
                    $invoiceItem->warehouse_id = optional(Auth::user())->warehouse_id ?? optional(Warehouse::where('is_default', 1)->first())->id;
                    $invoiceItem->invoice_id = $invoice->id;
                    $invoiceItem->type = $request->type;
                    $invoiceItem->date = $invoice->date;
                    $invoiceItem->user_id = Auth::id();
                    $invoiceItem->company_id = $this->currentCompanyId();
                    $invoiceItem->item_type = 'bundle';
                    $invoiceItem->bundle_id = $bundle->id;
                    $invoiceItem->bundle_name = $bundle->name;
                    $invoiceItem->product_id = $bundleProductId;
                    $invoiceItem->inventory_id = $bundleInventoryItem?->inventory_id;
                    $invoiceItem->variant_id = null;
                    $invoiceItem->lot_number = null;
                    $invoiceItem->qty = $bundleQty;
                    $invoiceItem->unit_price = $bundleSale['bundle_price_per_bundle'];
                    $invoiceItem->discount = 0;
                    $invoiceItem->discount_amount = $bundleSale['discount_total'];
                    if ($hasInvoiceItemTaxRateColumn) {
                        $invoiceItem->tax_rate = $taxRate;
                    }
                    if ($hasInvoiceItemTaxColumn) {
                        $invoiceItem->tax = $taxAmount;
                    }
                    if ($hasInvoiceItemVatRateColumn) {
                        $invoiceItem->vat_rate = $vatRate;
                    }
                    if ($hasInvoiceItemVatColumn) {
                        $invoiceItem->vat = $vatAmount;
                    }
                    $invoiceItem->total = $itemTotal;
                    $invoiceItem->save();

                    if (!$isDraft && !$isQuotation) {
                        if (!$bundleInventoryItem) {
                            throw new \Exception("Inventory item missing for bundle [{$bundle->name}].");
                        }

                        $bundleInventory = Inventory::query()->lockForUpdate()->find($bundleInventoryItem->inventory_id);
                        if (!$bundleInventory || (float) $bundleInventory->quantity < $bundleQty) {
                            throw new \Exception("Insufficient bundle inventory for [{$bundle->name}].");
                        }

                        $bundleInventoryItem->quantity = round((float) $bundleInventoryItem->quantity - $bundleQty, 2);
                        $bundleInventoryItem->save();

                        $bundleInventory->quantity = round((float) $bundleInventory->quantity - $bundleQty, 2);
                        $bundleInventory->save();

                        $bundleHistory = new InventoryHistory();
                        $bundleHistory->invoice_id = $invoice->id;
                        $bundleHistory->type = $request->type;
                        $bundleHistory->company_id = $this->currentCompanyId();
                        $bundleHistory->product_id = $bundleProductId;
                        $bundleHistory->inventory_item_id = $bundleInventoryItem->id;
                        $bundleHistory->variant = null;
                        $bundleHistory->inventory_id = $bundleInventoryItem->inventory_id;
                        $bundleHistory->lot_number = $bundleInventoryItem->lot_number;
                        $bundleHistory->barcode = $bundleInventoryItem->barcode;
                        $bundleHistory->quantity = $bundleQty;
                        $bundleHistory->unit_price = $bundleSale['bundle_price_per_bundle'];
                        $bundleHistory->original_unit_price = (float) $bundleInventoryItem->price;
                        $bundleHistory->discount = 0;
                        $bundleHistory->discount_amount = $bundleSale['discount_total'];
                        $bundleHistory->total = $itemTotal;
                        $bundleHistory->save();

                        foreach (($bundleSale['allocations'] ?? []) as $allocation) {
                            $invoiceHistory = new InventoryHistory();
                            $invoiceHistory->invoice_id = $invoice->id;
                            $invoiceHistory->type = $request->type;
                            $invoiceHistory->company_id = $this->currentCompanyId();
                            $invoiceHistory->product_id = $allocation['product_id'];
                            $invoiceHistory->inventory_item_id = $allocation['inventory_item_id'];
                            $invoiceHistory->variant = is_array($allocation['variant_id'])
                                ? json_encode($allocation['variant_id'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
                                : null;
                            $invoiceHistory->inventory_id = $allocation['inventory_id'];
                            $invoiceHistory->lot_number = $allocation['lot_number'];
                            $invoiceHistory->barcode = $allocation['barcode'];
                            $invoiceHistory->quantity = $allocation['qty'];
                            $invoiceHistory->unit_price = $allocation['effective_unit_price'];
                            $invoiceHistory->original_unit_price = $allocation['original_unit_price'];
                            $invoiceHistory->discount = 0;
                            $invoiceHistory->discount_amount = 0;
                            $invoiceHistory->total = $allocation['line_total'];
                            $invoiceHistory->save();
                        }
                    }

                    $totalQty += $bundleQty;
                    $totalDiscount += $bundleSale['discount_total'];
                    $subTotal += $itemTotal;

                    continue;
                }

                $inventoryItem = InventoryItem::query()
                    ->lockForUpdate()
                    ->find($item['inventory_item_id']);

                if (!$inventoryItem && !$isQuotation) {
                    throw new \Exception("Inventory item not found for product ID: {$item['product_id']}");
                }

                $lineDiscountType = $item['discount_type'] ?? 'percent';
                $lineDiscountValue = (float) ($item['discount'] ?? 0);
                if ($lineDiscountValue <= 0 && !$isReturn && !$isQuotation) {
                    $setupDiscount = $this->setupDiscountForLine(
                        $inventoryItem,
                        $item['product_id'] ?? null,
                        (float) ($item['unit_price'] ?? 0),
                        $this->currentCompanyId()
                    );
                    $lineDiscountType = $setupDiscount['type'];
                    $lineDiscountValue = (float) $setupDiscount['value'];
                }

                // Calculate item totals based on unit price
                $basePrice = $item['qty'] * $item['unit_price'];
                $discountAmount = $this->lineDiscountAmount($basePrice, $lineDiscountValue, $lineDiscountType, (float) ($item['qty'] ?? 1));
                $taxableAmount = $basePrice - $discountAmount;
                $taxAmount = $item['qty'] * $item['unit_price'] * ($item['tax_rate'] / 100 ?? 0);
                $vatAmount = $item['qty'] * $item['unit_price'] * ($item['vat_rate'] / 100 ?? 0);
                $itemTotal = $taxableAmount + $taxAmount + $vatAmount;

                // invoice items 
                $invoiceItem = new InvoiceItem();
                $invoiceItem->warehouse_id = $inventoryItem?->warehouse_id
                    ?? $request->warehouse_id
                    ?? optional(Auth::user())->warehouse_id
                    ?? optional(Warehouse::where('is_default', 1)->first())->id;
                $invoiceItem->invoice_id = $invoice->id;
                $invoiceItem->type = $request->type;
                $invoiceItem->date = $invoice->date;
                $invoiceItem->user_id = Auth::id();
                $invoiceItem->company_id = $this->currentCompanyId();
                $invoiceItem->item_type = 'product';
                $invoiceItem->bundle_id = null;
                $invoiceItem->bundle_name = null;
                $invoiceItem->product_id = $item['product_id'];
                if (Schema::hasColumn('invoice_items', 'inventory_item_id') && $inventoryItem) {
                    $invoiceItem->inventory_item_id = $inventoryItem->id;
                }
                $invoiceItem->variant_id = is_array($inventoryItem?->variant_id) ? $inventoryItem->variant_id : null;
                $invoiceItem->inventory_id = $inventoryItem?->inventory_id ?? ($item['inventory_id'] ?? null);
                $invoiceItem->lot_number = $item['lot_number'] ?? null;
                $invoiceItem->qty = $item['qty'];
                $invoiceItem->unit_price = $item['unit_price'];
                $invoiceItem->discount = $lineDiscountValue;
                $invoiceItem->discount_amount = $discountAmount ?? 0;
                if ($hasInvoiceItemVatRateColumn) {
                    $invoiceItem->vat_rate = $item['vat_rate'] ?? 0;
                }
                if ($hasInvoiceItemTaxColumn) {
                    $invoiceItem->tax = $taxAmount;
                }
                if ($hasInvoiceItemVatColumn) {
                    $invoiceItem->vat = $vatAmount;
                }
                $invoiceItem->total = $itemTotal;
                $invoiceItem->save();

                // invoice history 
                if (!$isDraft && !$isQuotation) {
                    $invoiceHistory = new InventoryHistory();
                    $invoiceHistory->invoice_id = $invoice->id;
                    $invoiceHistory->type = $request->type;
                    $invoiceHistory->company_id = $this->currentCompanyId();
                    $invoiceHistory->product_id = $item['product_id'];
                    $invoiceHistory->inventory_item_id = $inventoryItem->id;
                    $invoiceHistory->variant = is_array($inventoryItem->variant_id)
                        ? json_encode($inventoryItem->variant_id, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
                        : null;
                    $invoiceHistory->inventory_id = $inventoryItem->inventory_id;
                    $invoiceHistory->lot_number = $item['lot_number'] ?? null;
                    $invoiceHistory->barcode = $item['barcode'] ?? null;
                    $invoiceHistory->quantity = $item['qty'];
                    $invoiceHistory->unit_price = $item['unit_price'];
                    $invoiceHistory->original_unit_price = $inventoryItem->price;
                    $invoiceHistory->discount = $lineDiscountValue;
                    $invoiceHistory->discount_amount = $discountAmount ?? 0;
                    $invoiceHistory->total = $itemTotal;
                    $invoiceHistory->save();

                    // Decrease quantity from existing inventory
                    $existingInventory = Inventory::query()->lockForUpdate()->find($item['inventory_id']);
                    $channelAllocation = null;

                    if ($channelCode) {
                        $channelAllocation = InventorySalesChannel::query()
                            ->where('inventory_id', (string) $inventoryItem->id)
                            ->where('channel_code', $channelCode)
                            ->lockForUpdate()
                            ->first();

                        if (!$channelAllocation || (float) $channelAllocation->quantity < (float) $item['qty']) {
                            throw new \Exception("Insufficient {$channelCode} channel stock for product ID: {$item['product_id']}");
                        }
                    }

                    if ($existingInventory && $existingInventory->quantity >= $item['qty']) {
                        $inventoryBefore = (float) $existingInventory->quantity;
                        $existingInventory->quantity -= $item['qty'];
                        $existingInventory->save();

                        $inventoryItem->quantity -= $item['qty'];
                        $inventoryItem->save();

                        if ($channelAllocation) {
                            $channelAllocation->quantity = round((float) $channelAllocation->quantity - (float) $item['qty'], 2);
                            $channelAllocation->save();
                        }

                        $inventoryItem->barcodes()->where('barcode', $item['barcode'])->update([
                            'used' => 1
                        ]);

                        app(StockMovementService::class)->record([
                            'company_id' => $this->currentCompanyId(),
                            'product_id' => $item['product_id'],
                            'inventory_id' => $existingInventory->id,
                            'inventory_item_id' => $inventoryItem->id,
                            'warehouse_id' => $invoiceItem->warehouse_id,
                            'type' => StockMovementService::TYPE_SOLD,
                            'quantity_change' => -1 * (float) $item['qty'],
                            'quantity_before' => $inventoryBefore,
                            'quantity_after' => (float) $existingInventory->quantity,
                            'reference_type' => StockMovementService::REF_INVOICE_ITEM,
                            'reference_id' => $invoiceItem->id,
                            'note' => 'Stock sold',
                        ]);
                    } else {
                        throw new \Exception("Insufficient inventory for product ID: {$item['product_id']}");
                    }
                }

                $totalQty += $item['qty'];
                $totalDiscount += $discountAmount;
                $subTotal += $itemTotal;
            }

            // Apply global tax and VAT on subtotal
            $globalTaxAmount = $subTotal * ($request->global_tax_percentage / 100 ?? 0);
            $globalVatAmount = $subTotal * ($request->global_vat_percentage / 100 ?? 0);

            // Apply invoice-level discount
            $invoiceDiscount = $request->discount_type === 'percent'
                ? $subTotal * ($request->discount / 100 ?? 0)
                : ($request->discount ?? 0);

            // Apply reward points
            $pointsDiscount = 0;
            if (!$isDraft && !$isQuotation && $request->points_used > 0 && $reward && $customer) {
                $pointsDiscount = $request->points_used * ($reward->reword_value ?? 1);
                if ($pointsDiscount > $subTotal) {
                    throw new \Exception('Points value exceeds the total amount due');
                }
                $customer->total_reword -= $request->points_used;
                $customer->save();

                RewordHistory::create([
                    'user_id' => $customer->id,
                    'invoice_id' => $invoice->id,
                    'reword_amount' => $request->points_used,
                    'invoice_amount' => $subTotal,
                    'type' => 'debit',
                    'conversion_value' => $reward->reword_value,
                ]);
            }

            if (!$isDraft && !$isQuotation && $request->points_earned > 0 && $customer) {
                $customer->total_reword += $request->points_earned;
                $customer->save();

                RewordHistory::create([
                    'user_id' => $customer->id,
                    'invoice_id' => $invoice->id,
                    'reword_amount' => $request->points_earned,
                    'invoice_amount' => $subTotal,
                    'type' => 'credit',
                    'conversion_value' => $reward->reword_value,
                ]);
            }

            // Calculate grand total
            $total = $subTotal + $globalTaxAmount + $globalVatAmount - $invoiceDiscount - $pointsDiscount;

            if ($total < 0) {
                throw new \Exception('Grand total cannot be negative');
            }

            // Calculate total paid amount from multiple payments
            $totalPaid = 0;
            if (!$isDraft && !$isQuotation) {
                if ($request->has('payments') && is_array($request->payments)) {
                    foreach ($request->payments as $payment) {
                        $totalPaid += $payment['amount'] ?? 0;
                    }
                } else {
                    // Fallback to single payment method for backward compatibility
                    $totalPaid = $request->paid_amount ?? 0;
                }
            }

            $invoice->qty = $totalQty;
            $invoice->discount = $totalDiscount + $invoiceDiscount;
            $invoice->vat_rate = $request->global_vat_percentage ?? 0;
            $invoice->vat = $globalVatAmount;
            $invoice->sub_total = $subTotal;
            $invoice->total = $total;
            $invoice->due_amount = ($isDraft || $isQuotation) ? $total : ($total - $totalPaid);
            $invoice->paid_amount = ($isDraft || $isQuotation) ? 0 : $totalPaid;
            $invoice->change_due = ($isDraft || $isQuotation) ? 0 : (($totalPaid > $total) ? ($totalPaid - $total) : 0);

            // Set payment status
            if ($isDraft || $isQuotation) {
                $invoice->payment_status = 0;
            } elseif (abs($totalPaid - $invoice->total) < 0.01) {
                $invoice->payment_status = 1; // Paid
            } elseif ($totalPaid < $invoice->total) {
                $invoice->payment_status = 2; // Partial
            } else {
                $invoice->payment_status = 0; // Unpaid
            }

            // Set primary payment method for invoice (first payment method or fallback)
            if ($isDraft || $isQuotation) {
                $invoice->payment_method = null;
            } elseif ($request->has('payments') && is_array($request->payments) && count($request->payments) > 0) {
                $invoice->payment_method = $request->payments[0]['payment_method'];
            } elseif ($request->payment_method) {
                $invoice->payment_method = $request->payment_method;
            } else {
                $invoice->payment_method = null;
            }
            $invoice->draft_payload = $isDraft ? ($request->draft_payload ?? null) : null;
            
            $invoice->save();

            // Record transactions for each payment method
            if (!$isDraft && !$isQuotation && $request->has('payments') && is_array($request->payments)) {
                foreach ($request->payments as $payment) {
                    if ($payment['amount'] > 0) {
                        Transaction::create([
                            'invoice_id' => $invoice->id,
                            'user_id' => Auth::id(),
                            'amount' => $payment['amount'],
                            'payment_method' => $payment['payment_method'],
                            'card_type' => $payment['card_type'] ?? null,
                            'card_last_digits' => $payment['card_last_digits'] ?? null,
                            'mf_type' => $payment['mf_type'] ?? null,
                            'mf_number' => $payment['mf_number'] ?? null,
                            'qr_provider' => $payment['qr_provider'] ?? null,
                            'qr_transaction_id' => $payment['qr_transaction_id'] ?? null,
                            'transaction_date' => $request->date,
                        ]);
                    }
                }
            } elseif (!$isDraft && !$isQuotation) {
                // Fallback to single payment method for backward compatibility
                if ($request->paid_amount > 0 || $invoice->paid_amount > 0) {
                    Transaction::create([
                        'invoice_id' => $invoice->id,
                        'user_id' => Auth::id(),
                        'amount' => $request->paid_amount ?? $total,
                        'payment_method' => $request->payment_method,
                        'card_type' => $request->card_type ?? null,
                        'card_last_digits' => $request->card_last_digits ?? null,
                        'mf_type' => $request->mf_type ?? null,
                        'mf_number' => $request->mf_number ?? null,
                        'qr_provider' => $request->qr_provider ?? null,
                        'qr_transaction_id' => $request->qr_transaction_id ?? null,
                        'transaction_date' => $request->date,
                    ]);
                }
            }

            // Create payment schedules for partial payments
            if (!$isDraft && !$isQuotation && $request->payment_schedule && $invoice->due_amount > 0) {
                $scheduleTotal = 0;
                foreach ($request->payment_schedule as $schedule) {
                    $scheduleTotal += $schedule['amount'];
                    PaymentSchedule::create([
                        'invoice_id' => $invoice->id,
                        'amount' => $schedule['amount'],
                        'due_date' => $schedule['due_date'],
                        'remainder_date' => $schedule['remainder_date'] ?? null,
                        'status' => 'DUE',
                    ]);
                }
                if (abs($scheduleTotal - $invoice->due_amount) > 0.01) {
                    throw new \Exception('Payment schedule total must equal the due amount');
                }
            }

            // Record coupon/gift card in DiscountHistory
            if (!$isDraft && !$isQuotation && $couponData) {
                DiscountHistory::create([
                    'user_id' => $customer->id ?? null,
                    'invoice_id' => $invoice->id,
                    'setup_id' => $couponData['setup_id'],
                    'code' => $couponData['code'],
                    'invoice_amount' => $subTotal,
                    'discount_amount' => $couponData['discount_type'] === 'percent'
                        ? $subTotal * ($couponData['discount_amount'] / 100)
                        : $couponData['discount_amount'],
                    'discount_type' => $couponData['discount_type'],
                    'created_by' => Auth::id(),
                ]);

                // Mark gift card as redeemed if applicable
                if (isset($couponData['is_gift_card']) && $couponData['is_gift_card']) {
                    $giftCard = RewordCard::where('card_number', $couponData['code'])->first();
                    if ($giftCard) {
                        $giftCard->is_redeemed = 1;
                        $giftCard->user_id = $customer->id ?? null;
                        $giftCard->save();
                    }
                }
            }

            DB::commit();
            $originalInvoice = Invoice::with([
                'items.product',
                'items.bundle',
                'items.inventory',
                'supplier',
                'customer'
            ])->findOrFail($invoice->id);

            $invoiceItems = InvoiceItem::with([
                'product',
                'bundle.bundleItems.product',
                'inventory',
            ])->where('invoice_id', $invoice->id)->get()->map(function ($item) {
                $displayName = $item->item_type === 'bundle'
                    ? ($item->bundle_name ?: $item->bundle?->name ?: 'Bundle Item')
                    : ($item->product?->name ?: 'Product Item');

                $row = $item->toArray();
                $row['name'] = $displayName;
                $row['product_name'] = $displayName;
                $row['bundle_components'] = $item->item_type === 'bundle'
                    ? $item->bundle?->bundleItems?->map(function ($bundleItem) {
                        return [
                            'product_id' => $bundleItem->product_id,
                            'product_name' => $bundleItem->product?->name ?? 'N/A',
                            'quantity_per_bundle' => (float) ($bundleItem->quantity ?? 0),
                        ];
                    })->values()->all()
                    : [];

                return $row;
            });

            $invoiceHistory = InventoryHistory::where('invoice_id', $invoice->id)->get();

            // Send email to customer if email is available and it's a sale invoice
            if (!$isDraft && !$isQuotation && $request->type === 'sale' && $originalInvoice->customer && $originalInvoice->customer->email) {
                try {
                    SendInvoiceEmail::dispatch($originalInvoice, $originalInvoice->customer->email);
                } catch (\Exception $e) {
                    // Log email error but don't fail the invoice creation
                    \Log::error('Failed to dispatch invoice email job after creation: ' . $e->getMessage());
                }
            }

            return response()->json([
                'status' => 1,
                'message' => $isDraft
                    ? 'Draft saved successfully'
                    : ($isQuotation
                        ? 'Quotation created successfully'
                        : ('Invoice created' . ($request->type === 'sale' && $originalInvoice->customer && $originalInvoice->customer->email ? ' and email sent' : ''))),
                'data' => [
                    'id' => $originalInvoice->id,
                    'type' => $originalInvoice->type,
                    'company_id' => $originalInvoice->company_id ?? null,
                    'user_id' => $originalInvoice->user_id,
                    'warehouse_id' => $originalInvoice->warehouse_id,
                    'invoice_no' => $originalInvoice->invoice_no ?? null,
                    'date' => $originalInvoice->date ? date('d F, Y', strtotime($originalInvoice->date)) : null,
                    'qty' => $originalInvoice->qty,
                    'discount' => $originalInvoice->discount,
                    'vat_rate' => $originalInvoice->vat_rate,
                    'vat' => $originalInvoice->vat,
                    'sub_total' => $originalInvoice->sub_total,
                    'total' => $originalInvoice->total,
                    'note' => $originalInvoice->note,
                    'paid_amount' => $originalInvoice->paid_amount,
                    'payment_status' => $originalInvoice->payment_status,
                    'isFracture' => $originalInvoice->isFracture,
                    'payment_method' => $originalInvoice->payment_method,
                    'due_amount' => $originalInvoice->due_amount,
                    'status' => $originalInvoice->status,
                    'return_amount' => $originalInvoice->return_amount,
                    'draft_payload' => $originalInvoice->draft_payload,
                    'customer' => [
                        'id' => $originalInvoice?->customer?->id,
                        'name' => $originalInvoice?->customer?->first_name . ' ' . $originalInvoice?->customer?->last_name,
                        'phone' => $originalInvoice?->customer?->phone,
                        'email' => $originalInvoice?->customer?->email,
                        'address' => $originalInvoice?->customer?->address,
                    ],
                    'supplier' => [
                        'id' => $originalInvoice?->supplier?->id,
                        'name' => $originalInvoice?->supplier?->name ?? null,
                        'phone' => $originalInvoice?->supplier?->phone,
                        'email' => $originalInvoice?->supplier?->email,
                    ],
                    'items' => $originalInvoice->items,
                    'history' => $invoiceHistory,
                ]
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 0,
                'message' => $e->getMessage(),
                'error' => 'Invoice creation failed'
            ], 500);
        }
    }

    public function dailyMonthlySalesReport(Request $request)
    {
        $settings = PosSetting::where('key', 'payment_methods')->first();
        $paymentMethods = $this->normalizePaymentMethods($settings?->value);
        $validator = Validator::make($request->all(), [
            'type' => 'required|in:sale,purchase,return',
            // ... (rest of the code remains the same)
            'company_id' => 'nullable|exists:companies,id',
            'warehouse_id' => 'nullable|exists:warehouses,id',
            'customer_id' => 'nullable|exists:user,id',
            'date' => 'required|date',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:product,id',
            'items.*.inventory_id' => 'required_if:type,sale,return|exists:inventory,id',
            'items.*.variant_id' => 'nullable|exists:product_variants,id',
            'items.*.qty' => 'required|numeric',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.discount' => 'nullable|numeric|min:0',
            'items.*.discount_type' => 'nullable|in:percent,fixed,flat',
            // 'items.*.tax_rate' => 'nullable|numeric|min:0|max:100',
            // 'items.*.vat_rate' => 'nullable|numeric|min:0|max:100',
            'discount' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|in:percent,flat',
            'global_tax_percentage' => 'nullable|numeric|min:0|max:100',
            'global_vat_percentage' => 'nullable|numeric|min:0|max:100',
            'paid_amount' => 'nullable|numeric|min:0',
            'change_due' => 'nullable|numeric|min:0',
            'grandTotal' => 'required|numeric|min:0',
            'payment_method' => ['nullable', function ($attribute, $value, $fail) use ($paymentMethods) {
                $method = $this->findPaymentMethod($paymentMethods, $value);
                if ($method && !$method['enabled']) {
                    $fail('The selected payment method is not enabled.');
                }
            }],
            'card_last_digits' => [function ($attribute, $value, $fail) use ($request, $paymentMethods) {
                if ($request->payment_method && in_array($request->payment_method, ['Card', 'Refund to Card'])) {
                    $method = $this->findPaymentMethod($paymentMethods, $request->payment_method);
                    if ($method && $method['config']['require_last_digits']) {
                        if (!$value) {
                            $fail('Card last digits are required.');
                        } else {
                            $allowedLengths = $method['config']['last_digit_length'] ?? [5, 6];
                            if (!in_array(strlen($value), $allowedLengths)) {
                                $fail("Card last digits must be " . implode(' or ', $allowedLengths) . " digits.");
                            }
                        }
                    }
                }
            }],
            'mf_type' => [function ($attribute, $value, $fail) use ($request, $paymentMethods) {
                if ($request->payment_method === 'Refund to MF' && !$value) {
                    $fail('Mobile financial service type is required for refund.');
                } elseif ($request->payment_method === 'Refund to MF' && $value) {
                    $method = $this->findPaymentMethod($paymentMethods, 'Refund to MF');
                    $allowedProviders = $method['config']['providers'] ?? [];
                    if (!in_array($value, $allowedProviders)) {
                        $fail('Invalid mobile financial service provider for refund.');
                    }
                }
            }],
            'mf_number' => 'nullable|required_if:payment_method,Refund to MF|regex:/^\+?\d{10,15}$/',
            'qr_provider' => [function ($attribute, $value, $fail) use ($request, $paymentMethods) {
                if ($request->payment_method === 'QR Payment' && !$value) {
                    $fail('QR provider is required.');
                } elseif ($request->payment_method === 'QR Payment' && $value) {
                    $method = $this->findPaymentMethod($paymentMethods, 'QR Payment');
                    $allowedProviders = $method['config']['providers'] ?? [];
                    if (!in_array($value, $allowedProviders)) {
                        $fail('Invalid QR provider.');
                    }
                }
            }],
            'qr_transaction_id' => 'nullable|required_if:payment_method,QR Payment',
            'points_used' => 'nullable|numeric|min:0',
            'points_earned' => 'nullable|numeric|min:0',
            'is_fracture' => 'nullable',
            'original_invoice_id' => 'required_if:type,return|exists:invoices,id',
            'payment_schedule' => 'nullable|array',
            'payment_schedule.*.amount' => 'required_with:payment_schedule|numeric|min:0',
            'payment_schedule.*.due_date' => 'required_with:payment_schedule|date|after_or_equal:today',
            'payment_schedule.*.remainder_date' => 'nullable|date|after_or_equal:due_date',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 0, 'errors' => $validator->errors()], 422);
        }

        DB::beginTransaction();

        try {
            $isReturn = $request->type === 'return';
            $couponData = null;

            // Verify coupon/gift card if provided and not in return mode
            if (!$isReturn && $request->coupon_code) {
                $code = $request->coupon_code;

                // Check for valid Coupon
                $coupon = DiscountSetup::where('code', $code)
                    ->where('is_active', true)
                    ->where('type', 'coupon')
                    ->where('form_date', '<=', now())
                    ->where('to_date', '>=', now())
                    ->first();

                if ($coupon) {
                    $couponData = [
                        'setup_id' => $coupon->id,
                        'code' => $coupon->code,
                        'discount_amount' => $coupon->amount,
                        'discount_type' => $coupon->discount_type,
                    ];
                } else {
                    // Check for valid Gift Card
                    $giftCard = RewordCard::where('card_number', $code)
                        ->where('is_redeemed', false)
                        ->whereHas('setup', function ($query) {
                            $query->where('is_active', true)
                                ->where('type', 'reward_card')
                                ->where('form_date', '<=', now())
                                ->where('to_date', '>=', now());
                        })
                        ->first();

                    if ($giftCard) {
                        $couponData = [
                            'setup_id' => $giftCard->id,
                            'code' => $giftCard->card_number,
                            'discount_amount' => $giftCard->setup->amount,
                            'discount_type' => $giftCard->setup->discount_type,
                            'is_gift_card' => true,
                        ];
                    } else {
                        throw new \Exception('Invalid or expired coupon/gift card code');
                    }
                }
            }

            /** -------------------------
             *  RETURN FLOW
             *  ------------------------*/
            if ($isReturn) {
                $originalInvoice = Invoice::findOrFail($request->original_invoice_id);

                $subTotal = 0;
                $totalTax = 0;
                $totalVat = 0;
                $totalDiscount = 0;

                foreach ($request->items as $item) {
                    if ($item['is_return'] == 'true') {
                        $inventory = Inventory::findOrFail($item['inventory_id']);
                        $quantity = (int) $item['qty'];

                        // Increase stock for returns
                        $inventory->quantity += $quantity;
                        $inventory->save();

                        // Calculate item totals based on unit price
                        $basePrice = $quantity * $item['unit_price'];
                        $discountAmount = $basePrice * ($item['discount'] / 100 ?? 0);
                        $taxableAmount = $basePrice - $discountAmount;
                        $taxAmount = $quantity * $item['unit_price'] * (0 / 100 ?? 0);
                        $vatAmount = $quantity * $item['unit_price'] * ($item['vat_rate'] / 100 ?? 0);
                        $itemTotal = $taxableAmount + $taxAmount + $vatAmount;

                        // Insert return item into invoice_items
                        $invoiceItem = new InvoiceItem();
                        $invoiceItem->type = 'return';
                        $invoiceItem->invoice_id = $originalInvoice->id;
                        $invoiceItem->product_id = $item['product_id'];
                        $invoiceItem->inventory_id = $item['inventory_id'];
                        $invoiceItem->date = Carbon::now();
                        $invoiceItem->company_id = $originalInvoice->company_id;
                        $invoiceItem->warehouse_id = optional(Auth::user())->warehouse_id ?? optional(Warehouse::where('is_default', 1)->first())->id;
                        $invoiceItem->lot_number = $item['lot_number'] ?? null;
                        $existingInventory = Inventory::find($item['inventory_id']);
                        $invoiceItem->variant_id = $inventory->variant_id ?? [];
                        $invoiceItem->user_id = Auth::id();
                        $invoiceItem->qty = $quantity;
                        $invoiceItem->unit_price = $item['unit_price'];
                        $invoiceItem->discount = $item['discount'] ?? 0;
                        // $invoiceItem->tax_rate = $item['tax_rate'] ?? 0;
                        $invoiceItem->tax = $taxAmount;
                        $invoiceItem->vat_rate = $item['vat_rate'] ?? 0;
                        $invoiceItem->vat = $vatAmount;
                        $invoiceItem->total = $itemTotal;
                        $invoiceItem->is_returned = 1;
                        $invoiceItem->original_sale_item_id = $item['original_sale_item_id'] ?? null;
                        $invoiceItem->save();

                        $subTotal += $itemTotal;
                        $totalTax += $taxAmount;
                        $totalVat += $vatAmount;
                        $totalDiscount += $discountAmount;
                    }
                }

                // Apply global tax and VAT on subtotal
                $globalTaxAmount = $subTotal * ($request->global_tax_percentage / 100 ?? 0);
                $globalVatAmount = $subTotal * ($request->global_vat_percentage / 100 ?? 0);
                $invoiceDiscount = $request->discount_type === 'percent'
                    ? $subTotal * ($request->discount / 100 ?? 0)
                    : ($request->discount ?? 0);
                $grandTotal = $subTotal + $globalTaxAmount + $globalVatAmount - $invoiceDiscount;

                if ($grandTotal < 0) {
                    throw new \Exception('Grand total cannot be negative');
                }

                // Update original invoice
                $originalInvoice->return_amount = $grandTotal;
                $originalInvoice->total += $grandTotal;
                $originalInvoice->tax += $totalTax + $globalTaxAmount;
                $originalInvoice->vat += $totalVat + $globalVatAmount;
                $originalInvoice->discount += $totalDiscount + $invoiceDiscount;
                $originalInvoice->save();

                // Record transaction for return payment
                Transaction::create([
                    'invoice_id' => $originalInvoice->id,
                    'user_id' => Auth::id(),
                    'amount' => $request->paid_amount ?? $grandTotal,
                    'payment_method' => $request->payment_method,
                    'card_last_digits' => $request->card_last_digits ?? null,
                    'mf_type' => $request->mf_type ?? null,
                    'mf_number' => $request->mf_number ?? null,
                    'qr_provider' => $request->qr_provider ?? null,
                    'qr_transaction_id' => $request->qr_transaction_id ?? null,
                    'transaction_date' => $request->date,
                ]);
                $invoiceHistory = InventoryHistory::where('invoice_id', $originalInvoice->id)->get();

                DB::commit();

                return response()->json([
                    'status' => 1,
                    'message' => 'Return item(s) recorded successfully',
                    'data' => [
                        'id' => $originalInvoice->id,
                        'type' => $originalInvoice->type,
                        'company_id' => $originalInvoice->company_id ?? null,
                        'user_id' => $originalInvoice->user_id,
                        'warehouse_id' => $originalInvoice->warehouse_id,
                        'invoice_no' => $originalInvoice->invoice_no ?? null,
                        'date' => $originalInvoice->date ? date('d F, Y', strtotime($originalInvoice->date)) : null,
                        'qty' => $originalInvoice->qty,
                        'discount' => $originalInvoice->discount,
                        'tax_rate' => $originalInvoice->tax_rate ?? 0,
                        'tax' => $originalInvoice->tax,
                        'vat' => $originalInvoice->vat,
                        'total' => $originalInvoice->total,
                        'sub_total' => $originalInvoice->sub_total,
                        'note' => $originalInvoice->note,
                        'paid_amount' => $originalInvoice->paid_amount,
                        'payment_status' => $originalInvoice->payment_status,
                        'isFracture' => $originalInvoice->isFracture,
                        'payment_method' => $originalInvoice->payment_method,
                        'due_amount' => $originalInvoice->due_amount,
                        'status' => $originalInvoice->status,
                        'customer' => [
                            'id' => $originalInvoice?->customer?->id,
                            'name' => $originalInvoice?->customer?->first_name . ' ' . $originalInvoice?->customer?->last_name,
                            'phone' => $originalInvoice?->customer?->phone,
                            'email' => $originalInvoice?->customer?->email,
                            'address' => $originalInvoice?->customer?->address,
                        ],
                        'supplier' => [
                            'id' => $originalInvoice?->supplier?->id,
                            'name' => $originalInvoice?->supplier?->name ?? null,
                            'phone' => $originalInvoice?->supplier?->phone,
                            'email' => $originalInvoice?->supplier?->email,
                        ],
                        'items' => $originalInvoice->items,
                        'history' => $invoiceHistory,
                    ]
                ], 200);
            }

            /** -------------------------
             *  SALE / PURCHASE FLOW
             *  ------------------------*/
            $totalQty = 0;
            $totalDiscount = 0;
            $totalTax = 0;
            $totalVat = 0;
            $subTotal = 0;

            $reward = null;
            $customer = null;

            if ($request->customer_id && $request->customer_id !== 'walk-in') {
                $customer = User::find($request->customer_id);
                if (!$customer) {
                    throw new \Exception('Customer not found');
                }
            }

            if ($request->points_used > 0 || $request->points_earned > 0) {
                $reward = RewordSetup::where('company_id', Auth::user()->company_id)->first() ?? RewordSetup::first();
                if (!$reward) {
                    throw new \Exception('Reward system is not configured');
                }

                $currentDate = now();
                $fromDate = \Carbon\Carbon::parse($reward->form_date);
                $toDate = \Carbon\Carbon::parse($reward->to_date);
                if ($currentDate < $fromDate || $currentDate > $toDate) {
                    throw new \Exception('Reward system is not active');
                }

                if ($request->points_used > 0) {
                    if (!$customer || $request->customer_id === 'walk-in') {
                        throw new \Exception('Reward points cannot be used for walk-in customers');
                    }
                    if (!in_array($reward->redeem_type, ['sale', 'both'])) {
                        throw new \Exception('Reward points redemption is not allowed for sales');
                    }
                    if ($request->points_used > $customer->total_reword) {
                        throw new \Exception('Insufficient reward points');
                    }
                }
            }

            // Create new invoice
            $invoice = new Invoice();
            $invoice->type = $request->type;
            // $invoice->company_id = $request->company_id;
            $invoice->warehouse_id = optional(Auth::user())->warehouse_id ?? optional(Warehouse::where('is_default', 1)->first())->id;
            $invoice->user_id = Auth::id();
            $invoice->customer_id = $request->customer_id;
            $invoice->date = $request->date;
            $invoice->note = $request->note ?? null;
            // $invoice->isFracture = ($request->is_fracture == 'true') ? 1 : 0;
            $invoice->card_type = $request->card_type ?? null;
            $invoice->card_last_digits = $request->card_last_digits ?? null;
            $invoice->mf_type = $request->mf_type ?? null;
            $invoice->qr_provider = $request->qr_provider ?? null;
            $invoice->qr_transaction_id = $request->qr_transaction_id ?? null;
            $invoice->points_used = $request->points_used ?? 0;
            $invoice->points_earned = $request->points_earned ?? 0;
            $invoice->save();

            foreach ($request->items as $item) {
                $inventoryItem = InventoryItem::find($item['inventory_item_id']);

                $lineDiscountType = $item['discount_type'] ?? 'percent';
                $lineDiscountValue = (float) ($item['discount'] ?? 0);
                if ($lineDiscountValue <= 0 && $request->type === 'sale') {
                    $setupDiscount = $this->setupDiscountForLine(
                        $inventoryItem,
                        $item['product_id'] ?? null,
                        (float) ($item['unit_price'] ?? 0),
                        $this->currentCompanyId()
                    );
                    $lineDiscountType = $setupDiscount['type'];
                    $lineDiscountValue = (float) $setupDiscount['value'];
                }

                // Calculate item totals based on unit price
                $basePrice = $item['qty'] * $item['unit_price'];
                $discountAmount = $this->lineDiscountAmount($basePrice, $lineDiscountValue, $lineDiscountType, (float) ($item['qty'] ?? 1));
                $taxableAmount = $basePrice - $discountAmount;
                $taxAmount = $item['qty'] * $item['unit_price'] * ($item['tax_rate'] / 100 ?? 0);
                $vatAmount = $item['qty'] * $item['unit_price'] * ($item['vat_rate'] / 100 ?? 0);
                $itemTotal = $taxableAmount + $taxAmount + $vatAmount;

                // invoice items 
                $invoiceItem = new InvoiceItem();
                $invoiceItem->warehouse_id = $inventoryItem?->warehouse_id
                    ?? $request->warehouse_id
                    ?? optional(Auth::user())->warehouse_id
                    ?? optional(Warehouse::where('is_default', 1)->first())->id;
                $invoiceItem->invoice_id = $invoice->id;
                $invoiceItem->type = $request->type;
                $invoiceItem->date = $invoice->date;
                $invoiceItem->user_id = Auth::id();
                $invoiceItem->company_id = $this->currentCompanyId();
                $invoiceItem->product_id = $item['product_id'];
                $invoiceItem->variant_id = is_array($inventoryItem->variant_id) ? $inventoryItem->variant_id : null;
                $invoiceItem->inventory_id = $inventoryItem->inventory_id;
                $invoiceItem->lot_number = $item['lot_number'] ?? null;
                $invoiceItem->qty = $item['qty'];
                $invoiceItem->unit_price = $item['unit_price'];
                $invoiceItem->discount = $lineDiscountValue;
                $invoiceItem->discount_amount = $discountAmount ?? 0;
                // $invoiceItem->tax_rate = $item['tax_rate'] ?? 0;
                // $invoiceItem->tax = $taxAmount;
                $invoiceItem->vat_rate = $item['vat_rate'] ?? 0;
                $invoiceItem->vat = $vatAmount;
                $invoiceItem->total = $itemTotal;
                $invoiceItem->save();


                // invoice history 
                $invoiceHistory = new InventoryHistory();
                $invoiceHistory->invoice_id = $invoice->id;
                $invoiceHistory->type = $request->type;
                $invoiceHistory->company_id = $this->currentCompanyId();
                $invoiceHistory->product_id = $item['product_id'];
                $invoiceHistory->inventory_item_id = $inventoryItem->id;
                $invoiceHistory->variant = is_array($inventoryItem->variant_id)
                    ? json_encode($inventoryItem->variant_id, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
                    : null;
                $invoiceHistory->inventory_id = $inventoryItem->inventory_id;
                $invoiceHistory->lot_number = $item['lot_number'] ?? null;
                $invoiceHistory->barcode = $item['barcode'] ?? null;
                $invoiceHistory->quantity = $item['qty'];
                $invoiceHistory->unit_price = $item['unit_price'];
                $invoiceHistory->original_unit_price = $inventoryItem->price;
                $invoiceHistory->discount = $lineDiscountValue;
                $invoiceHistory->discount_amount = $discountAmount ?? 0;
                $invoiceHistory->total = $itemTotal;
                $invoiceHistory->save();

                // Decrease quantity from existing inventory
                $existingInventory = Inventory::find($item['inventory_id']);
                if ($existingInventory && $existingInventory->quantity >= $item['qty']) {
                    $existingInventory->quantity -= $item['qty'];
                    $existingInventory->save();

                    $inventoryItem->quantity -= $item['qty'];
                    $inventoryItem->save();

                    $inventoryItem->barcodes()->where('barcode', $item['barcode'])->update([
                        'used' => 1
                    ]);
                } else {
                    throw new \Exception("Insufficient inventory for product ID: {$item['product_id']}");
                }

                $totalQty += $item['qty'];
                $totalDiscount += $discountAmount;
                $subTotal += $itemTotal;
            }

            // Apply global tax and VAT on subtotal
            $globalTaxAmount = $subTotal * ($request->global_tax_percentage / 100 ?? 0);
            $globalVatAmount = $subTotal * ($request->global_vat_percentage / 100 ?? 0);

            // Apply invoice-level discount
            $invoiceDiscount = $request->discount_type === 'percent'
                ? $subTotal * ($request->discount / 100 ?? 0)
                : ($request->discount ?? 0);

            // Apply reward points
            $pointsDiscount = 0;
            if ($request->points_used > 0 && $reward && $customer) {
                $pointsDiscount = $request->points_used * ($reward->reword_value ?? 1);
                if ($pointsDiscount > $subTotal) {
                    throw new \Exception('Points value exceeds the total amount due');
                }
                $customer->total_reword -= $request->points_used;
                $customer->save();

                RewordHistory::create([
                    'user_id' => $customer->id,
                    'invoice_id' => $invoice->id,
                    'reword_amount' => $request->points_used,
                    'invoice_amount' => $subTotal,
                    'type' => 'debit',
                    'conversion_value' => $reward->reword_value,
                ]);
            }

            if ($request->points_earned > 0 && $customer) {
                $customer->total_reword += $request->points_earned;
                $customer->save();

                RewordHistory::create([
                    'user_id' => $customer->id,
                    'invoice_id' => $invoice->id,
                    'reword_amount' => $request->points_earned,
                    'invoice_amount' => $subTotal,
                    'type' => 'credit',
                    'conversion_value' => $reward->reword_value,
                ]);
            }

            // Calculate grand total
            $total = $subTotal + $globalTaxAmount + $globalVatAmount - $invoiceDiscount - $pointsDiscount;

            if ($total < 0) {
                throw new \Exception('Grand total cannot be negative');
            }

            $invoice->qty = $totalQty;
            $invoice->discount = $totalDiscount + $invoiceDiscount;
            // $invoice->tax_rate = $request->global_tax_percentage ?? 0;  
            // $invoice->tax = $globalTaxAmount;
            $invoice->vat_rate = $request->global_vat_percentage ?? 0;
            $invoice->vat = $globalVatAmount;
            $invoice->sub_total = $subTotal;
            $invoice->total = $total;
            $invoice->due_amount = $total - ($request->paid_amount ?? 0);
            $invoice->paid_amount = $request->paid_amount ?? 0;
            $invoice->change_due = $request->change_due ?? 0;

            // Set payment status
            $netPaid = ($request->paid_amount ?? $total) - ($request->change_due ?? 0);
            if (abs($netPaid - $invoice->total) < 0.01) {
                $invoice->payment_status = 1; // Paid
            } elseif ($netPaid < $invoice->total) {
                $invoice->payment_status = 2; // Partial
            } else {
                $invoice->payment_status = 0; // Unpaid
            }

            $invoice->payment_method = ($request->paid_amount > 0) ? $request->payment_method : null;
            $invoice->save();

            // Record transaction for initial payment
            if ($request->paid_amount > 0 || $invoice->paid_amount > 0) {
                Transaction::create([
                    'invoice_id' => $invoice->id,
                    'user_id' => Auth::id(),
                    'amount' => $request->paid_amount ?? $total,
                    'payment_method' => $request->payment_method,
                    'card_type' => $request->card_type ?? null,
                    'card_last_digits' => $request->card_last_digits ?? null,
                    'mf_type' => $request->mf_type ?? null,
                    'mf_number' => $request->mf_number ?? null,
                    'qr_provider' => $request->qr_provider ?? null,
                    'qr_transaction_id' => $request->qr_transaction_id ?? null,
                    'transaction_date' => $request->date,
                ]);
            }

            // Create payment schedules for partial payments
            if ($request->payment_schedule && $invoice->due_amount > 0) {
                $scheduleTotal = 0;
                foreach ($request->payment_schedule as $schedule) {
                    $scheduleTotal += $schedule['amount'];
                    PaymentSchedule::create([
                        'invoice_id' => $invoice->id,
                        'amount' => $schedule['amount'],
                        'due_date' => $schedule['due_date'],
                        'remainder_date' => $schedule['remainder_date'] ?? null,
                        'status' => 'DUE',
                    ]);
                }
                if (abs($scheduleTotal - $invoice->due_amount) > 0.01) {
                    throw new \Exception('Payment schedule total must equal the due amount');
                }
            }

            // Record coupon/gift card in DiscountHistory
            if ($couponData) {
                DiscountHistory::create([
                    'user_id' => $customer->id ?? null,
                    'invoice_id' => $invoice->id,
                    'setup_id' => $couponData['setup_id'],
                    'code' => $couponData['code'],
                    'invoice_amount' => $subTotal,
                    'discount_amount' => $couponData['discount_type'] === 'percent'
                        ? $subTotal * ($couponData['discount_amount'] / 100)
                        : $couponData['discount_amount'],
                    'discount_type' => $couponData['discount_type'],
                    'created_by' => Auth::id(),
                ]);

                // Mark gift card as redeemed if applicable
                if (isset($couponData['is_gift_card']) && $couponData['is_gift_card']) {
                    $giftCard = RewordCard::where('card_number', $couponData['code'])->first();
                    if ($giftCard) {
                        $giftCard->is_redeemed = 1;
                        $giftCard->user_id = $customer->id ?? null;
                        $giftCard->save();
                    }
                }
            }

            DB::commit();
            $originalInvoice = Invoice::with([
                'items.product',
                'items.inventory',
                'supplier',
                'customer'
            ])->findOrFail($invoice->id);

            $invoiceItems = InvoiceItem::with([
                'product',
                'bundle.bundleItems.product',
                'inventory',
            ])->where('invoice_id', $invoice->id)->get()->map(function ($item) {
                $displayName = $item->item_type === 'bundle'
                    ? ($item->bundle_name ?: $item->bundle?->name ?: 'Bundle Item')
                    : ($item->product?->name ?: 'Product Item');

                $row = $item->toArray();
                $row['name'] = $displayName;
                $row['product_name'] = $displayName;
                $row['bundle_components'] = $item->item_type === 'bundle'
                    ? $item->bundle?->bundleItems?->map(function ($bundleItem) {
                        return [
                            'product_id' => $bundleItem->product_id,
                            'product_name' => $bundleItem->product?->name ?? 'N/A',
                            'quantity_per_bundle' => (float) ($bundleItem->quantity ?? 0),
                        ];
                    })->values()->all()
                    : [];

                return $row;
            });

            $invoiceHistory = InventoryHistory::where('invoice_id', $invoice->id)->get();

            // Send email to customer if email is available and it's a sale invoice
            if ($request->type === 'sale' && $originalInvoice->customer && $originalInvoice->customer->email) {
                try {
                    $this->sendInvoiceEmail($originalInvoice, $originalInvoice->customer->email);
                } catch (\Exception $e) {
                    // Log email error but don't fail the invoice creation
                    \Log::error('Failed to send invoice email after creation: ' . $e->getMessage());
                }
            }

            return response()->json([
                'status' => 1,
                'message' => 'Invoice created' . ($request->type === 'sale' && $originalInvoice->customer && $originalInvoice->customer->email ? ' and email sent' : ''),
                'data' => [
                    'id' => $originalInvoice->id,
                    'type' => $originalInvoice->type,
                    'company_id' => $originalInvoice->company_id ?? null,
                    'user_id' => $originalInvoice->user_id,
                    'warehouse_id' => $originalInvoice->warehouse_id,
                    'invoice_no' => $originalInvoice->invoice_no ?? null,
                    'date' => $originalInvoice->date ? date('d F, Y', strtotime($originalInvoice->date)) : null,
                    'qty' => $originalInvoice->qty,
                    'discount' => $originalInvoice->discount,
                    // 'tax_rate' => $originalInvoice->tax_rate,
                    // 'tax' => $originalInvoice->tax,
                    'vat_rate' => $originalInvoice->vat_rate,
                    'vat' => $originalInvoice->vat,
                    'sub_total' => $originalInvoice->sub_total,
                    'total' => $originalInvoice->total,
                    'note' => $originalInvoice->note,
                    'paid_amount' => $originalInvoice->paid_amount,
                    'payment_status' => $originalInvoice->payment_status,
                    'isFracture' => $originalInvoice->isFracture,
                    'payment_method' => $originalInvoice->payment_method,
                    'due_amount' => $originalInvoice->due_amount,
                    'status' => $originalInvoice->status,
                    'return_amount' => $originalInvoice->return_amount,
                    'customer' => [
                        'id' => $originalInvoice?->customer?->id,
                        'name' => $originalInvoice?->customer?->first_name . ' ' . $originalInvoice?->customer?->last_name,
                        'phone' => $originalInvoice?->customer?->phone,
                        'email' => $originalInvoice?->customer?->email,
                        'address' => $originalInvoice?->customer?->address,
                    ],
                    'supplier' => [
                        'id' => $originalInvoice?->supplier?->id,
                        'name' => $originalInvoice?->supplier?->name ?? null,
                        'phone' => $originalInvoice?->supplier?->phone,
                        'email' => $originalInvoice?->supplier?->email,
                    ],
                    'items' => $invoiceItems,
                    'history' => $invoiceHistory,
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 0,
                'message' => 'Error creating invoice: ' . $e->getMessage(),
                'error' => $e->getMessage(),
                'line' => $e->getLine(),
                'file' => $e->getFile(),
            ], 500);
        }
    }

    public function payInstallment(Request $request, $schedule_id)
    {
        $settings = PosSetting::where('key', 'payment_methods')->first();
        $paymentMethods = $this->normalizePaymentMethods($settings?->value);

        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0',
            'payment_method' => ['required', function ($attribute, $value, $fail) use ($paymentMethods) {
                $method = $this->findPaymentMethod($paymentMethods, $value);
                if (!$method || !$method['enabled'] || in_array($value, ['Cash Refund', 'Refund to Card', 'Refund to MF', 'Reward Points'])) {
                    $fail('The selected payment method is not enabled for payments.');
                }
            }],
            'card_last_digits' => [function ($attribute, $value, $fail) use ($request, $paymentMethods) {
                if ($request->payment_method === 'Card') {
                    $method = $this->findPaymentMethod($paymentMethods, 'Card');
                    if ($method && $method['config']['require_last_digits']) {
                        if (!$value) {
                            $fail('Card last digits are required.');
                        } else {
                            $allowedLengths = $method['config']['last_digit_length'] ?? [5, 6];
                            if (!in_array(strlen($value), $allowedLengths)) {
                                $fail("Card last digits must be " . implode(' or ', $allowedLengths) . " digits.");
                            }
                        }
                    }
                }
            }],
            'qr_provider' => [function ($attribute, $value, $fail) use ($request, $paymentMethods) {
                if (in_array($request->payment_method, ['QR Payment', 'MF Payment']) && !$value) {
                    $fail('Provider is required.');
                } elseif (in_array($request->payment_method, ['QR Payment', 'MF Payment']) && $value) {
                    $method = $this->findPaymentMethod($paymentMethods, $request->payment_method);
                    $allowedProviders = $method['config']['providers'] ?? [];
                    if (!in_array($value, $allowedProviders)) {
                        $fail('Invalid provider.');
                    }
                }
            }],
            'qr_transaction_id' => 'required_if:payment_method,QR Payment,MF Payment',
            'transaction_date' => 'required',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'message' => 'Validation failed.',
                'errors' => $validator->errors()->toArray(),
            ], 422);
        }

        DB::beginTransaction();

        try {
            $schedule = PaymentSchedule::findOrFail($schedule_id);
            if ($schedule->status === 'PAID') {
                throw new \Exception('This installment has already been paid');
            }

            $paymentAmount = round((float) $request->amount, 2);
            $scheduleAmount = round((float) $schedule->amount, 2);
            $schedulePaidAmount = round((float) ($schedule->paid_amount ?? 0), 2);
            $scheduleRemainingAmount = round(max(0, $scheduleAmount - $schedulePaidAmount), 2);

            if ($paymentAmount <= 0) {
                throw new \Exception('Payment amount must be greater than zero');
            }

            if ($paymentAmount > $scheduleRemainingAmount) {
                throw new \Exception('Payment amount cannot exceed the remaining scheduled amount');
            }

            $invoice = Invoice::findOrFail($schedule->invoice_id);
            $invoiceDueAmount = round((float) ($invoice->due_amount ?? 0), 2);

            if ($paymentAmount > $invoiceDueAmount) {
                throw new \Exception('Payment amount cannot exceed the invoice due amount');
            }

            // Record transaction
            Transaction::create([
                'invoice_id' => $invoice->id,
                'user_id' => Auth::id(),
                'amount' => $paymentAmount,
                'payment_method' => $request->payment_method,
                'card_type' => $request->card_type ?? null,
                'card_last_digits' => $request->card_last_digits ?? null,
                'mf_type' => $request->mf_type ?? null,
                'mf_number' => $request->mf_number ?? null,
                'qr_provider' => $request->qr_provider ?? null,
                'qr_transaction_id' => $request->qr_transaction_id ?? null,
                'transaction_date' => $request->transaction_date,
            ]);

            // Update schedule
            $schedule->paid_amount = round($schedulePaidAmount + $paymentAmount, 2);
            if ($schedule->paid_amount >= $scheduleAmount) {
                $schedule->status = 'PAID';
                $schedule->paid_date = $request->transaction_date;
            } else {
                $schedule->status = 'PARTIAL';
            }
            $schedule->save();

            // Update invoice due amount
            $invoice->due_amount = round(max(0, $invoiceDueAmount - $paymentAmount), 2);
            $invoice->paid_amount = round(((float) ($invoice->paid_amount ?? 0)) + $paymentAmount, 2);
            // Ensure invoice payment method reflects installment payment method.
            $invoice->payment_method = $request->payment_method;
            if ($invoice->due_amount <= 0) {
                $invoice->payment_status = 1; // Paid
            } else {
                $invoice->payment_status = 2; // Partial
            }
            $invoice->save();

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Installment payment processed successfully',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 0,
                'message' => 'Error processing payment: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function payInvoiceDue(Request $request, $id)
    {
        $settings = PosSetting::where('key', 'payment_methods')->first();
        $paymentMethods = $this->normalizePaymentMethods($settings?->value);

        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0',
            'payment_method' => ['required', function ($attribute, $value, $fail) use ($paymentMethods) {
                $method = $this->findPaymentMethod($paymentMethods, $value);
                if (!$method || !$method['enabled'] || in_array($value, ['Cash Refund', 'Refund to Card', 'Refund to MF', 'Reward Points'])) {
                    $fail('The selected payment method is not enabled for payments.');
                }
            }],
            'card_last_digits' => [function ($attribute, $value, $fail) use ($request, $paymentMethods) {
                if ($request->payment_method === 'Card') {
                    $method = $this->findPaymentMethod($paymentMethods, 'Card');
                    if ($method && $method['config']['require_last_digits']) {
                        if (!$value) {
                            $fail('Card last digits are required.');
                        } else {
                            $allowedLengths = $method['config']['last_digit_length'] ?? [5, 6];
                            if (!in_array(strlen($value), $allowedLengths)) {
                                $fail("Card last digits must be " . implode(' or ', $allowedLengths) . " digits.");
                            }
                        }
                    }
                }
            }],
            'qr_provider' => [function ($attribute, $value, $fail) use ($request, $paymentMethods) {
                if (in_array($request->payment_method, ['QR Payment', 'MF Payment']) && !$value) {
                    $fail('Provider is required.');
                } elseif (in_array($request->payment_method, ['QR Payment', 'MF Payment']) && $value) {
                    $method = $this->findPaymentMethod($paymentMethods, $request->payment_method);
                    $allowedProviders = $method['config']['providers'] ?? [];
                    if (!in_array($value, $allowedProviders)) {
                        $fail('Invalid provider.');
                    }
                }
            }],
            'qr_transaction_id' => 'required_if:payment_method,QR Payment,MF Payment',
            'transaction_date' => 'required',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'message' => 'Validation failed.',
                'errors' => $validator->errors()->toArray(),
            ], 422);
        }

        DB::beginTransaction();

        try {
            $invoice = Invoice::findOrFail($id);

            if ($invoice->type === 'quotation') {
                throw new \Exception('Quotation payments are not allowed');
            }

            $paymentAmount = round((float) $request->amount, 2);
            $invoiceDueAmount = round((float) ($invoice->due_amount ?? 0), 2);

            if ($paymentAmount <= 0) {
                throw new \Exception('Payment amount must be greater than zero');
            }

            if ($invoiceDueAmount <= 0) {
                throw new \Exception('This invoice has no due amount');
            }

            if ($paymentAmount > $invoiceDueAmount) {
                throw new \Exception('Payment amount cannot exceed the invoice due amount');
            }

            Transaction::create([
                'invoice_id' => $invoice->id,
                'user_id' => Auth::id(),
                'amount' => $paymentAmount,
                'payment_method' => $request->payment_method,
                'card_type' => $request->card_type ?? null,
                'card_last_digits' => $request->card_last_digits ?? null,
                'mf_type' => $request->mf_type ?? null,
                'mf_number' => $request->mf_number ?? null,
                'qr_provider' => $request->qr_provider ?? null,
                'qr_transaction_id' => $request->qr_transaction_id ?? null,
                'transaction_date' => $request->transaction_date,
            ]);

            $invoice->due_amount = round(max(0, $invoiceDueAmount - $paymentAmount), 2);
            $invoice->paid_amount = round(((float) ($invoice->paid_amount ?? 0)) + $paymentAmount, 2);
            $invoice->payment_method = $request->payment_method;
            $invoice->payment_status = $invoice->due_amount <= 0 ? 1 : 2;
            $invoice->save();

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Invoice payment processed successfully',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 0,
                'message' => 'Error processing payment: ' . $e->getMessage(),
            ], 500);
        }
    }


    public function invoiceItemReturn(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'invoice_id' => 'required|exists:invoices,id',
            'product_id' => 'required|exists:product,id',
            'inventory_id' => 'nullable|exists:inventory,id',
            'lot_number' => 'nullable|string',
            'qty' => 'required|numeric|min:-999999', // Allow negative for returns
            'unit_price' => 'required|numeric|min:0',
            'total' => 'required|numeric', // Allow negative for returns
            'tax_rate' => 'nullable|numeric|min:0',
            'vat_rate' => 'nullable|numeric|min:0',
            'original_sale_item_id' => 'required|exists:invoice_items,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 0, 'errors' => $validator->errors()], 422);
        }

        DB::beginTransaction();

        try {
            // Verify original invoice and sale item
            $originalInvoice = Invoice::findOrFail($request->invoice_id);
            $originalSaleItem = InvoiceItem::findOrFail($request->original_sale_item_id);

            if ($originalSaleItem->invoice_id !== $originalInvoice->id) {
                throw new \Exception('Original sale item does not belong to the specified invoice');
            }
            if ($this->invoiceAlreadyUsedForReturn($originalInvoice)) {
                throw new \Exception('This invoice has already been used for return.');
            }

            // Check if the product is eligible for return (e.g., is_return_product flag)
            // Assuming is_return_product is stored in InvoiceItem or Product
            // if (!$originalSaleItem->is_returned) {
            //     throw new \Exception('This product is not eligible for return');
            // }

            // Check if the return quantity doesn't exceed the original sale quantity
            $returnedQty = InvoiceItem::where('original_sale_item_id', $request->original_sale_item_id)
                ->where('type', 'return')
                ->sum('qty'); // Sum of previous returns (negative)

            $remainingQty = $originalSaleItem->qty + $returnedQty; // Original qty minus returned qty
            if (abs($request->qty) > $remainingQty) {
                throw new \Exception('Return quantity exceeds the original sale quantity');
            }

            // Find customer for reward points adjustment
            $customer = User::find($originalInvoice->customer_id);
            if (!$customer) {
                throw new \Exception('Customer not found');
            }


            // Create new invoice item for return
            $invoiceItem = new InvoiceItem();
            $invoiceItem->invoice_id = $request->invoice_id;
            $invoiceItem->type = 'return';
            $invoiceItem->date = now()->toDateString();
            $invoiceItem->company_id = $originalInvoice->company_id;
            $invoiceItem->warehouse_id = $originalInvoice->warehouse_id;
            $invoiceItem->user_id = Auth::id();
            $invoiceItem->product_id = $request->product_id;
            $invoiceItem->variant_id = $originalSaleItem->variant_id;
            $invoiceItem->inventory_id = $originalSaleItem->inventory_id;
            $invoiceItem->lot_number = $originalSaleItem->lot_number;
            $invoiceItem->qty = $request->qty; // Negative quantity
            $invoiceItem->unit_price = $originalSaleItem->unit_price;
            $invoiceItem->discount = 0; // No discount for returns
            // $invoiceItem->tax_rate = $request->tax_rate ?? 0;
            // $invoiceItem->tax = ($request->qty * $request->unit_price) * (($request->tax_rate ?? 0) / 100);
            $invoiceItem->vat_rate = $request->vat_rate ?? 0;
            $invoiceItem->vat = ($request->qty * $request->unit_price) * (($request->vat_rate ?? 0) / 100);
            $invoiceItem->total = $request->total; // Negative total
            $invoiceItem->original_sale_item_id = $request->original_sale_item_id;
            $invoiceItem->is_returned = true; // Mark as returnable (if applicable)
            $invoiceItem->save();

            // Update inventory (increase stock for return)
            if ($request->inventory_id) {
                $inventory = Inventory::find($request->inventory_id);
                if (!$inventory) {
                    throw new \Exception('Inventory not found');
                }
                $inventory->quantity += abs($request->qty); // Increase stock
                $inventory->save();

                $inventoryItem = $inventory->inventory_items
                    ->where('product_id', $originalSaleItem->product_id)
                    ->where('variant_id', $originalSaleItem->variant_id)
                    ->first();
                if (!$inventoryItem) {
                    throw new \Exception('Inventory item not found');
                }
                $inventoryItem->quantity += abs($request->qty); // Increase stock
                $inventoryItem->save();
            }

            // Update invoice totals
            $invoice = $originalInvoice;
            $invoice->return_amount = $request->total;;
            $invoice->save();

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Return processed successfully',
                'data' => [
                    'id' => $invoiceItem->id,
                ],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 0,
                'message' => 'Error processing return: ' . $e->getMessage(),
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $invoice = Invoice::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'type' => 'required|in:sale,purchase',
            'invoice_no' => 'required|unique:invoices,invoice_no,' . $id,
            'date' => 'required|date',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:product,id',
            'items.*.variant_id' => 'nullable|exists:product_variants,id',
            'items.*.qty' => 'required|numeric|min:0',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.discount' => 'nullable|numeric|min:0',
            'items.*.tax_rate' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['status' => 0, 'errors' => $validator->errors()], 422);
        }

        DB::beginTransaction();

        try {
            // Delete old invoice items and inventory entries
            $invoice->items()->update(['is_deleted' => true]);
            $invoice->items()->delete();
            Inventory::where('invoice_id', $invoice->id)->update(['is_deleted' => true]);
            Inventory::where('invoice_id', $invoice->id)->delete();

            $totalQty = 0;
            $totalDiscount = 0;
            $totalTax = 0;
            $total = 0;

            foreach ($request->items as $item) {
                $lineTotal = $item['qty'] * $item['unit_price'];
                $discount = $item['discount'] ?? 0;
                $taxRate = $item['tax_rate'] ?? 0;
                $tax = ($lineTotal - $discount) * ($taxRate / 100);
                $netTotal = $lineTotal - $discount + $tax;

                // Save InvoiceItem using save()
                $invoiceItem = new \App\Models\InvoiceItem(); // Adjust namespace as needed
                $invoiceItem->invoice_id = $invoice->id;
                $invoiceItem->type = $request->type;
                $invoiceItem->company_id = $invoice->company_id;
                $invoiceItem->warehouse_id = $invoice->warehouse_id;
                $invoiceItem->user_id = $invoice->user_id;
                $invoiceItem->product_id = $item['product_id'];
                $invoiceItem->variant_id = $item['variant_id'] ?? null;
                $invoiceItem->qty = $item['qty'];
                $invoiceItem->unit_price = $item['unit_price'];
                $invoiceItem->discount = $discount;
                $invoiceItem->tax_rate = $taxRate;
                $invoiceItem->tax = $tax;
                $invoiceItem->total = $netTotal;
                $invoiceItem->date = $request->date;
                $invoiceItem->invoice_id = $request->invoice_no;
                $invoiceItem->save();

                // Save Inventory using save()
                $inventory = new Inventory();
                $inventory->company_id = $invoice->company_id;
                $inventory->warehouse_id = $invoice->warehouse_id;
                $inventory->product_id = $item['product_id'];
                $inventory->variant_id = $item['variant_id'] ?? null;
                $inventory->quantity = $request->type === 'purchase' ? $item['qty'] : -$item['qty'];
                $inventory->price = $item['unit_price'];
                $inventory->purchase_price = $item['unit_price'];
                $inventory->discount_amount = $discount;
                $inventory->discount_type = 'flat';
                $inventory->tax = $tax;
                $inventory->vat = 0;
                $inventory->purchase_id = null;
                $inventory->invoice_id = $invoice->id;
                $inventory->save();

                $totalQty += $item['qty'];
                $totalDiscount += $discount;
                $totalTax += $tax;
                $total += $netTotal;
            }

            // Update invoice using fill + save()
            $invoice->type = $request->type;
            $invoice->invoice_no = $request->invoice_no;
            $invoice->date = $request->date;
            $invoice->qty = $totalQty;
            $invoice->discount = $totalDiscount;
            $invoice->tax = $totalTax;
            $invoice->total = $total;
            $invoice->save();

            DB::commit();

            return response()->json(['status' => 1, 'message' => 'Invoice updated', 'data' => $invoice]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['status' => 0, 'message' => 'Error updating invoice', 'error' => $e->getMessage()], 500);
        }
    }

    private function getReturnPolicy(): array
    {
        $settings = PosSetting::where('key', 'return_policy')->first();
        $value = is_array($settings?->value) ? $settings->value : [];

        return [
            'enabled' => (bool) ($value['enabled'] ?? true),
            'return_window_days' => (int) ($value['return_window_days'] ?? 7),
            'allow_partial_return' => (bool) ($value['allow_partial_return'] ?? true),
            'require_invoice' => (bool) ($value['require_invoice'] ?? true),
            'allow_damaged_return' => (bool) ($value['allow_damaged_return'] ?? true),
            'manager_approval_threshold' => (float) ($value['manager_approval_threshold'] ?? 0),
            'allowed_return_modes' => collect($value['allowed_return_modes'] ?? ['refund', 'exchange'])
                ->filter(fn ($mode) => in_array($mode, ['refund', 'exchange'], true))
                ->unique()
                ->values()
            ->all(),
        ];
    }

    private function invoiceAlreadyUsedForReturn(Invoice $invoice): bool
    {
        if (Invoice::query()
            ->where('type', 'return')
            ->where('original_invoice_id', $invoice->id)
            ->exists()) {
            return true;
        }

        $saleItemIds = $invoice->relationLoaded('items')
            ? $invoice->items
                ->where('type', 'sale')
                ->pluck('id')
                ->filter()
                ->values()
            : InvoiceItem::query()
                ->where('invoice_id', $invoice->id)
                ->where('type', 'sale')
                ->pluck('id');

        if ($saleItemIds->isEmpty()) {
            return false;
        }

        return InvoiceItem::query()
            ->where('type', 'return')
            ->whereIn('original_sale_item_id', $saleItemIds)
            ->exists();
    }

    public function returnPreview(Request $request, string $invoiceId)
    {
        try {
            $invoice = Invoice::with(['items.product', 'customer'])
                ->where('id', $invoiceId)
                ->where('type', 'sale')
                ->first();

            if (!$invoice) {
                return response()->json([
                    'status' => 0,
                    'message' => 'No matching sold invoice found.',
                ], 200);
            }

            $policy = $this->getReturnPolicy();
            if (!$policy['enabled']) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Return is disabled by company policy.',
                ], 422);
            }

            if ($this->invoiceAlreadyUsedForReturn($invoice)) {
                return response()->json([
                    'status' => 0,
                    'message' => 'This invoice has already been used for return.',
                ], 200);
            }

            $invoiceDate = Carbon::parse($invoice->date ?? $invoice->created_at);
            $isWindowExpired = $policy['return_window_days'] > 0
                ? now()->diffInDays($invoiceDate) > $policy['return_window_days']
                : false;

            $lines = $invoice->items
                ->where('type', 'sale')
                ->where('item_type', 'product')
                ->map(function ($line) use ($isWindowExpired, $policy) {
                    $returnedQty = abs((float) InvoiceItem::query()
                        ->where('original_sale_item_id', $line->id)
                        ->where('type', 'return')
                        ->sum('qty'));
                    $soldQty = abs((float) $line->qty);
                    $returnableQty = max($soldQty - $returnedQty, 0);
                    $blockedReason = null;

                    if ($isWindowExpired) {
                        $blockedReason = 'Return window expired';
                    } elseif (!$policy['allow_partial_return'] && $returnedQty > 0) {
                        $blockedReason = 'Partial return is not allowed by policy';
                    } elseif ($returnableQty <= 0) {
                        $blockedReason = 'Already fully returned';
                    }

                    return [
                        'invoice_item_id' => $line->id,
                        'product_id' => $line->product_id,
                        'product_name' => $line->product?->name ?? 'N/A',
                        'code' => $line->product?->code ?? null,
                        'inventory_id' => $line->inventory_id,
                        'inventory_item_id' => $line->inventory_item_id ?? null,
                        'lot_number' => $line->lot_number,
                        'unit_price' => (float) $line->unit_price,
                        'tax_rate' => (float) ($line->tax_rate ?? 0),
                        'vat_rate' => (float) ($line->vat_rate ?? 0),
                        'sold_qty' => $soldQty,
                        'returned_qty' => $returnedQty,
                        'returnable_qty' => $returnableQty,
                        'blocked_reason' => $blockedReason,
                    ];
                })
                ->values();

            return response()->json([
                'status' => 1,
                'message' => 'Return preview fetched successfully',
                'data' => [
                    'invoice' => [
                        'id' => $invoice->id,
                        'invoice_no' => $invoice->invoice_no,
                        'date' => $invoice->date,
                        'customer_id' => $invoice->customer_id,
                        'customer_name' => trim(($invoice->customer?->first_name ?? '') . ' ' . ($invoice->customer?->last_name ?? '')),
                        'customer_phone' => $invoice->customer?->phone,
                        'customer_email' => $invoice->customer?->email,
                        'customer_address' => $invoice->customer?->address,
                    ],
                    'policy' => $policy,
                    'is_window_expired' => $isWindowExpired,
                    'items' => $lines,
                ],
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => $e->getMessage() ?: 'Failed to load return preview.',
            ], 422);
        }
    }

    public function returnStore(Request $request, string $invoiceId)
    {
        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.invoice_item_id' => 'required|integer|exists:invoice_items,id',
            'items.*.qty' => 'required|numeric|min:0.0001',
            'items.*.reason_code' => 'nullable|string|max:40',
            'items.*.is_damaged' => 'nullable|boolean',
            'return_type' => 'nullable|in:refund,exchange',
            'exchange_items' => 'nullable|array',
            'exchange_items.*.inventory_item_id' => 'required_with:exchange_items|integer|exists:inventory_items,id',
            'exchange_items.*.product_id' => 'nullable|string|max:80',
            'exchange_items.*.inventory_id' => 'nullable|string|max:80',
            'exchange_items.*.lot_number' => 'nullable|string|max:100',
            'exchange_items.*.qty' => 'required_with:exchange_items|numeric|min:0.0001',
            'exchange_items.*.unit_price' => 'nullable|numeric|min:0',
            'exchange_items.*.barcode' => 'nullable|string|max:100',
            'exchange_total' => 'nullable|numeric|min:0',
            'refund_amount' => 'nullable|numeric|min:0',
            'refund_method' => 'nullable|string|max:40',
            'manager_approved' => 'nullable|boolean',
            'manager_approval_note' => 'nullable|string|max:500',
            'note' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'message' => collect($validator->errors()->all())->first() ?? 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        DB::beginTransaction();
        try {
            $invoice = Invoice::with(['items'])->where('id', $invoiceId)->where('type', 'sale')->firstOrFail();
            $policy = $this->getReturnPolicy();
            if (!$policy['enabled']) {
                throw new \Exception('Return is disabled by company policy.');
            }
            if ($this->invoiceAlreadyUsedForReturn($invoice)) {
                throw new \Exception('This invoice has already been used for return.');
            }

            $invoiceDate = Carbon::parse($invoice->date ?? $invoice->created_at);
            if ($policy['return_window_days'] > 0 && now()->diffInDays($invoiceDate) > $policy['return_window_days']) {
                throw new \Exception('Return window expired by company policy.');
            }

            $allowedReturnModes = $policy['allowed_return_modes'] ?? ['refund', 'exchange'];
            if (empty($allowedReturnModes)) {
                $allowedReturnModes = ['refund'];
            }

            $returnType = $request->input('return_type', $allowedReturnModes[0]);
            if (!in_array($returnType, $allowedReturnModes, true)) {
                $allowedLabel = implode(', ', $allowedReturnModes);
                throw new \Exception("Return type '{$returnType}' is not allowed by company policy. Allowed: {$allowedLabel}");
            }
            $exchangeTotal = (float) $request->input('exchange_total', 0);
            $inputRefundAmount = (float) $request->input('refund_amount', 0);

            $returnInvoice = new Invoice();
            $returnInvoice->type = 'return';
            $returnInvoice->original_invoice_id = $invoice->id;
            $returnInvoice->warehouse_id = $invoice->warehouse_id;
            $returnInvoice->user_id = Auth::id();
            $returnInvoice->customer_id = $invoice->customer_id;
            $returnInvoice->date = now()->toDateString();
            $returnInvoice->note = $request->note ?? null;
            $returnInvoice->save();

            $returnSubTotal = 0;
            $returnQtyTotal = 0;
            $salesReturnItemsPayload = [];

            foreach ((array) $request->items as $inputLine) {
                $saleItem = InvoiceItem::query()
                    ->where('id', $inputLine['invoice_item_id'])
                    ->where('invoice_id', $invoice->id)
                    ->where('type', 'sale')
                    ->where('item_type', 'product')
                    ->first();
                if (!$saleItem) {
                    throw new \Exception('Invalid sale line selected for return.');
                }

                $requestedQty = (float) $inputLine['qty'];
                $returnedQty = abs((float) InvoiceItem::query()
                    ->where('original_sale_item_id', $saleItem->id)
                    ->where('type', 'return')
                    ->sum('qty'));
                $soldQty = abs((float) $saleItem->qty);
                $returnableQty = max($soldQty - $returnedQty, 0);
                if ($requestedQty > $returnableQty) {
                    throw new \Exception("Return qty exceeds allowed qty for item #{$saleItem->id}. Max: {$returnableQty}");
                }
                if (!$policy['allow_partial_return'] && $requestedQty < $returnableQty) {
                    throw new \Exception('Partial return is not allowed by company policy.');
                }

                $isDamaged = filter_var($inputLine['is_damaged'] ?? false, FILTER_VALIDATE_BOOLEAN);
                if ($isDamaged && !$policy['allow_damaged_return']) {
                    throw new \Exception('Damaged returns are not allowed by company policy.');
                }

                $inventory = Inventory::query()->lockForUpdate()->findOrFail($saleItem->inventory_id);

                $inventoryItem = null;
                if (!empty($saleItem->inventory_item_id)) {
                    $inventoryItem = InventoryItem::withTrashed()
                        ->lockForUpdate()
                        ->find($saleItem->inventory_item_id);
                }

                if (!$inventoryItem) {
                    $inventoryItem = InventoryItem::withTrashed()
                        ->lockForUpdate()
                        ->where('invoice_item_id', $saleItem->id)
                        ->first();
                }

                if (!$inventoryItem) {
                    $inventoryItem = InventoryItem::withTrashed()
                        ->lockForUpdate()
                        ->where('inventory_id', $saleItem->inventory_id)
                        ->where('product_id', $saleItem->product_id)
                        ->where('lot_number', $saleItem->lot_number)
                        ->first();
                }

                if (!$inventoryItem) {
                    $historyInventoryItemId = InventoryHistory::withTrashed()
                        ->where('invoice_id', $invoice->id)
                        ->where('type', 'sale')
                        ->where('inventory_id', $saleItem->inventory_id)
                        ->where('product_id', $saleItem->product_id)
                        ->when(
                            !empty($saleItem->lot_number),
                            fn ($query) => $query->where('lot_number', $saleItem->lot_number)
                        )
                        ->whereNotNull('inventory_item_id')
                        ->orderByDesc('id')
                        ->value('inventory_item_id');

                    if (!empty($historyInventoryItemId)) {
                        $inventoryItem = InventoryItem::withTrashed()
                            ->lockForUpdate()
                            ->find($historyInventoryItemId);
                    }
                }

                if (!$inventoryItem) {
                    throw new \Exception('Inventory item not found for selected return product.');
                }

                if (method_exists($inventoryItem, 'trashed') && $inventoryItem->trashed()) {
                    $inventoryItem->restore();
                }

                $inventoryBefore = (float) $inventory->quantity;
                $inventory->quantity = round((float) $inventory->quantity + $requestedQty, 6);
                $inventory->save();

                $inventoryItem->quantity = round((float) $inventoryItem->quantity + $requestedQty, 6);
                $inventoryItem->save();

                $unitPrice = (float) $saleItem->unit_price;
                $lineTotal = round($requestedQty * $unitPrice, 2);

                $returnItem = new InvoiceItem();
                $returnItem->invoice_id = $returnInvoice->id;
                $returnItem->type = 'return';
                $returnItem->date = $returnInvoice->date;
                $returnItem->company_id = $invoice->company_id;
                $returnItem->warehouse_id = $invoice->warehouse_id;
                $returnItem->user_id = Auth::id();
                $returnItem->item_type = 'product';
                $returnItem->product_id = $saleItem->product_id;
                $returnItem->inventory_id = $saleItem->inventory_id;
                $returnItem->lot_number = $saleItem->lot_number;
                $returnItem->variant_id = $saleItem->variant_id;
                $returnItem->qty = -$requestedQty;
                $returnItem->unit_price = $unitPrice;
                $returnItem->discount = 0;
                $returnItem->discount_amount = 0;
                if (Schema::hasColumn('invoice_items', 'vat_rate')) {
                    $returnItem->vat_rate = (float) ($saleItem->vat_rate ?? 0);
                }
                if (Schema::hasColumn('invoice_items', 'tax_rate')) {
                    $returnItem->tax_rate = (float) ($saleItem->tax_rate ?? 0);
                }
                if (Schema::hasColumn('invoice_items', 'tax')) {
                    $returnItem->tax = 0;
                }
                if (Schema::hasColumn('invoice_items', 'vat')) {
                    $returnItem->vat = 0;
                }
                $returnItem->total = -$lineTotal;
                $returnItem->original_sale_item_id = $saleItem->id;
                $returnItem->is_returned = 1;
                $returnItem->save();

                app(StockMovementService::class)->record([
                    'company_id' => $invoice->company_id,
                    'product_id' => $saleItem->product_id,
                    'inventory_id' => $saleItem->inventory_id,
                    'inventory_item_id' => $inventoryItem->id,
                    'warehouse_id' => $invoice->warehouse_id,
                    'type' => StockMovementService::TYPE_RETURNED,
                    'quantity_change' => $requestedQty,
                    'quantity_before' => $inventoryBefore,
                    'quantity_after' => (float) $inventory->quantity,
                    'reference_type' => StockMovementService::REF_SALES_RETURN,
                    'reference_id' => $returnInvoice->id,
                    'note' => 'Sales return',
                ]);

                InventoryHistory::create([
                    'invoice_id' => $returnInvoice->id,
                    'type' => 'return',
                    'company_id' => $invoice->company_id,
                    'product_id' => $saleItem->product_id,
                    'inventory_item_id' => $inventoryItem->id,
                    'inventory_id' => $saleItem->inventory_id,
                    'lot_number' => $saleItem->lot_number,
                    'variant' => is_array($inventoryItem->variant_id)
                        ? json_encode($inventoryItem->variant_id, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
                        : null,
                    'quantity' => -$requestedQty,
                    'unit_price' => $unitPrice,
                    'original_unit_price' => (float) ($inventoryItem->price ?? 0),
                    'discount' => 0,
                    'discount_amount' => 0,
                    'total' => -$lineTotal,
                    'original_sale_item_id' => $saleItem->id,
                    'created_by' => Auth::id(),
                ]);

                $returnSubTotal += $lineTotal;
                $returnQtyTotal += $requestedQty;

                $salesReturnItemsPayload[] = [
                    'original_sale_item_id' => $saleItem->id,
                    'product_id' => $saleItem->product_id,
                    'inventory_id' => $saleItem->inventory_id,
                    'inventory_item_id' => $inventoryItem->id,
                    'lot_number' => $saleItem->lot_number,
                    'sold_qty' => $soldQty,
                    'returned_before_qty' => $returnedQty,
                    'return_qty' => $requestedQty,
                    'unit_price' => $unitPrice,
                    'discount_reverse' => 0,
                    'tax_reverse' => 0,
                    'vat_reverse' => 0,
                    'line_total_reverse' => $lineTotal,
                    'reason_code' => $inputLine['reason_code'] ?? null,
                    'is_damaged' => $isDamaged,
                    'restock_type' => $isDamaged ? 'damaged' : 'good',
                ];
            }

            $exchangeInvoice = null;
            $exchangeSubTotal = 0.0;
            $exchangeQtyTotal = 0.0;
            $exchangeItemsInput = collect((array) $request->input('exchange_items', []))
                ->filter(function ($row) {
                    return (float) ($row['qty'] ?? 0) > 0;
                })
                ->values();

            if ($returnType === 'exchange' && $exchangeItemsInput->isNotEmpty()) {
                $exchangeInvoice = new Invoice();
                $exchangeInvoice->type = 'sale';
                $exchangeInvoice->original_invoice_id = $invoice->id;
                $exchangeInvoice->warehouse_id = $invoice->warehouse_id;
                $exchangeInvoice->user_id = Auth::id();
                $exchangeInvoice->customer_id = $invoice->customer_id;
                $exchangeInvoice->date = now()->toDateString();
                $exchangeInvoice->note = 'Exchange sale linked with return invoice ' . ($returnInvoice->invoice_no ?? $returnInvoice->id);
                $exchangeInvoice->save();

                foreach ($exchangeItemsInput as $exchangeLine) {
                    $exchangeQty = (float) ($exchangeLine['qty'] ?? 0);
                    if ($exchangeQty <= 0) {
                        continue;
                    }

                    $exchangeInventoryItem = InventoryItem::query()
                        ->lockForUpdate()
                        ->findOrFail($exchangeLine['inventory_item_id']);
                    $exchangeInventory = Inventory::query()
                        ->lockForUpdate()
                        ->findOrFail($exchangeInventoryItem->inventory_id);

                    if (!empty($exchangeLine['product_id']) && (string) $exchangeInventoryItem->product_id !== (string) $exchangeLine['product_id']) {
                        throw new \Exception('Exchange product mismatch detected.');
                    }
                    if (!empty($exchangeLine['inventory_id']) && (string) $exchangeInventoryItem->inventory_id !== (string) $exchangeLine['inventory_id']) {
                        throw new \Exception('Exchange inventory mismatch detected.');
                    }

                    $availableQty = (float) $exchangeInventoryItem->quantity;
                    if ($availableQty < $exchangeQty) {
                        throw new \Exception("Insufficient stock for exchange item [{$exchangeInventoryItem->product_id}]. Available {$availableQty}, required {$exchangeQty}.");
                    }

                    $rootAvailableQty = (float) $exchangeInventory->quantity;
                    if ($rootAvailableQty < $exchangeQty) {
                        throw new \Exception("Insufficient stock in inventory for exchange item [{$exchangeInventoryItem->product_id}].");
                    }

                    $unitPrice = isset($exchangeLine['unit_price'])
                        ? (float) $exchangeLine['unit_price']
                        : (float) ($exchangeInventoryItem->price ?? 0);
                    $lineTotal = round($exchangeQty * $unitPrice, 2);

                    $exchangeItem = new InvoiceItem();
                    $exchangeItem->invoice_id = $exchangeInvoice->id;
                    $exchangeItem->type = 'sale';
                    $exchangeItem->date = $exchangeInvoice->date;
                    $exchangeItem->company_id = $invoice->company_id;
                    $exchangeItem->warehouse_id = $invoice->warehouse_id;
                    $exchangeItem->user_id = Auth::id();
                    $exchangeItem->item_type = 'product';
                    $exchangeItem->product_id = $exchangeInventoryItem->product_id;
                    $exchangeItem->inventory_id = $exchangeInventoryItem->inventory_id;
                    $exchangeItem->lot_number = $exchangeLine['lot_number'] ?? $exchangeInventoryItem->lot_number;
                    $exchangeItem->variant_id = is_array($exchangeInventoryItem->variant_id) ? $exchangeInventoryItem->variant_id : null;
                    $exchangeItem->qty = $exchangeQty;
                    $exchangeItem->unit_price = $unitPrice;
                    $exchangeItem->discount = 0;
                    $exchangeItem->discount_amount = 0;
                    if (Schema::hasColumn('invoice_items', 'vat_rate')) {
                        $exchangeItem->vat_rate = 0;
                    }
                    if (Schema::hasColumn('invoice_items', 'tax_rate')) {
                        $exchangeItem->tax_rate = 0;
                    }
                    if (Schema::hasColumn('invoice_items', 'tax')) {
                        $exchangeItem->tax = 0;
                    }
                    if (Schema::hasColumn('invoice_items', 'vat')) {
                        $exchangeItem->vat = 0;
                    }
                    $exchangeItem->total = $lineTotal;
                    $exchangeItem->save();

                    InventoryHistory::create([
                        'invoice_id' => $exchangeInvoice->id,
                        'type' => 'sale',
                        'company_id' => $invoice->company_id,
                        'product_id' => $exchangeInventoryItem->product_id,
                        'inventory_item_id' => $exchangeInventoryItem->id,
                        'inventory_id' => $exchangeInventoryItem->inventory_id,
                        'lot_number' => $exchangeLine['lot_number'] ?? $exchangeInventoryItem->lot_number,
                        'variant' => is_array($exchangeInventoryItem->variant_id)
                            ? json_encode($exchangeInventoryItem->variant_id, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
                            : null,
                        'barcode' => $exchangeLine['barcode'] ?? $exchangeInventoryItem->barcode,
                        'quantity' => $exchangeQty,
                        'unit_price' => $unitPrice,
                        'original_unit_price' => (float) ($exchangeInventoryItem->price ?? 0),
                        'discount' => 0,
                        'discount_amount' => 0,
                        'total' => $lineTotal,
                        'created_by' => Auth::id(),
                    ]);

                    $exchangeInventoryItem->quantity = round((float) $exchangeInventoryItem->quantity - $exchangeQty, 6);
                    $exchangeInventoryItem->save();

                    $exchangeInventory->quantity = round((float) $exchangeInventory->quantity - $exchangeQty, 6);
                    $exchangeInventory->save();

                    $exchangeSubTotal += $lineTotal;
                    $exchangeQtyTotal += $exchangeQty;
                }

                $exchangeInvoice->qty = $exchangeQtyTotal;
                $exchangeInvoice->sub_total = $exchangeSubTotal;
                $exchangeInvoice->total = $exchangeSubTotal;
                $exchangeInvoice->save();

                $exchangeTotal = $exchangeSubTotal;
            }

            $refundAmount = $returnType === 'exchange'
                ? max($returnSubTotal - $exchangeTotal, 0)
                : $returnSubTotal;
            $extraPayable = $returnType === 'exchange'
                ? max($exchangeTotal - $returnSubTotal, 0)
                : 0;

            if ($inputRefundAmount > 0 && abs($inputRefundAmount - $refundAmount) > 0.01) {
                throw new \Exception('Payment mismatch: refund amount does not match return/exchange calculation.');
            }

            $approvalRequired = $policy['manager_approval_threshold'] > 0
                && $refundAmount >= (float) $policy['manager_approval_threshold'];
            if ($approvalRequired && !filter_var($request->input('manager_approved', false), FILTER_VALIDATE_BOOLEAN)) {
                throw new \Exception('Manager approval is required for this return amount.');
            }

            $returnInvoice->qty = $returnQtyTotal;
            $returnInvoice->sub_total = $returnSubTotal;
            $returnInvoice->total = $returnSubTotal;
            $returnInvoice->paid_amount = $refundAmount;
            $returnInvoice->due_amount = 0;
            $returnInvoice->payment_status = 1;
            $returnInvoice->payment_method = $request->input('refund_method');
            $returnInvoice->save();

            if ($exchangeInvoice) {
                $exchangeInvoice->paid_amount = max($exchangeSubTotal - $extraPayable, 0);
                $exchangeInvoice->due_amount = $extraPayable;
                $exchangeInvoice->payment_status = $extraPayable > 0 ? 0 : 1;
                $exchangeInvoice->payment_method = $extraPayable > 0 ? null : 'exchange_adjustment';
                $exchangeInvoice->save();
            }

            $salesReturn = SalesReturn::create([
                'company_id' => $invoice->company_id,
                'branch_id' => optional(Auth::user())->branch_id ?? null,
                'warehouse_id' => $invoice->warehouse_id,
                'original_invoice_id' => $invoice->id,
                'return_invoice_id' => $returnInvoice->id,
                'customer_id' => $invoice->customer_id,
                'cashier_id' => Auth::id(),
                'return_type' => $returnType,
                'status' => $approvalRequired ? 'approved' : 'completed',
                'subtotal_reverse' => $returnSubTotal,
                'tax_reverse' => 0,
                'vat_reverse' => 0,
                'total_reverse' => $returnSubTotal,
                'exchange_total' => $exchangeTotal,
                'refund_amount' => $refundAmount,
                'extra_payable' => $extraPayable,
                'refund_method' => $request->input('refund_method'),
                'approval_required' => $approvalRequired,
                'approved_by' => $approvalRequired ? Auth::id() : null,
                'approved_at' => $approvalRequired ? now() : null,
                'note' => $request->input('note'),
            ]);

            foreach ($salesReturnItemsPayload as $row) {
                SalesReturnItem::create(array_merge($row, [
                    'sales_return_id' => $salesReturn->id,
                ]));
            }

            if ($refundAmount > 0) {
                SalesReturnPayment::create([
                    'sales_return_id' => $salesReturn->id,
                    'payment_method' => $request->input('refund_method', 'cash'),
                    'amount' => $refundAmount,
                    'status' => 'completed',
                    'reference_no' => $request->input('reference_no'),
                    'gateway_txn_id' => $request->input('gateway_txn_id'),
                ]);
            }

            if ($approvalRequired) {
                SalesReturnApproval::create([
                    'sales_return_id' => $salesReturn->id,
                    'requested_by' => Auth::id(),
                    'approved_by' => Auth::id(),
                    'action' => 'approved',
                    'reason' => $request->input('manager_approval_note'),
                    'metadata' => [
                        'threshold' => (float) $policy['manager_approval_threshold'],
                        'refund_amount' => $refundAmount,
                    ],
                ]);
            }

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Return processed successfully',
                'data' => [
                    'sales_return_id' => $salesReturn->id,
                    'sales_return_no' => $salesReturn->return_no,
                    'return_invoice_id' => $returnInvoice->id,
                    'return_invoice_no' => $returnInvoice->invoice_no,
                    'exchange_invoice_id' => $exchangeInvoice?->id,
                    'exchange_invoice_no' => $exchangeInvoice?->invoice_no,
                    'return_total' => $returnSubTotal,
                    'refund_amount' => $refundAmount,
                    'exchange_total' => $exchangeTotal,
                    'extra_payable' => $extraPayable,
                ],
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 0,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    public function dailySellReturnReport(Request $request)
    {
        $from = $request->input('from');
        $to = $request->input('to');

        $query = SalesReturn::query();
        if ($from) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $query->whereDate('created_at', '<=', $to);
        }

        $rows = $query
            ->selectRaw('DATE(created_at) as date, COUNT(*) as returns_count, SUM(total_reverse) as total_reverse, SUM(refund_amount) as refund_amount, SUM(exchange_total) as exchange_total')
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('date', 'desc')
            ->get();

        return response()->json(['status' => 1, 'data' => $rows], 200);
    }

    public function productWiseReturnReport(Request $request)
    {
        $rows = SalesReturnItem::query()
            ->leftJoin('product', 'product.id', '=', 'sales_return_items.product_id')
            ->selectRaw('sales_return_items.product_id, product.name as product_name, SUM(sales_return_items.return_qty) as total_return_qty, SUM(sales_return_items.line_total_reverse) as total_return_amount')
            ->groupBy('sales_return_items.product_id', 'product.name')
            ->orderByDesc('total_return_qty')
            ->get();

        return response()->json(['status' => 1, 'data' => $rows], 200);
    }

    public function customerWiseReturnReport(Request $request)
    {
        $rows = SalesReturn::query()
            ->leftJoin('user', 'user.id', '=', 'sales_returns.customer_id')
            ->selectRaw("sales_returns.customer_id, CONCAT(COALESCE(user.first_name,''), ' ', COALESCE(user.last_name,'')) as customer_name, COUNT(*) as returns_count, SUM(sales_returns.total_reverse) as total_return")
            ->groupBy('sales_returns.customer_id', 'user.first_name', 'user.last_name')
            ->orderByDesc('total_return')
            ->get();

        return response()->json(['status' => 1, 'data' => $rows], 200);
    }

    public function cashierWiseReturnReport(Request $request)
    {
        $rows = SalesReturn::query()
            ->leftJoin('user', 'user.id', '=', 'sales_returns.cashier_id')
            ->selectRaw("sales_returns.cashier_id, CONCAT(COALESCE(user.first_name,''), ' ', COALESCE(user.last_name,'')) as cashier_name, COUNT(*) as returns_count, SUM(sales_returns.total_reverse) as total_return")
            ->groupBy('sales_returns.cashier_id', 'user.first_name', 'user.last_name')
            ->orderByDesc('total_return')
            ->get();

        return response()->json(['status' => 1, 'data' => $rows], 200);
    }

    public function damagedReturnReport(Request $request)
    {
        $rows = SalesReturnItem::query()
            ->leftJoin('product', 'product.id', '=', 'sales_return_items.product_id')
            ->where('sales_return_items.is_damaged', true)
            ->selectRaw('sales_return_items.product_id, product.name as product_name, SUM(sales_return_items.return_qty) as damaged_qty, SUM(sales_return_items.line_total_reverse) as damaged_amount')
            ->groupBy('sales_return_items.product_id', 'product.name')
            ->orderByDesc('damaged_qty')
            ->get();

        return response()->json(['status' => 1, 'data' => $rows], 200);
    }

    public function netSalesAfterReturnReport(Request $request)
    {
        $from = $request->input('from');
        $to = $request->input('to');

        $sales = Invoice::query()->where('type', 'sale');
        $returns = SalesReturn::query();
        if ($from) {
            $sales->whereDate('created_at', '>=', $from);
            $returns->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $sales->whereDate('created_at', '<=', $to);
            $returns->whereDate('created_at', '<=', $to);
        }

        $grossSales = (float) $sales->sum('total');
        $totalReturns = (float) $returns->sum('total_reverse');
        $netSales = $grossSales - $totalReturns;

        return response()->json([
            'status' => 1,
            'data' => [
                'gross_sales' => $grossSales,
                'total_returns' => $totalReturns,
                'net_sales' => $netSales,
            ],
        ], 200);
    }

    public function sellReturnLogs(Request $request)
    {
        if (!Schema::hasTable('sales_returns')) {
            return response()->json([
                'status' => 1,
                'message' => 'Sell return table is not created yet. Please run database migration.',
                'data' => [],
                'meta' => [
                    'current_page' => 1,
                    'last_page' => 1,
                    'per_page' => 20,
                    'total' => 0,
                ],
            ], 200);
        }

        $perPage = max((int) $request->input('perPage', 20), 1);
        $page = max((int) $request->input('page', 1), 1);
        $filterText = trim((string) $request->input('filterText', ''));
        $from = $request->input('from');
        $to = $request->input('to');
        $returnType = $request->input('return_type');
        $refundMethod = $request->input('refund_method');
        $status = $request->input('status');

        $query = SalesReturn::query()
            ->where('sales_returns.company_id', Auth::user()->company_id)
            ->leftJoin('invoices as original_invoice', function ($join) {
                $join->on(
                    DB::raw('original_invoice.id COLLATE utf8mb4_unicode_ci'),
                    '=',
                    DB::raw('sales_returns.original_invoice_id COLLATE utf8mb4_unicode_ci')
                );
            })
            ->leftJoin('invoices as return_invoice', function ($join) {
                $join->on(
                    DB::raw('return_invoice.id COLLATE utf8mb4_unicode_ci'),
                    '=',
                    DB::raw('sales_returns.return_invoice_id COLLATE utf8mb4_unicode_ci')
                );
            })
            ->leftJoin('user as customer', function ($join) {
                $join->on(
                    DB::raw('customer.id COLLATE utf8mb4_unicode_ci'),
                    '=',
                    DB::raw('sales_returns.customer_id COLLATE utf8mb4_unicode_ci')
                );
            })
            ->leftJoin('user as cashier', function ($join) {
                $join->on(
                    DB::raw('cashier.id COLLATE utf8mb4_unicode_ci'),
                    '=',
                    DB::raw('sales_returns.cashier_id COLLATE utf8mb4_unicode_ci')
                );
            })
            ->select([
                'sales_returns.id',
                'sales_returns.return_no',
                'sales_returns.created_at',
                'sales_returns.return_type',
                'sales_returns.status',
                'sales_returns.total_reverse',
                'sales_returns.refund_amount',
                'sales_returns.exchange_total',
                'sales_returns.extra_payable',
                'sales_returns.refund_method',
                'sales_returns.note',
                'sales_returns.original_invoice_id',
                'sales_returns.return_invoice_id',
                'original_invoice.invoice_no as original_invoice_no',
                'return_invoice.invoice_no as return_invoice_no',
                DB::raw("CONCAT(COALESCE(customer.first_name,''), ' ', COALESCE(customer.last_name,'')) as customer_name"),
                'customer.phone as customer_phone',
                DB::raw("CONCAT(COALESCE(cashier.first_name,''), ' ', COALESCE(cashier.last_name,'')) as cashier_name"),
            ]);

        if ($filterText !== '') {
            $query->where(function ($q) use ($filterText) {
                $q->where('sales_returns.return_no', 'like', "%{$filterText}%")
                    ->orWhere('original_invoice.invoice_no', 'like', "%{$filterText}%")
                    ->orWhere('return_invoice.invoice_no', 'like', "%{$filterText}%")
                    ->orWhereRaw("CONCAT(COALESCE(customer.first_name,''), ' ', COALESCE(customer.last_name,'')) LIKE ?", ["%{$filterText}%"])
                    ->orWhereRaw("CONCAT(COALESCE(cashier.first_name,''), ' ', COALESCE(cashier.last_name,'')) LIKE ?", ["%{$filterText}%"]);
            });
        }

        if (!empty($from)) {
            $query->whereDate('sales_returns.created_at', '>=', $from);
        }
        if (!empty($to)) {
            $query->whereDate('sales_returns.created_at', '<=', $to);
        }
        if (!empty($returnType)) {
            $query->where('sales_returns.return_type', $returnType);
        }
        if (!empty($refundMethod)) {
            $query->where('sales_returns.refund_method', $refundMethod);
        }
        if (!empty($status)) {
            $query->where('sales_returns.status', $status);
        }

        $paginator = $query
            ->orderByDesc('sales_returns.created_at')
            ->paginate($perPage, ['*'], 'page', $page);

        $rows = collect($paginator->items());
        $salesReturnIds = $rows->pluck('id')->filter()->values()->all();

        $itemRows = collect();
        if (!empty($salesReturnIds) && Schema::hasTable('sales_return_items')) {
            $itemRows = DB::table('sales_return_items')
                ->leftJoin('product', 'product.id', '=', 'sales_return_items.product_id')
                ->whereIn('sales_return_items.sales_return_id', $salesReturnIds)
                ->whereNull('sales_return_items.deleted_at')
                ->select([
                    'sales_return_items.sales_return_id',
                    'sales_return_items.product_id',
                    'sales_return_items.return_qty',
                    'sales_return_items.unit_price',
                    'sales_return_items.line_total_reverse',
                    'sales_return_items.reason_code',
                    'sales_return_items.restock_type',
                    'sales_return_items.is_damaged',
                    'product.name as product_name',
                ])
                ->orderBy('sales_return_items.created_at')
                ->get();
        }

        $itemsByReturnId = $itemRows->groupBy('sales_return_id');

        return response()->json([
            'status' => 1,
            'message' => 'Sell return logs fetched successfully',
            'data' => $rows->map(function ($row) use ($itemsByReturnId) {
                $returnedItems = ($itemsByReturnId->get($row->id) ?? collect())->map(function ($item) {
                    return [
                        'product_id' => $item->product_id,
                        'product_name' => $item->product_name ?? 'N/A',
                        'return_qty' => (float) $item->return_qty,
                        'unit_price' => (float) $item->unit_price,
                        'line_total_reverse' => (float) $item->line_total_reverse,
                        'reason_code' => $item->reason_code,
                        'restock_type' => $item->restock_type,
                        'is_damaged' => (bool) $item->is_damaged,
                    ];
                })->values();

                return [
                    'id' => $row->id,
                    'return_no' => $row->return_no,
                    'date' => $row->created_at ? date('Y-m-d H:i:s', strtotime($row->created_at)) : null,
                    'return_type' => $row->return_type,
                    'status' => $row->status,
                    'original_invoice_id' => $row->original_invoice_id,
                    'original_invoice_no' => $row->original_invoice_no,
                    'return_invoice_id' => $row->return_invoice_id,
                    'return_invoice_no' => $row->return_invoice_no,
                    'customer_name' => trim((string) $row->customer_name) ?: 'Walk-in Customer',
                    'customer_phone' => $row->customer_phone,
                    'cashier_name' => trim((string) $row->cashier_name) ?: 'N/A',
                    'total_reverse' => (float) $row->total_reverse,
                    'refund_amount' => (float) $row->refund_amount,
                    'exchange_total' => (float) $row->exchange_total,
                    'extra_payable' => (float) $row->extra_payable,
                    'refund_method' => $row->refund_method,
                    'note' => $row->note,
                    'returned_items' => $returnedItems,
                    'returned_items_count' => $returnedItems->count(),
                ];
            })->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ], 200);
    }

    public function approveSalesReturn(Request $request, string $salesReturnId)
    {
        $validator = Validator::make($request->all(), [
            'action' => 'required|in:approved,rejected',
            'reason' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'message' => collect($validator->errors()->all())->first() ?? 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $salesReturn = SalesReturn::findOrFail($salesReturnId);
        $action = $request->input('action');

        $salesReturn->status = $action === 'approved' ? 'approved' : 'rejected';
        $salesReturn->approved_by = Auth::id();
        $salesReturn->approved_at = now();
        $salesReturn->save();

        SalesReturnApproval::create([
            'sales_return_id' => $salesReturn->id,
            'requested_by' => $salesReturn->cashier_id,
            'approved_by' => Auth::id(),
            'action' => $action,
            'reason' => $request->input('reason'),
            'metadata' => [
                'status_before' => $salesReturn->getOriginal('status'),
                'status_after' => $salesReturn->status,
            ],
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Sales return ' . $action . ' successfully',
        ], 200);
    }


    public function delete(Request $request, $id = null)
    {
        $allowInvoiceDelete = PermissionUtils::isFeatureAccessible(
            Auth::user()?->company_id,
            FeaturePreference::ALLOW_INVOICE_DELETE->value
        );

        if (!$allowInvoiceDelete) {
            return response()->json([
                'status' => 0,
                'message' => 'Invoice delete is not allowed for this company.',
            ], 403);
        }

        if (!Helper::hasRight('invoice.delete')) {
            return response()->json([
                'status' => 0,
                'message' => 'You do not have permission to delete invoices.',
            ], 403);
        }

        DB::beginTransaction();

        try {
            // Handle single or bulk deletion
            $ids = $id ? [$id] : $request->input('ids', []);

            // Validate input
            if (empty($ids)) {
                throw new \Exception('No Invoice IDs provided');
            }

            $request->validate([
                'ids' => 'sometimes|required|array',
                'ids.*' => 'exists:invoices,id',
            ]);

            $autoDeleteEmptyPurchaseInvoice = PermissionUtils::isFeatureAccessible(
                Auth::user()?->company_id,
                FeaturePreference::AUTO_DELETE_EMPTY_PURCHASE_INVOICE->value
            );

            $failedIds = [];
            foreach ($ids as $invoiceId) {
                $invoice = Invoice::find($invoiceId);

                if (!$invoice) {
                    $failedIds[] = $invoiceId;
                    continue;
                }

                // Handle inventory based on invoice type
                if ($invoice->type == 'purchase') {
                    $items = $invoice->items; // or $invoice->items() if it's a method

                    Log::info('Starting inventory deduction for purchase invoice', [
                        'invoice_id' => $invoice->id,
                        'item_count' => $items->count(),
                    ]);

                    foreach ($items as $item) {
                        Log::info('Processing invoice item', [
                            'invoice_item_id'   => $item->id,
                            'inventory_id'      => $item->inventory_id,
                            'deducted_qty'      => $item->qty,
                        ]);

                        // Find the main inventory record
                        $inventory = Inventory::find($item->inventory_id);

                        if (!$inventory) {
                            Log::warning('Inventory record not found – skipping', ['inventory_id' => $item->inventory_id]);
                            continue;
                        }

                        // Find the specific inventory item linked to this invoice line
                        $inventoryItem = InventoryItem::where('invoice_item_id', $item->id)->first();

                        if (!$inventoryItem) {
                            Log::warning('InventoryItem not found – skipping', ['invoice_item_id' => $item->id]);
                            continue;
                        }

                        // Deduct quantity from the linked InventoryItem
                        $inventoryItem->quantity -= $item->qty;

                        // Deduct from main Inventory stock
                        $inventory->quantity -= $item->qty;

                        // Save both (in case quantity > 0)
                        $inventoryItem->save();
                        $inventory->save();

                        Log::info('Quantity deducted', [
                            'inventory_id'            => $inventory->id,
                            'new_inventory_qty'       => $inventory->quantity,
                            'inventory_item_id'       => $inventoryItem->id,
                            'new_inventory_item_qty'  => $inventoryItem->quantity,
                        ]);

                        // === DELETE IF QUANTITY IS ZERO OR NEGATIVE ===

                        // Delete InventoryItem if quantity ≤ 0
                        if ($inventoryItem->quantity <= 0) {
                            $inventoryItem->is_deleted = true;
                            $inventoryItem->saveQuietly();
                            $inventoryItem->delete();
                            Log::info('InventoryItem deleted because quantity ≤ 0', [
                                'inventory_item_id' => $inventoryItem->id,
                                'final_quantity'    => $inventoryItem->quantity,
                            ]);
                        }

                        // Delete main Inventory record if total quantity ≤ 0
                        // (Only if no other InventoryItem records exist for this inventory, optional safety)
                        if ($inventory->quantity <= 0) {
                            // Optional: check if there are still active InventoryItem records
                            $remainingItems = InventoryItem::where('inventory_id', $inventory->id)->count();

                            if ($remainingItems == 0) {
                                $inventory->is_deleted = true;
                                $inventory->saveQuietly();
                                $inventory->delete();
                                Log::info('Main inventory record deleted – no stock left', [
                                    'inventory_id'    => $inventory->id,
                                    'final_quantity' => $inventory->quantity,
                                ]);
                            } else {
                                Log::info('Inventory quantity ≤ 0 but other InventoryItems exist – keeping record', [
                                    'inventory_id' => $inventory->id,
                                ]);
                            }
                        }
                    }

                    Log::info('Finished processing purchase invoice', ['invoice_id' => $invoice->id]);
                } elseif ($invoice->type === 'sale') {
                    $affectedPurchaseInvoiceIds = [];

                    foreach ($invoice->invoiceHistory as $saleItem) {
                        // 1. Restore stock in InventoryItem
                        $inventoryItem = InventoryItem::find($saleItem->inventory_item_id);

                        // if ($inventoryItem) {
                        //     $inventoryItem->quantity += $saleItem->quantity;
                        //     $inventoryItem->save();

                        //     // Also update main inventory table
                        //     $inventory = Inventory::find($inventoryItem->inventory_id);
                        //     if ($inventory) {
                        //         $inventory->quantity += $saleItem->quantity;
                        //         $inventory->save();
                        //     }
                        // }

                        // 2. Reverse the original PURCHASE invoice item
                        $purchaseInvoiceItem = InvoiceItem::find($inventoryItem->invoice_item_id ?? $saleItem->original_invoice_item_id);

                        if ($purchaseInvoiceItem) {
                            $soldQty = $saleItem->quantity;

                            // Use update() to bypass mass assignment + force DB write
                            InvoiceItem::where('id', $purchaseInvoiceItem->id)->update([
                                'qty'   => DB::raw("qty - {$soldQty}"),
                                'total' => DB::raw("total - ({$soldQty} * unit_price)"),
                            ]);

                            // Reload to confirm
                            $purchaseInvoiceItem->refresh();
                            Log::info("Reversed Purchase Item ID {$purchaseInvoiceItem->id}: qty = {$purchaseInvoiceItem->qty}, total = {$purchaseInvoiceItem->total}");

                            $affectedPurchaseInvoiceIds[$purchaseInvoiceItem->invoice_id] = true;
                        }
                    }

                    // 3. Update Purchase Invoice Totals and optionally delete empty purchase invoices
                    foreach (array_keys($affectedPurchaseInvoiceIds) as $purchaseInvoiceId) {
                        $purchaseInvoice = Invoice::find($purchaseInvoiceId);
                        if (!$purchaseInvoice || $purchaseInvoice->type !== 'purchase') {
                            continue;
                        }

                        $newQty   = $purchaseInvoice->items()->sum('qty');
                        $newTotal = $purchaseInvoice->items()->sum('total');

                        $purchaseInvoice->update([
                            'qty' => $newQty,
                            'total' => $newTotal,
                            'sub_total' => $newTotal + ($purchaseInvoice->vat ?? 0) - ($purchaseInvoice->discount ?? 0),
                        ]);

                        Log::info("Updated Purchase Invoice {$purchaseInvoice->invoice_no}: qty={$newQty}, total={$newTotal}");

                        if (!$autoDeleteEmptyPurchaseInvoice) {
                            continue;
                        }

                        $hasPositiveItems = $purchaseInvoice->items()->where('qty', '>', 0)->exists();
                        if ($hasPositiveItems) {
                            continue;
                        }

                        $purchaseInvoice->items()->update(['is_deleted' => true]);
                        $purchaseInvoice->items()->delete();
                        $purchaseInvoice->invoiceHistory()->update(['is_deleted' => true]);
                        $purchaseInvoice->invoiceHistory()->delete();
                        $purchaseInvoice->transactions()->update(['is_deleted' => true]);
                        $purchaseInvoice->transactions()->delete();
                        $purchaseInvoice->paymentSchedules()->update(['is_deleted' => true]);
                        $purchaseInvoice->paymentSchedules()->delete();
                        $purchaseInvoice->is_deleted = true;
                        $purchaseInvoice->saveQuietly();
                        $purchaseInvoice->delete();

                        Log::info('Auto deleted purchase invoice because all item quantities are <= 0', [
                            'purchase_invoice_id' => $purchaseInvoiceId,
                        ]);
                    }
                }

                // Delete associated items
                $invoice->items()->update(['is_deleted' => true]);
                $invoice->items()->delete();
                // // Delete invoice history
                $invoice->invoiceHistory()->update(['is_deleted' => true]);
                $invoice->invoiceHistory()->delete();
                $invoice->transactions()->update(['is_deleted' => true]);
                $invoice->transactions()->delete();
                $invoice->paymentSchedules()->update(['is_deleted' => true]);
                $invoice->paymentSchedules()->delete();
                // // Delete the invoice
                $invoice->is_deleted = true;
                $invoice->saveQuietly();
                $invoice->delete();
            }

            if (!empty($failedIds)) {
                throw new \Exception('Failed to delete Invoices with IDs: ' . implode(', ', $failedIds));
            }

            DB::commit();

            return response()->json(
                [
                    'status' => 1,
                    'message' => 'Invoice(s) deleted successfully',
                ],
                200
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Failed to delete Invoice(s)',
                    'error' => $e->getMessage(),
                    'failed_ids' => $failedIds ?? [],
                    'line' => $e->getLine(),
                    'file' => $e->getFile(),
                ],
                500
            );
        }
    }

    public function destroyMultiple(Request $request)
    {
        return $this->delete($request);
    }

    public function verifyCouponOrGiftCard(Request $request)
    {
        // Correcting the validation to match the request field name
        $validator = Validator::make($request->all(), [
            'coupon_code' => 'required|string|exists:discount_setup,code',
        ]);

        if ($validator->fails()) {
            return response()->json(
                [
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ],
                422
            );
        }

        try {
            $code = $request->coupon_code;

            // 1. First, check for a valid Coupon (type 'coupon') in DiscountSetup
            $coupon = DiscountSetup::where('code', $code)
                ->where('is_active', true) // Using 'is_active' based on your payload
                ->where('type', 'coupon')
                ->where('form_date', '<=', now()) // Using 'form_date'
                ->where('to_date', '>=', now()) // Using 'to_date'
                ->first();

            if ($coupon) {
                return response()->json([
                    'status' => 1,
                    'message' => 'Valid coupon found',
                    'data' => [
                        'type' => $coupon->discount_type,
                        'discount_amount' => $coupon->amount,
                    ],
                ]);
            }

            // 2. If no coupon found, check for a valid Gift Card (type 'reward_card')
            $giftCard = RewordCard::where('card_number', $code)
                ->where('is_redeemed', false)
                ->whereHas('setup', function ($query) { // Correct use of whereHas
                    $query->where('is_active', true)
                        ->where('type', 'reward_card')
                        ->where('form_date', '<=', now())
                        ->where('to_date', '>=', now());
                })
                ->first();

            if ($giftCard) {
                return response()->json([
                    'status' => 1,
                    'message' => 'Valid gift card found',
                    'data' => [
                        'type' => $giftCard->setup->discount_type,
                        'discount_amount' => $giftCard->setup->amount,
                    ],
                ]);
            }

            // 3. If neither is found, return an error
            return response()->json([
                'status' => 0, 
                'errors' => ['Invalid or expired code'], 
                'message' => 'Invalid or expired code'
            ], 422);
        } catch (\Exception $e) {
            // Log the exception for debugging
            \Log::error('Error verifying coupon/gift card: ' . $e->getMessage());

            return response()->json([
                'status' => 0,
                'message' => 'An internal server error occurred. Please try again later.'
            ], 500);
        }
    }

    /**
     * Download invoice PDF
     */
    public function download($id)
    {
        try {
            set_time_limit(3000);
            $authenticatedUser = Auth::guard('api')->user() ?? Auth::user();
            $hasSignedAccess = request()->hasValidSignature();

            if (!$authenticatedUser && !$hasSignedAccess) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Unauthorized invoice download request'
                ], 401);
            }

            // Find invoice
            $invoice = Invoice::with(['items.product', 'customer', 'supplier'])->find($id);
            
            if (!$invoice) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Invoice not found'
                ], 404);
            }

            if (!$hasSignedAccess && $authenticatedUser) {
                $invoiceCompanyId = (string) ($invoice->company_id ?? '');
                $userCompanyId = (string) ($authenticatedUser->company_id ?? '');

                if (
                    !$authenticatedUser->isSuperAdmin()
                    && ($invoiceCompanyId === '' || $invoiceCompanyId !== $userCompanyId)
                ) {
                    return response()->json([
                        'status' => 0,
                        'message' => 'You are not allowed to download this invoice'
                    ], 403);
                }
            }

            // Get company info
            $companyInfo = [
                'name' => Helper::getSettings('application_name') ?? 'Your Business',
                'email' => Helper::getSettings('application_email') ?? 'contact@yourbusiness.com',
                'phone' => Helper::getSettings('application_phone') ?? 'N/A',
                'address' => Helper::getSettings('application_address') ?? 'N/A',
                'logo' => Helper::getSettings('site_logo') ?? '',
                'vat' => Helper::getSettings('vat_number') ?? '',
            ];

            // Generate barcode HTML
            $barcodeHtml = \DNS1D::getBarcodeHTML($invoice->invoice_no, 'C39', 2, 50);

            $documentType = $invoice->type === 'quotation' ? 'quotation' : 'invoice';

            // Generate PDF using DomPDF
            $pdf = PDF::loadView('pdf.invoice', [
                'invoice' => $invoice,
                'companyInfo' => $companyInfo,
                'customerName' => $invoice->customer ? $invoice->customer->first_name . ' ' . $invoice->customer->last_name : ($invoice->supplier ? $invoice->supplier->name : 'Valued Customer'),
                'barcodeHtml' => $barcodeHtml,
            ]);

            // Download PDF
            return $pdf->download($documentType . '-' . $invoice->invoice_no . '.pdf');

        } catch (\Exception $e) {
            \Log::error('Error downloading invoice: ' . $e->getMessage());

            return response()->json([
                'status' => 0,
                'message' => 'Failed to download invoice. Please try again later.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Send invoice via email
     */
    public function sendEmail(Request $request, $id)
    {
        try {
            // Validate request
            $validator = Validator::make($request->all(), [
                'email' => 'required|email',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $invoice = Invoice::query()->find($id);

            if (!$invoice) {
                return response()->json([
                    'status' => 0,
                    'message' => 'Invoice not found'
                ], 404);
            }

            SendInvoiceEmail::dispatch($invoice, (string) $request->email);

            return response()->json([
                'status' => 1,
                'message' => $invoice->type === 'quotation'
                    ? 'Quotation email has been queued'
                    : 'Invoice email has been queued'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error sending invoice email: ' . $e->getMessage());

            return response()->json([
                'status' => 0,
                'message' => 'Failed to send email. Please try again later.',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
