<?php

namespace App\Http\Requests\Api\WorkSlot;

use Illuminate\Foundation\Http\FormRequest;

class IndexWorkSlotRequest extends FormRequest
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
