<?php

namespace App\Http\Requests\Api\Timesheet;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class CashHandoverRequest extends GetUsersRequest
{
    public function rules(): array
    {
        return [
            'amount' => 'required|numeric|min:0.01',
            'received_by_user_id' => [
                'nullable',
                Rule::exists('user', 'id')->where(function ($query) {
                    return $query
                        ->where('company_id', Auth::user()?->company_id)
                        ->where('status', 1)
                        ->where('role', '<>', 2);
                }),
            ],
            'notes' => 'nullable|string|max:1000',
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'status' => 0,
            'message' => $validator->errors()->first(),
            'errors' => $validator->errors(),
        ], 422));
    }
}
