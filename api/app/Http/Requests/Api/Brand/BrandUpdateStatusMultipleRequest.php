<?php

namespace App\Http\Requests\Api\Brand;

class BrandUpdateStatusMultipleRequest extends BrandListRequest
{
    public function rules(): array
    {
        return [
            'ids' => 'required|array',
            'ids.*' => 'exists:brand,id',
            'status' => 'required|in:0,1',
        ];
    }
}
