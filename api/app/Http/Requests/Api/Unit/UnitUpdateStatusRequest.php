<?php

namespace App\Http\Requests\Api\Unit;

class UnitUpdateStatusRequest extends UnitBaseRequest
{
    public function rules(): array
    {
        return [
            'is_active' => 'required|in:0,1',
        ];
    }
}
