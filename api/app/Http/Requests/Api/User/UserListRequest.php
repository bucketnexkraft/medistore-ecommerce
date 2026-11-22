<?php

namespace App\Http\Requests\Api\User;

class UserListRequest extends UserBaseRequest
{
    public function rules(): array
    {
        return [
            'perPage' => 'nullable|integer|min:1|max:500',
            'page' => 'nullable|integer|min:1',
            'search' => 'nullable|string|max:255',
            'role' => 'nullable|string|max:191',
            'status' => 'nullable|in:0,1',
            'sortField' => 'nullable|in:first_name,last_name,email,phone,status,created_at',
            'sortOrder' => 'nullable|in:asc,desc',
        ];
    }
}
