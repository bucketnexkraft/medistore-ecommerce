<?php

namespace App\Http\Requests\Api\SaasPlan;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SelectCompanySaasPlanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    public function rules(): array
    {
        return [
            'plan_id' => [
                'required',
                Rule::exists('saas_plans', 'id')->where(function ($query) {
                    $query->where('status', 1);
                }),
            ],
            'gateway_id' => [
                'required',
                Rule::exists('gateways', 'id')->where(function ($query) {
                    $query->where('status', 1);
                }),
            ],
            'payment_fields' => 'nullable',
            'payment_files' => 'nullable|array',
            'payment_files.*' => 'file|mimes:jpg,jpeg,png,pdf,webp|max:5120',
        ];
    }
}
