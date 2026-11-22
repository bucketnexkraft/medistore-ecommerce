<?php

namespace App\Http\Requests\Api\Category;

use App\Helpers\AuthHelper;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class CategoryUpdateRequest extends CategoryStoreRequest
{
    public function rules(): array
    {
        $id = $this->route('id');
        $isSuperAdmin = AuthHelper::isSuperAdmin();

        $rules = [
            'title' => [
                'required',
                'max:255',
                Rule::unique('categories', 'title')->where(function ($query) use ($id) {
                    return $query->where('company_id', Auth::user()->company_id)
                        ->where('id', '!=', $id);
                }),
            ],
            'image' => 'nullable|image|mimes:png,jpg,jpeg,gif,webp|max:2048',
            'status' => 'nullable',
            'is_show_in_category_header' => 'nullable|boolean',
            'isShowInCategoryHeader' => 'nullable|boolean',
            'return_enabled' => 'nullable|boolean',
            'return_day' => 'nullable|integer|min:0',
            'return_condition' => [
                'nullable',
                function ($attribute, $value, $fail) {
                    if (is_array($value)) {
                        return;
                    }

                    if (! is_string($value)) {
                        $fail('The return condition must be valid JSON.');
                        return;
                    }

                    if (trim($value) === '') {
                        return;
                    }

                    $decoded = json_decode($value, true);

                    if (! is_array($decoded) || json_last_error() !== JSON_ERROR_NONE) {
                        $fail('The return condition must be valid JSON.');
                    }
                },
            ],
        ];

        if (!$isSuperAdmin) {
            $rules['parentId'] = [
                'nullable',
                'string',
                Rule::exists('categories', 'id')->where(function ($query) {
                    return $query->where('company_id', Auth::user()->company_id);
                }),
            ];
        } else {
            $rules['parentId'] = [
                'nullable',
                'string',
                'exists:categories,id',
            ];
        }

        return $rules;
    }
}
