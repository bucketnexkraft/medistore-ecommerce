<?php

namespace App\Http\Requests\Api\DiscountSetup;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

class DiscountSetupStoreRequest extends DiscountSetupListRequest
{
    public function rules(): array
    {
        $rules = [
            'name' => 'required|string|max:255',
            'type' => 'required|in:discount,coupon,reward_card',
            'dateRange' => 'required|array|size:2',
            'dateRange.*' => 'date',
            'amount' => 'required|numeric|min:0.01',
            'discount_type' => 'required|string|in:fixed,percent',
            'brand_ids' => 'nullable|array',
            'brand_ids.*' => 'exists:brand,id',
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

        if ($this->input('type') === 'coupon') {
            $rules['code'] = [
                'required',
                'string',
                Rule::unique('discount_setup', 'code')->ignore($this->route('id')),
            ];
        }

        if ($this->input('type') === 'reward_card') {
            $rules['number_of_cards'] = 'required|integer|min:1';
            $rules['prefix'] = 'nullable|string';
        }

        if ($this->filled('vat_applicable') && $this->boolean('vat_applicable')) {
            $rules['vat_calculate_for'] = 'required|in:before_discount,after_discount';
        }

        return $rules;
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'status' => 0,
            'message' => 'Unable to create the discount setup',
            'errors' => $validator->messages()->all(),
        ], 422));
    }
}
