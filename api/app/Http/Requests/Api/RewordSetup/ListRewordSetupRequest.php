<?php

namespace App\Http\Requests\Api\RewordSetup;

class ListRewordSetupRequest extends RewordSetupBaseRequest
{
    public function rules(): array
    {
        return [
            'dateRange' => ['nullable', 'string', 'regex:/^\d{4}-\d{2}-\d{2}\s+to\s+\d{4}-\d{2}-\d{2}$/'],
            'search' => 'nullable|string|max:255',
            'redeemType' => 'nullable|string|in:cash,sale,both',
            'per_page' => 'nullable|integer|min:1|max:200',
            'page' => 'nullable|integer|min:1',
        ];
    }

    public function messages(): array
    {
        return [
            'dateRange.regex' => 'dateRange must follow: YYYY-MM-DD to YYYY-MM-DD',
        ];
    }

    public function filters(): array
    {
        return $this->validated();
    }
}
