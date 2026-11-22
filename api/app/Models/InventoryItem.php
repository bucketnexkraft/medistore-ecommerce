<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class InventoryItem extends Model
{
    use HasFactory, BelongsToCompany, SoftDeletes;
    protected $table = 'inventory_items';
    public $incrementing = true;
    protected $keyType = 'int';
    protected $casts = [
        'variant_id'   => 'array',
        'price_json'   => 'array',
        'segmentations'=> 'array',
        'product_id'   => 'string',
    ];
    protected $fillable = [
        'inventory_id',
        'invoice_item_id',
        'company_id',
        'warehouse_id',
        'product_id',
        'lot_number',
        'expiry_date',
        'barcode',
        'sku',
        'quantity',
        'variant_id',
        'segmentations',
        'price',
        'purchase_price',
        'price_json',
        'stock_out_mood',
        'discount_amount',
        'discount_type',
        'alert_quantity',
        'invoice_id',
    ];

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();

        static::deleting(function ($inventoryItem) {
            if (!$inventoryItem->isForceDeleting() && !$inventoryItem->is_deleted) {
                $inventoryItem->is_deleted = true;
                $inventoryItem->saveQuietly();
            }
        });

        static::restoring(function ($inventoryItem) {
            if ($inventoryItem->is_deleted) {
                $inventoryItem->is_deleted = false;
                $inventoryItem->saveQuietly();
            }
        });
    }

    function product(){
        return $this->belongsTo(Product::class, 'product_id')->withTrashed();
    }

    function warehouse(){
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }

    function stockGroup(){
        return $this->belongsTo(ProductStockGroup::class, 'variant_id');
    }

    function invoice(){
        return $this->belongsTo(Invoice::class,'invoice_id', 'id');
    }

    public function inventory()
    {
        return $this->belongsTo(Inventory::class, 'inventory_id', 'id');
    }
    
    public function invoiceItem()
    {
        return $this->belongsTo(InvoiceItem::class, 'invoice_item_id', 'id');
    }

    public function barcodes()
    {
        return $this->hasMany(ProductBarcode::class, 'inventory_item_id', 'id');
    }

    public function salesChannels()
    {
        return $this->hasMany(SalesChannel::class, 'inventory_id', 'id');
    }

    public function formatVariant($variant): string
    {
        if (empty($variant) || !is_array($variant)) return 'N/A';
        return collect($variant)
            ->map(fn($value, $key) => ucfirst($key) . ': ' . $value)
            ->implode(', ');
    }
}
