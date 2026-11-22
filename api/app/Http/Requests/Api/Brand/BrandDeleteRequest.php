<?php

namespace App\Http\Requests\Api\Brand;

class BrandDeleteRequest extends BrandListRequest
{
    public function rules(): array
    {
        return [
            'ids' => 'sometimes|required|array',
            'ids.*' => 'exists:brand,id',
        ];
    }
}
