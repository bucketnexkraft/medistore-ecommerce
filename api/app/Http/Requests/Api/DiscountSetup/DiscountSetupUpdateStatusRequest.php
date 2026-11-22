<?php

namespace App\Http\Requests\Api\DiscountSetup;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class DiscountSetupUpdateStatusRequest extends DiscountSetupListRequest
{
    public function rules(): array
    {
        return [
            'status' => 'required|boolean',
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'status' => 0,
            'message' => 'Validation failed',
            'errors' => $validator->messages()->all(),
        ], 422));
    }
}
