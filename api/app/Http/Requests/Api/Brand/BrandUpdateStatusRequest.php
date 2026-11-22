<?php

namespace App\Http\Requests\Api\Brand;

class BrandUpdateStatusRequest extends BrandListRequest
{
    public function rules(): array
    {
        return [
            'status' => 'required|in:0,1',
        ];
    }
}
