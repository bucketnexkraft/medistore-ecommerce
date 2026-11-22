<?php

namespace App\Http\Requests\Api\Unit;

class UnitListRequest extends UnitBaseRequest
{
    public function rules(): array
    {
        return [
            'perPage' => 'nullable|integer|min:1|max:500',
            'per_page' => 'nullable|integer|min:1|max:500',
            'page' => 'nullable|integer|min:1',
            'search' => 'nullable|string|max:191',
            'status' => 'nullable|in:0,1',
            'baseUnit' => 'nullable|integer|min:0',
            'sortField' => 'nullable|in:unit_name,unit_code,base_unit,operation_value,is_active,created_at',
            'sortOrder' => 'nullable|in:asc,desc',
        ];
    }
}
