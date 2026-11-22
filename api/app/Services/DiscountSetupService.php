<?php
namespace App\Services;

use App\Data\FeaturePreference;
use App\Models\DiscountSetup;
use App\Models\Product;
use App\Models\RewordCard;
use App\Utils\PermissionUtils;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class DiscountSetupService
{
    private function canAccessWarehouseDiscountField(): bool
    {
        $companyId = Auth::user()?->company_id;

        return PermissionUtils::isFeatureAccessible($companyId, FeaturePreference::WAREHOUSE_BASE_DISCOUNT->value);
    }

    private function normalizeIdList(mixed $value): array
    {
        if ($value instanceof \Illuminate\Support\Collection) {
            $value = $value->all();
        }

        if (is_string($value)) {
            $decoded = json_decode($value, true);

            if (json_last_error() === JSON_ERROR_NONE) {
                $value = $decoded;
            } else {
                $value = array_filter(array_map('trim', explode(',', $value)));
            }
        }

        if (!is_array($value)) {
            return [];
        }

        return array_values(array_filter(array_map(function ($item) {
            if (is_array($item)) {
                return $item['value'] ?? $item['id'] ?? null;
            }

            return $item;
        }, $value), fn ($item) => $item !== null && $item !== ''));
    }

    /**
     * Validation rules for creating/updating DiscountSetup
     */
    protected function validationRules(Request $request): array
    {
        $rules = [
            'name' => 'required|string|max:255',
            'type' => 'required|in:discount,coupon,reward_card',
            'dateRange' => 'required|array|size:2',
            'dateRange.*' => 'date',
            'amount' => 'required|numeric|min:0.01',
            'discount_type' => 'required|string|in:fixed,percent',
            'brand_ids' => 'nullable|array',
            'brand_ids.*' => 'exists:brand,id', // better validation
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'exists:categories,id',
            'product_ids' => 'nullable|array',
            'product_ids.*' => 'exists:product,id',
            'warehouse_ids' => 'nullable|array',
            'warehouse_ids.*' => 'exists:warehouses,id',
            'vat_applicable' => 'boolean',
            'vat_calculate_for' => 'nullable|in:before_discount,after_discount',
            'is_active' => 'required|boolean',
        ];

        // Conditional rules
        if ($request->input('type') === 'coupon') {
            $rules['code'] = 'required|string|unique:discount_setup,code,' . ($request->route('id') ?? 'NULL');
        }

        if ($request->input('type') === 'reward_card') {
            $rules['number_of_cards'] = 'required|integer|min:1';
            $rules['prefix'] = 'nullable|string';
        }

        if ($request->filled('vat_applicable') && $request->vat_applicable) {
            $rules['vat_calculate_for'] = 'required|in:before_discount,after_discount';
        }

        return $rules;
    }

    /**
     * List DiscountSetups with filtering and pagination
     */
    public function list(Request $request): array
    {
        $query = DiscountSetup::query();

        // Apply search filter (discount fields + products JSON field)
        if ($request->filled('search')) {
            $search = trim((string) $request->search);

            $productIds = Product::where('name', 'like', "%{$search}%")
                ->pluck('id')
                ->toArray();

            $query->where(function ($q) use ($search, $productIds) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('type', 'like', "%{$search}%");

                foreach ($productIds as $id) {
                    $q->orWhereJsonContains('products', (string) $id);
                }
            });
        }

        // Apply date range filter
        if ($request->filled('dateRange')) {
            $dateRange = explode(' to ', $request->dateRange);
            if (count($dateRange) === 2) {
                $startDate = $dateRange[0];
                $endDate   = $dateRange[1];

                $query->whereDate('form_date', '>=', $startDate)
                    ->whereDate('to_date', '<=', $endDate);
            }
        }

        // Apply discount type filter
        if ($request->filled('discountType')) {
            $query->where('discount_type', $request->discountType);
        }

        // Pagination
        $perPage = $request->input('per_page', 20); 
        $page    = $request->input('page', 1);

        $discountSetups = $query->paginate($perPage, ['*'], 'page', $page);

        // Format response with related data (brands, categories, products)
        $canAccessWarehouseField = $this->canAccessWarehouseDiscountField();

        $data = $discountSetups->map(function ($discount) use ($canAccessWarehouseField) {
            return [
                'id'             => $discount->id,
                'name'           => $discount->name,
                'code'           => $discount->code,
                'type'           => $discount->type,
                'form_date'      => $discount->form_date,
                'to_date'        => $discount->to_date,
                'amount'         => $discount->amount,
                'discount_type'  => $discount->discount_type,
                'vat_applicable' => $discount->vat_applicable,
                'vat_calculate_for' => $discount->vat_calculate_for,
                'brands'         => $discount->brandList(),     // resolved brand list
                'categories'     => $discount->categoryList(),  // resolved category list
                'products'       => $discount->productList(),   // resolved product list
                'warehouses'     => $canAccessWarehouseField ? $discount->warehouseList() : [], // resolved warehouse list
                'is_active'      => $discount->is_active,
                'reword_cards'   => $discount->rewordCards()->get(), // related reward cards
            ];
        });

        return [
            'status' => 1,
            'data'   => $data,
            'meta'   => [
                'current_page' => $discountSetups->currentPage(),
                'last_page'    => $discountSetups->lastPage(),
                'per_page'     => $discountSetups->perPage(),
                'total'        => $discountSetups->total(),
            ],
        ];
    }


    /**
     * Store a new DiscountSetup
     */
    public function store(Request $request): array
    {
        // Capture all incoming request data
        $allData = $request->all();

        // Re-map the 'dateRange' from the frontend to 'form_date' and 'to_date'
        // for validation and storage.
        if (isset($allData['dateRange']) && is_array($allData['dateRange']) && count($allData['dateRange']) === 2) {
            // Correctly parse the ISO 8601 date strings
            $allData['form_date'] = date('Y-m-d', strtotime($allData['dateRange'][0]));
            $allData['to_date']   = date('Y-m-d', strtotime($allData['dateRange'][1]));
        }

        // Now, run the validation using the re-mapped data
        $validator = Validator::make($allData, $this->validationRules($request));

        if ($validator->fails()) {
            return [
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ];
        }

        $data = $allData;

        if (!$this->canAccessWarehouseDiscountField() && !empty($data['warehouse_ids'])) {
            return [
                'status' => 0,
                'errors' => ['Warehouse-based discount is not enabled for your company.'],
            ];
        }

        // Map the payload field names to database column names
        $data['brands']     = $this->normalizeIdList($data['brand_ids'] ?? $data['brands'] ?? []);
        $data['categories'] = $this->normalizeIdList($data['category_ids'] ?? $data['categories'] ?? []);
        $data['products']   = $this->normalizeIdList($data['product_ids'] ?? $data['products'] ?? []);
        $data['warehouses'] = $this->normalizeIdList($data['warehouse_ids'] ?? $data['warehouses'] ?? []);
        $data['no_of_cards'] = isset($data['number_of_cards']) 
            ? (int) $data['number_of_cards'] 
            : null;

        unset(
            $data['brand_ids'],
            $data['category_ids'],
            $data['product_ids'],
            $data['warehouse_ids'],
            $data['dateRange']
        );

        if (!Schema::hasColumn('discount_setup', 'warehouses')) {
            unset($data['warehouses']);
        }

        try {
            $discountSetup = new DiscountSetup();
            $discountSetup->fill($data);
            $discountSetup->save();

            if ($discountSetup->type === 'reward_card') {
                $numberOfCards = $request->input('number_of_cards', 1);
                $prefix = $request->input('prefix', 'REWARD-');

                for ($i = 0; $i < $numberOfCards; $i++) {
                    RewordCard::create([
                        'setup_id'    => $discountSetup->id,
                        'card_number' => $prefix . uniqid(),
                        'is_redeemed' => false,
                    ]);
                }
            }
            return [
                'status' => 1,
                'data'   => $discountSetup,
            ];
        } catch (\Exception $e) {
            return [
                'status' => 0,
                'errors' => [$e->getMessage()],
            ];
        }
    }

    /**
     * Get a single Discount Setup by ID
     */
    public function getSingleSetup($id)
    {
        $discountSetup = DiscountSetup::findOrFail($id);
        return [
            'status' => 1,
            'data' => $discountSetup,
        ];
    }

    /**
     * Update existing DiscountSetup by ID
     */
    public function update(Request $request, $id): array
    {
        $discountSetup = DiscountSetup::findOrFail($id);
        
        // Capture all incoming request data
        $allData = $request->all();

        // Re-map the 'dateRange' from the frontend to 'form_date' and 'to_date'
        // for validation and storage.
        if (isset($allData['dateRange']) && is_array($allData['dateRange']) && count($allData['dateRange']) === 2) {
            // Correctly parse the ISO 8601 date strings
            $allData['form_date'] = date('Y-m-d', strtotime($allData['dateRange'][0]));
            $allData['to_date']   = date('Y-m-d', strtotime($allData['dateRange'][1]));
        }

        // Now, run the validation using the re-mapped data
        $validator = Validator::make($allData, $this->validationRules($request));

        if ($validator->fails()) {
            return [
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ];
        }

        $data = $allData;

        if (!$this->canAccessWarehouseDiscountField() && !empty($data['warehouse_ids'])) {
            return [
                'status' => 0,
                'errors' => ['Warehouse-based discount is not enabled for your company.'],
            ];
        }

        // Map the payload field names to database column names
        $data['brands']     = $this->normalizeIdList($data['brand_ids'] ?? $data['brands'] ?? []);
        $data['categories'] = $this->normalizeIdList($data['category_ids'] ?? $data['categories'] ?? []);
        $data['products']   = $this->normalizeIdList($data['product_ids'] ?? $data['products'] ?? []);
        $data['warehouses'] = $this->normalizeIdList($data['warehouse_ids'] ?? $data['warehouses'] ?? []);
        $data['no_of_cards'] = isset($data['number_of_cards']) 
            ? (int) $data['number_of_cards'] 
            : null;

        unset(
            $data['brand_ids'],
            $data['category_ids'],
            $data['product_ids'],
            $data['warehouse_ids'],
            $data['dateRange']
        );

        if (!Schema::hasColumn('discount_setup', 'warehouses')) {
            unset($data['warehouses']);
        }

        try {
            $discountSetup->fill($data);
            $discountSetup->save();

            if ($discountSetup->type === 'reward_card') {
                $discountSetup->rewordCards()->delete(); // Delete existing cards if any

                $numberOfCards = $request->input('number_of_cards', 1);
                $prefix = $request->input('prefix', 'REWARD-');

                for ($i = 0; $i < $numberOfCards; $i++) {
                    RewordCard::create([
                        'setup_id'    => $discountSetup->id,
                        'card_number' => $prefix . uniqid(),
                        'is_redeemed' => false,
                    ]);
                }
            }
            return [
                'status' => 1,
                'data'   => $discountSetup,
            ];
        } catch (\Exception $e) {
            return [
                'status' => 0,
                'errors' => [$e->getMessage()],
            ];
        }
    }

    /**
     * Delete a DiscountSetup by ID
     */
    public function delete($id): array
    {
        $ids = is_array($id) ? $id : explode(',', (string) $id);
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids), fn ($value) => $value > 0)));

        if (empty($ids)) {
            return [
                'status' => 0,
                'message' => 'No valid discount setup id provided',
            ];
        }

        $deleted = DiscountSetup::whereIn('id', $ids)->delete();

        if ($deleted === 0) {
            return [
                'status' => 0,
                'message' => 'No discount setup matched the provided id(s)',
            ];
        }

        return [
            'status' => 1,
            'message' => $deleted > 1
                ? 'Discount setups deleted successfully'
                : 'Discount setup deleted successfully',
        ];
    }

    /**
     * Update status (is_active) for a single DiscountSetup
     */
    public function updateStatus(Request $request, $id): array
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return [
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ];
        }

        $discountSetup = DiscountSetup::findOrFail($id);
        $discountSetup->is_active = $request->input('status');
        $discountSetup->save();

        return [
            'status' => 1,
            'message' => 'Status updated successfully',
        ];
    }

    /**
     * Update status (is_active) for multiple DiscountSetups
     */
    public function updateStatusMultiple(Request $request): array
    {
        $validator = Validator::make($request->all(), [
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:discount_setup,id',
            'status' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return [
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ];
        }

        $ids = $request->input('ids');
        $isActive = $request->input('status');

        DiscountSetup::whereIn('id', $ids)->update(['is_active' => $isActive]);

        return [
            'status' => 1,
            'message' => 'Status updated successfully for selected discount setups',
        ];
    }
}
