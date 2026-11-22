<?php

namespace App\Http\Requests\Api\Timesheet;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class StartShiftRequest extends GetUsersRequest
{
    public function rules(): array
    {
        return [
            'cash_in_hand' => 'required|numeric|min:0',
            'comments' => 'nullable|string|max:1000',
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'message' => $validator->errors()->first(),
            'errors' => $validator->errors(),
        ], 422));
    }
}
