<?php

namespace App\Http\Requests\Api\Stock;

use Illuminate\Foundation\Http\FormRequest;

class StockoutListRequest extends FormRequest
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
