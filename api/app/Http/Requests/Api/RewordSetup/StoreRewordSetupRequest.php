<?php

namespace App\Http\Requests\Api\RewordSetup;

class StoreRewordSetupRequest extends RewordSetupBaseRequest
{
    public function rules(): array
    {
        return [
            'form_date' => 'required|date',
            'to_date' => 'required|date|after_or_equal:form_date',
            'amount' => 'required|numeric|min:0',
            'reword_unit' => 'required|numeric|min:0',
            'reword_value' => 'required|numeric|min:0',
            'redeem_type' => 'required|string|in:cash,sale,both',
        ];
    }

    public function payload(): array
    {
        return $this->validated();
    }
}
