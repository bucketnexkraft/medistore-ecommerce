<?php

namespace App\Http\Requests\Api\SaasPlan;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSaasPlanStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check() && auth()->user()->isSuperAdmin();
    }

    public function rules(): array
    {
        return [
            'status' => 'required|boolean',
        ];
    }
}
