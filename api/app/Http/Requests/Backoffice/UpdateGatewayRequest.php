<?php

namespace App\Http\Requests\Backoffice;

use Illuminate\Foundation\Http\FormRequest;

class UpdateGatewayRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'currency_id' => 'required|exists:currencies,id',
            'image' => 'nullable|file|image|mimes:jpeg,png,jpg,gif,svg,webp|max:2048',
            'parameters' => 'nullable',
            'charge' => 'required|numeric|min:0',
            'charge_type' => 'required|in:fixed,percent',
            'status' => 'nullable|boolean',
            'description' => 'nullable|string',
        ];
    }
}
