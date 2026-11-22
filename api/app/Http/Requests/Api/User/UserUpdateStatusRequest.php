<?php

namespace App\Http\Requests\Api\User;

class UserUpdateStatusRequest extends UserBaseRequest
{
    public function rules(): array
    {
        return [
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|exists:user,id',
            'status' => 'required|in:0,1',
        ];
    }
}
