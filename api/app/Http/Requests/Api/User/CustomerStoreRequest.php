<?php

namespace App\Http\Requests\Api\User;

use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class CustomerStoreRequest extends UserBaseRequest
{
    public function rules(): array
    {
        $companyId = Auth::user()?->company_id;

        return [
            'name' => 'nullable|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'email' => [
                'nullable',
                'email',
                Rule::unique('user', 'email')->where(fn ($query) => $query->where('company_id', $companyId)),
            ],
            'phone' => [
                'required',
                'max:20',
                Rule::unique('user', 'phone')->where(fn ($query) => $query->where('company_id', $companyId)),
            ],
            'address' => 'nullable|string|max:500',
            'password' => 'nullable|min:6|max:20',
            'thumbnail' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ];
    }
}
