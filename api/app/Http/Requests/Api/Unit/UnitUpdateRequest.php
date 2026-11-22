<?php

namespace App\Http\Requests\Api\Unit;

use Illuminate\Validation\Rule;

class UnitUpdateRequest extends UnitBaseRequest
{
    public function rules(): array
    {
        $id = $this->route('id');

        return [
            'unit_name' => [
                'required',
                'max:191',
                Rule::unique('units', 'unit_name')->ignore($id),
            ],
            'unit_code' => [
                'required',
                'max:191',
                Rule::unique('units', 'unit_code')->ignore($id),
            ],
            'base_unit' => 'nullable|integer|min:0',
            'operator' => 'nullable|in:*,/',
            'operation_value' => 'nullable|numeric|gt:0',
            'is_active' => 'nullable|boolean',
        ];
    }
}
