<?php

namespace App\Http\Requests\Api\RoleRight;

class RoleRightRightListRequest extends RoleRightBaseRequest
{
    public function rules(): array
    {
        return [
            'perPage' => 'nullable',
            'page' => 'nullable|integer|min:1',
            'search' => 'nullable|string|max:255',
            'sortField' => 'nullable|string|in:id,name,module,created_at,updated_at',
            'sortOrder' => 'nullable|string|in:asc,desc',
        ];
    }
}
