<?php

namespace App\Http\Requests\Api\ProductBundle;

use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class ProductBundleUpdateRequest extends ProductBundleStoreRequest
{
    public function rules(): array
    {
        $bundleId = (int) $this->route('id');

        return [
            'name' => [
                'required',
                'string',
                'max:191',
                Rule::unique('product_bundles', 'name')
                    ->ignore($bundleId)
                    ->where(function ($query) {
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
}
