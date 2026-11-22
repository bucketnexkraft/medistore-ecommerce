<?php

namespace App\Http\Requests\Api\Supplier;

class SupplierUpdateStatusRequest extends SupplierBaseRequest
{
    public function rules(): array
    {
        return [
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|exists:suppliers,id',
            'status' => 'required|in:0,1',
        ];
    }
}
