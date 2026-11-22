<?php

namespace App\Http\Requests\Api\RoleRight;

use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class RoleRightStoreRoleRequest extends RoleRightBaseRequest
{
    public function rules(): array
    {
        $companyId = Auth::user()?->company_id;

        return [
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('role', 'name')->where(function ($query) use ($companyId) {
                    return $query->where('company_id', $companyId);
                }),
            ],
            'rights' => 'required|array',
            'rights.*' => 'integer|exists:right,id',
        ];
    }
}
