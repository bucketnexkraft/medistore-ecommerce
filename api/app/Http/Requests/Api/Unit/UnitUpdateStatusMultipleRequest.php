<?php

namespace App\Http\Requests\Api\Unit;

class UnitUpdateStatusMultipleRequest extends UnitBaseRequest
{
    public function rules(): array
    {
        return [
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|exists:units,id',
            'is_active' => 'required|in:0,1',
        ];
    }
}
