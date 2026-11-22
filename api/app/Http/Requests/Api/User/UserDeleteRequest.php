<?php

namespace App\Http\Requests\Api\User;

class UserDeleteRequest extends UserBaseRequest
{
    public function rules(): array
    {
        if ($this->route('id')) {
            return [];
        }

        return [
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|exists:user,id',
        ];
    }
}
