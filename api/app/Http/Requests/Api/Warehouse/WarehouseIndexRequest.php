<?php

namespace App\Http\Requests\Api\Warehouse;

class WarehouseIndexRequest extends WarehouseBaseRequest
{
    public function rules(): array
    {
        return [
            'per_page' => 'nullable|integer|in:10,20,50,100',
            'page' => 'nullable|integer|min:1',
            'search' => 'nullable|string|max:255',
            'is_default' => 'nullable|in:0,1',
            'sortField' => 'nullable|in:name,location,is_default,company_id,created_at',
            'sortOrder' => 'nullable|in:asc,desc',
        ];
    }
}
