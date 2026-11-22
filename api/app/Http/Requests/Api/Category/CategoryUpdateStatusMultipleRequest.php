<?php

namespace App\Http\Requests\Api\Category;

class CategoryUpdateStatusMultipleRequest extends CategoryListRequest
{
    public function rules(): array
    {
        return [
            'ids' => 'required|array',
            'ids.*' => 'exists:categories,id',
            'status' => 'required|in:0,1',
        ];
    }
}
