<?php

namespace App\Http\Requests\Api\Timesheet;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class HandoverShiftRequest extends GetUsersRequest
{
    public function rules(): array
    {
        return [
            'subject_user_id' => [
                'required',
                Rule::exists('user', 'id')->where(function ($query) {
                    return $query
                        ->where('company_id', Auth::user()?->company_id)
                        ->where('status', 1)
                        ->where('role', '<>', 2);
                }),
                'different:current_user',
            ],
            'cash_out_hand' => 'required|numeric|min:0',
            'cash_in_hand' => 'required|numeric|min:0',
            'comments' => 'nullable|string',
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'status' => 0,
            'errors' => $validator->errors(),
        ], 422));
    }
}
