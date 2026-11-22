<?php

namespace App\Http\Requests;

use App\Data\FeaturePreference;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSaasPlanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check() && auth()->user()->isSuperAdmin();
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255|unique:saas_plans,name',
            'description' => 'nullable|string',
            'is_free' => 'required|in:free,paid',
            'plan_type' => 'nullable|in:free,paid,commission',
            'included_plan_id' => 'nullable|integer|exists:saas_plans,id',
            'price' => 'required|numeric|min:0',
            'discount_amount' => $this->discountAmountRules(),
            'discount_type' => 'required|in:fixed,percent',
            'billing_period' => 'required|in:monthly,yearly',
            'trial_period' => 'nullable|integer|min:0',
            'commission_rate' => 'nullable|numeric|min:0',
            'commission_type' => 'nullable|in:fixed,percent',
            'commission_base' => 'nullable|in:total_amount,subtotal,payable_amount',
            'inventory_item_limit' => 'required|integer|min:0',
            'monthly_pos_transaction_limit' => 'required|integer|min:0',
            'warehouse_limit' => 'required|integer|min:1',
            'user_limit' => 'required|integer|min:1',
            'allow_inventory' => 'required|boolean',
            'allow_pos' => 'required|boolean',
            'is_default' => 'nullable|boolean',
            'template_ids' => 'nullable|array',
            'template_ids.*' => 'nullable|integer|exists:e_templates,id',
            'features' => 'nullable|array',
            'features.*' => ['nullable', 'string', 'max:255', Rule::in(FeaturePreference::values())],
            'default_features' => 'nullable|array',
            'default_features.*' => ['nullable', 'string', 'max:255', Rule::in(FeaturePreference::values())],
            'status' => 'required|boolean',
        ];
    }

    private function discountAmountRules(): array
    {
        $rules = ['required', 'numeric', 'min:0'];
        if ($this->input('discount_type') === 'percent') {
            $rules[] = 'max:100';
        }
        return $rules;
    }
}
