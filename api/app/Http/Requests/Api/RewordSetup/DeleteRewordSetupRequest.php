<?php

namespace App\Http\Requests\Api\RewordSetup;

class DeleteRewordSetupRequest extends RewordSetupBaseRequest
{
    public function rules(): array
    {
        return [
            'ids' => 'nullable|array',
            'ids.*' => 'integer|exists:reword_setup,id',
        ];
    }
}
