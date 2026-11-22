<?php

namespace App\Http\Requests\Api\Supplier;

class SupplierListRequest extends SupplierBaseRequest
{
    public function rules(): array
    {
        return [
            'perPage' => 'nullable|integer|min:1|max:500',
            'page' => 'nullable|integer|min:1',
            'search' => 'nullable|string|max:255',
            'status' => 'nullable|in:0,1',
            'sortField' => 'nullable|in:id,name,email,phone_number,address,status,created_at,updated_at',
            'sortOrder' => 'nullable|in:asc,desc',
        ];
    }
}
