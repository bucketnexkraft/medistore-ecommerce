<?php

namespace App\Http\Requests\Api\ProductVariant;

class ProductVariantDeleteRequest extends ProductVariantListRequest
{
    public function rules(): array
    {
        return [
            'ids' => 'sometimes|required|array',
            'ids.*' => 'exists:product_variants,id',
        ];
    }
}
