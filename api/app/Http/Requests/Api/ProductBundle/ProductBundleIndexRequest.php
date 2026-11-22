<?php

namespace App\Http\Requests\Api\ProductBundle;

use Illuminate\Foundation\Http\FormRequest;

class ProductBundleIndexRequest extends FormRequest
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
