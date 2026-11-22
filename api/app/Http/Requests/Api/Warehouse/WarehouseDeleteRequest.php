<?php

namespace App\Http\Requests\Api\Warehouse;

class WarehouseDeleteRequest extends WarehouseBaseRequest
{
    public function rules(): array
    {
        if ($this->route('id')) {
            return [];
        }

        return [
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|exists:warehouses,id',
        ];
    }
}
