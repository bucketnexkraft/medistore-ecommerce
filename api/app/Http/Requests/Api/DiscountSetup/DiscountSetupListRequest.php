<?php

namespace App\Http\Requests\Api\DiscountSetup;

use Illuminate\Foundation\Http\FormRequest;

class DiscountSetupListRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [];
    }
}
