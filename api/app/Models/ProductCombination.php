<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductCombination extends Model
{
    use HasFactory;
    protected $fillable = ['product_id', 'combination', 'segmentations'];

    protected $casts = [
        'combination' => 'array',
        'segmentations' => 'array',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function inventoryItems()
    {
        // Normalize combination JSON to same format stored in DB
        $combinationJson = json_encode(
            $this->combination,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );

        return InventoryItem::where('product_id', $this->product_id)
            ->where('variant_id', $combinationJson)
            ->orderBy('created_at', 'desc')
            ->first();
    }

    public function AllInventoryItems(){
        // Normalize combination JSON to same format stored in DB
        $combinationJson = json_encode(
            $this->combination,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );

        return InventoryItem::where('product_id', $this->product_id)
            ->where('variant_id', $combinationJson)
            ->get();
    }
}
