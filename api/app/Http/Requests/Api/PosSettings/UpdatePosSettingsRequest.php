<?php

namespace App\Http\Requests\Api\PosSettings;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class UpdatePosSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'payment_methods' => 'required|array',
            'payment_methods.*.name' => 'required|string',
            'payment_methods.*.enabled' => 'required|boolean',
            'payment_methods.*.config' => 'nullable|array',
            'payment_methods.*.config.last_digit_length' => 'nullable|array|required_if:payment_methods.*.name,Card,Refund to Card',
            'payment_methods.*.config.require_last_digits' => 'nullable|boolean|required_if:payment_methods.*.name,Card,Refund to Card',
            'payment_methods.*.config.providers' => 'nullable|array|required_if:payment_methods.*.name,QR Payment,Refund to MF',
            'return_policy' => 'nullable|array',
            'return_policy.enabled' => 'nullable|boolean',
            'return_policy.return_window_days' => 'nullable|integer|min:0|max:365',
            'return_policy.allow_partial_return' => 'nullable|boolean',
            'return_policy.require_invoice' => 'nullable|boolean',
            'return_policy.allow_damaged_return' => 'nullable|boolean',
            'return_policy.manager_approval_threshold' => 'nullable|numeric|min:0',
            'return_policy.allowed_return_modes' => 'nullable|array',
            'return_policy.allowed_return_modes.*' => 'required|string|in:refund,exchange',
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'errors' => $validator->errors(),
        ], 422));
    }
}
