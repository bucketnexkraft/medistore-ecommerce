<?php

namespace App\Http\Requests\Api\Category;

class CategoryDeleteRequest extends CategoryListRequest
{
    public function rules(): array
    {
        return [
            'ids' => 'sometimes|required|array',
            'ids.*' => 'exists:categories,id',
        ];
    }
}
