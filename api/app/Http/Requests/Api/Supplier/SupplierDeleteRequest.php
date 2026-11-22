<?php

namespace App\Http\Requests\Api\Supplier;

class SupplierDeleteRequest extends SupplierBaseRequest
{
    public function rules(): array
    {
        if ($this->route('id')) {
            return [];
        }

        return [
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|exists:suppliers,id',
        ];
    }
}
