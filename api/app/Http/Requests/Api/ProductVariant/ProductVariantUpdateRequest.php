<?php

namespace App\Http\Requests\Api\ProductVariant;

use App\Models\ProductVariant;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class ProductVariantUpdateRequest extends ProductVariantStoreRequest
{
    public function rules(): array
    {
        $id = $this->route('id');
        $variant = ProductVariant::findOrFail($id);

        return [
            'name' => [
                'sometimes',
                'required',
                'string',
                Rule::unique('product_variants', 'name')->where(function ($query) use ($variant) {
                    return $query->where('company_id', Auth::user()->company_id)
                        ->where('id', '!=', $variant->id);
                }),
            ],
            'status' => 'sometimes|required|in:0,1',
            'attributes' => 'sometimes|array',
            'attributes.*' => 'sometimes|required|string',
        ];
    }
}
