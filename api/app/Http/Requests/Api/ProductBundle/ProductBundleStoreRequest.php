<?php

namespace App\Http\Requests\Api\ProductBundle;

use App\Models\Product;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class ProductBundleStoreRequest extends ProductBundleIndexRequest
{
    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:191',
                Rule::unique('product_bundles', 'name')->where(function ($query) {
                    return $query->where('company_id', Auth::user()->company_id);
                }),
            ],
            'discount_type' => 'required|in:percentage,fixed',
            'discount_value' => 'required|numeric|min:0',
            'bundle_qty' => 'nullable|numeric|min:0.01',
            'deduction_mode' => 'nullable|in:strict,relaxed',
            'is_active' => 'nullable|boolean',
            'products' => 'required|array|min:1',
            'products.*.product_id' => 'required|string',
            'products.*.quantity' => 'required|numeric|min:0.01',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $products = (array) $this->input('products', []);
            $companyId = Auth::user()->company_id;
            $productIds = collect($products)->pluck('product_id')->filter()->unique()->values();

            if ($productIds->isEmpty()) {
                $validator->errors()->add('products', 'At least one valid product is required.');
                return;
            }

            $existingIds = Product::query()
                ->where('company_id', $companyId)
                ->whereIn('id', $productIds)
                ->pluck('id');

            $missingIds = $productIds->diff($existingIds);
            foreach ($missingIds as $missingId) {
                $validator->errors()->add('products', "Selected product [{$missingId}] is invalid.");
            }

            $stockMap = Product::query()
                ->where('company_id', $companyId)
                ->whereIn('id', $productIds)
                ->with(['inventory_items' => function ($query) {
                    $query->select('id', 'product_id', 'quantity');
                }])
                ->get()
                ->mapWithKeys(function ($product) {
                    return [
                        $product->id => (int) $product->inventory_items
                            ->where('quantity', '>', 0)
                            ->sum('quantity'),
                    ];
                });

            foreach ($products as $index => $item) {
                $productId = $item['product_id'] ?? null;
                $quantity = isset($item['quantity']) ? (float) $item['quantity'] : 0;

                if (!$productId || !$stockMap->has($productId)) {
                    continue;
                }

                $availableStock = (float) $stockMap[$productId];

                if ($quantity > $availableStock) {
                    $validator->errors()->add(
                        "products.{$index}.quantity",
                        "Bundle quantity for selected product cannot exceed available stock ({$availableStock})."
                    );
                }
            }
        });
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'status' => 0,
            'errors' => $validator->messages()->all(),
        ], 422));
    }
}
