<?php

namespace App\Http\Requests\Api\Warehouse;

use App\Helpers\AuthHelper;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class WarehouseStoreRequest extends WarehouseBaseRequest
{
    public function rules(): array
    {
        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'location' => 'required|string|max:255',
            'is_default' => 'required|boolean',
            'company_id' => 'nullable|string|exists:company,company_id',
        ];

        if (AuthHelper::isSuperAdmin()) {
            $rules['name'][] = Rule::unique('warehouses', 'name');
        } else {
            $companyId = Auth::user()?->company_id;
            $rules['name'][] = Rule::unique('warehouses', 'name')->where(fn ($query) => $query->where('company_id', $companyId));
        }

        return $rules;
    }
}
