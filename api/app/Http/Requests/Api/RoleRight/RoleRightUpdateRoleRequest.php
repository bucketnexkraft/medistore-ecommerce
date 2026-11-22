<?php

namespace App\Http\Requests\Api\RoleRight;

use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class RoleRightUpdateRoleRequest extends RoleRightBaseRequest
{
    public function rules(): array
    {
        $companyId = Auth::user()?->company_id;
        $roleId = (int) $this->route('id');

        return [
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('role', 'name')->where(function ($query) use ($companyId, $roleId) {
                    return $query->where('company_id', $companyId)->where('id', '!=', $roleId);
                }),
            ],
            'rights' => 'sometimes|array',
            'rights.*' => 'integer|exists:right,id',
        ];
    }
}
