<?php

namespace App\Http\Requests\Api\ProductVariant;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class ProductVariantUpdateStatusRequest extends ProductVariantListRequest
{
    public function rules(): array
    {
        return [
            'ids' => 'required|array',
            'ids.*' => 'required|exists:product_variants,id',
            'status' => 'required|in:0,1',
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'status' => 0,
            'errors' => $validator->messages()->all(),
        ], 422));
    }
}
