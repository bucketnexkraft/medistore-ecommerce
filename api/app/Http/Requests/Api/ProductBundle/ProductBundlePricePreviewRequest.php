<?php

namespace App\Http\Requests\Api\ProductBundle;

class ProductBundlePricePreviewRequest extends ProductBundleIndexRequest
{
    public function rules(): array
    {
        return [
            'qty' => 'nullable|numeric|min:0.01',
            'warehouse_id' => 'nullable',
        ];
    }
}
