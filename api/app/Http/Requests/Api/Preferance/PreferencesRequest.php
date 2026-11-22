<?php

namespace App\Http\Requests\Api\Preferance;

use Illuminate\Foundation\Http\FormRequest;

class PreferencesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'companyId' => 'nullable|string|max:191',
        ];
    }
}
