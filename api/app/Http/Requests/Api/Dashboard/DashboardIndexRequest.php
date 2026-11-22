<?php

namespace App\Http\Requests\Api\Dashboard;

use Illuminate\Foundation\Http\FormRequest;

class DashboardIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => 'required|in:daily,monthly,yearly,custom',
            'startDate' => 'nullable|date|required_if:type,custom',
            'endDate' => 'nullable|date|required_if:type,custom|after_or_equal:startDate',
        ];
    }
}
