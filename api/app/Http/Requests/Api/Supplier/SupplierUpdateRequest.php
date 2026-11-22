<?php

namespace App\Http\Requests\Api\Supplier;

use Illuminate\Validation\Rule;

class SupplierUpdateRequest extends SupplierBaseRequest
{
    public function rules(): array
    {
        $id = $this->route('id');

        return [
            'name' => 'required|string|max:255',
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('suppliers', 'email')->ignore($id),
            ],
            'phone_number' => 'required|string|max:15',
            'address' => 'nullable|string|max:255',
            'status' => 'nullable|boolean',
        ];
    }
}
