<?php

namespace App\Http\Requests\Api\DiscountSetup;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class DiscountSetupUpdateStatusMultipleRequest extends DiscountSetupListRequest
{
    public function rules(): array
    {
        return [
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:discount_setup,id',
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
