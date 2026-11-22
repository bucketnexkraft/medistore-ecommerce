<?php

namespace App\Http\Requests\Api\User;

class SearchCustomersRequest extends UserBaseRequest
{
    public function rules(): array
    {
        return [
            'params' => 'nullable|string|max:255',
        ];
    }
}
