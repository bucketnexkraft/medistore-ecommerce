<?php

namespace App\Http\Requests\Api\Unit;

class UnitDeleteRequest extends UnitBaseRequest
{
    public function rules(): array
    {
        if ($this->route('id')) {
            return [];
        }

        return [
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|exists:units,id',
        ];
    }
}
