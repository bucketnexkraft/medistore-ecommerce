<?php

namespace App\Http\Requests\Api\Category;

class CategoryUpdateStatusRequest extends CategoryListRequest
{
    public function rules(): array
    {
        return [
            'status' => 'required|in:0,1',
        ];
    }
}
