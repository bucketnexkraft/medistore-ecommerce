<?php

namespace App\Http\Requests\Api\RoleRight;

class RoleRightStoreRightRequest extends RoleRightBaseRequest
{
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'module' => 'required|string|max:255',
        ];
    }
}
