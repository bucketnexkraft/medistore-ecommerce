<?php

namespace App\Http\Requests\Api\RoleRight;

class RoleRightRoleListRequest extends RoleRightBaseRequest
{
    public function rules(): array
    {
        return [
            'perPage' => 'nullable',
            'page' => 'nullable|integer|min:1',
            'search' => 'nullable|string|max:255',
            'sortField' => 'nullable|string|in:id,name,created_at,updated_at',
            'sortOrder' => 'nullable|string|in:asc,desc',
        ];
    }
}
