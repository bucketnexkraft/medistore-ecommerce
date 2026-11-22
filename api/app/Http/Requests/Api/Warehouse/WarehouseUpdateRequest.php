<?php

namespace App\Http\Requests\Api\Warehouse;

use App\Helpers\AuthHelper;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class WarehouseUpdateRequest extends WarehouseBaseRequest
{
    public function rules(): array
    {
        $id = (string) $this->route('id');

        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'location' => 'required|string|max:255',
            'is_default' => 'required|boolean',
            'company_id' => 'nullable|string|exists:company,company_id',
        ];

        if (AuthHelper::isSuperAdmin()) {
            $rules['name'][] = Rule::unique('warehouses', 'name')->ignore($id, 'id');
        } else {
            $companyId = Auth::user()?->company_id;
            $rules['name'][] = Rule::unique('warehouses', 'name')
                ->where(fn ($query) => $query->where('company_id', $companyId))
                ->ignore($id, 'id');
        }

        return $rules;
    }
}
