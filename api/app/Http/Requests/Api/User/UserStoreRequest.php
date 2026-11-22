<?php

namespace App\Http\Requests\Api\User;

use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class UserStoreRequest extends UserBaseRequest
{
    public function rules(): array
    {
        $companyId = Auth::user()?->company_id;

        return [
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => [
                'required',
                'email',
                Rule::unique('user', 'email')->where(fn ($query) => $query->where('company_id', $companyId)),
            ],
            'phone' => [
                'required',
                'max:20',
                Rule::unique('user', 'phone')->where(fn ($query) => $query->where('company_id', $companyId)),
            ],
            'role' => [
                'required',
                Rule::exists('role', 'id')->where(fn ($query) => $query->where('company_id', $companyId)),
            ],
            'status' => 'required|in:0,1',
            'password' => 'nullable|min:6|max:20|confirmed',
            'private_code' => 'nullable|string|min:4|max:100',
            'warehouse_id' => [
                'nullable',
                Rule::exists('warehouses', 'id')->where(fn ($query) => $query->where('company_id', $companyId)),
            ],
            'thumbnail' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ];
    }
}
