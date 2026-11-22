<?php

namespace App\Http\Requests\Api\Brand;

use App\Helpers\AuthHelper;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class BrandStoreRequest extends BrandListRequest
{
    public function rules(): array
    {
        $isSuperAdmin = AuthHelper::isSuperAdmin();

        $titleRules = [
            'required',
            'max:255',
        ];

        if ($isSuperAdmin) {
            $titleRules[] = Rule::unique('brand', 'title');
        } else {
            $titleRules[] = Rule::unique('brand', 'title')->where(function ($query) {
                return $query->where('company_id', Auth::user()->company_id);
            });
        }

        return [
            'title' => $titleRules,
            'image' => 'nullable|image|mimes:png,jpg,jpeg,gif,webp|max:2048',
            'status' => 'nullable',
            'return_enabled' => 'nullable|boolean',
            'return_day' => 'nullable|integer|min:0',
            'return_condition' => [
                'nullable',
                function ($attribute, $value, $fail) {
                    if (is_array($value)) {
                        return;
                    }

                    if (! is_string($value)) {
                        $fail('The return condition must be valid JSON.');
                        return;
                    }

                    if (trim($value) === '') {
                        return;
                    }

                    $decoded = json_decode($value, true);

                    if (! is_array($decoded) || json_last_error() !== JSON_ERROR_NONE) {
                        $fail('The return condition must be valid JSON.');
                    }
                },
            ],
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'status' => 0,
            'errors' => $validator->messages()->all(),
        ], 422));
    }
}
