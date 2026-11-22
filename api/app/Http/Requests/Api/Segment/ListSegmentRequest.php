<?php

namespace App\Http\Requests\Api\Segment;

use Illuminate\Foundation\Http\FormRequest;

class ListSegmentRequest extends FormRequest
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
