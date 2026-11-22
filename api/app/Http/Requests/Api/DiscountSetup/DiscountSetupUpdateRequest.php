<?php

namespace App\Http\Requests\Api\DiscountSetup;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class DiscountSetupUpdateRequest extends DiscountSetupStoreRequest
{
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'status' => 0,
            'message' => 'Validation failed',
            'errors' => $validator->messages()->all(),
        ], 422));
    }
}
