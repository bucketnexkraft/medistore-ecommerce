<?php

namespace App\Http\Requests\Api\Supplier;

class SupplierStoreRequest extends SupplierBaseRequest
{
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:suppliers,email',
            'phone_number' => 'required|string|max:15',
            'address' => 'nullable|string|max:255',
            'status' => 'nullable|boolean',
        ];
    }
}
