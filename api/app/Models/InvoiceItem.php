<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class InvoiceItem extends Model
{
    use HasFactory, BelongsToCompany, SoftDeletes;

    protected $table = 'invoice_items';
    protected $primaryKey = 'id';
    public $incrementing = true;
    protected $guarded = [];
    protected $keyType = 'string';

    protected $casts = ['variant_id' => 'array'];
    protected $fillable = [
        'type', 
        'company_id', 
        'warehouse_id', 
        'user_id', 
        'customer_id', 
        'supplier_id', 
        'invoice_no', 
        'date', 
        'qty',
        'discount_amount', 
        'discount', 
        'sub_total', 
        'total', 
        'return_amount', 
        'note', 
        'document', 
        'payment_status', 
        'payment_method', 
        'item_type',
        'bundle_id',
        'bundle_name',
        'paid_amount', 
        'due_amount', 
        'change_due', 
        'card_type', 
        'card_last_digits', 
        'mf_type', 
        'mf_number', 
        'qr_provider', 
        'qr_transaction_id', 
        'points_used', 
        'points_earned', 
        'original_invoice_id', 
        'referance_value',
    ];


    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
        static::creating(function ($model) {
           
        });
		
		static::deleting(function ($product) {
            if (!$product->isForceDeleting() && !$product->is_deleted) {
                $product->is_deleted = true;
                $product->saveQuietly();
            }
        });

        static::restoring(function ($product) {
            if ($product->is_deleted) {
                $product->is_deleted = false;
                $product->saveQuietly();
            }
        });
    }

    public function invoice()
    {
        return $this->belongsTo(Invoice::class, 'invoice_id', 'id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id')->withTrashed();
    }

    public function bundle()
    {
        return $this->belongsTo(ProductBundle::class, 'bundle_id');
    }

    public function originalItem(){
        return $this->belongsTo(InvoiceItem::class, 'original_sale_item_id', 'id');
    }

    public function inventory(){
        return $this->belongsTo(Inventory::class, 'inventory_id', 'id');
    }

    function warehouse(){
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }
    
    public function barcodes(){
        return $this->hasMany(ProductBarcode::class, 'product_id', 'product_id');
    }

    public function inventory_item(){
        return $this->hasOne(InventoryItem::class, 'invoice_item_id', 'id');
    }

    public function inventoryItem()
    {
        return $this->hasOne(InventoryItem::class, 'inventory_id', 'inventory_id')
            ->where(function ($query) {
                // Match on product_id if exists in invoice_items
                if ($this->product_id) {
                    $query->where('product_id', $this->product_id);
                }

                // Match on invoice_id if exists
                if ($this->invoice_id) {
                    $query->where('invoice_id', $this->invoice_id);
                }

                // Optional: match on variant_id (if JSON)
                if ($this->variant_id) {
                    $combinationJson = json_encode(
                        $this->variant_id,
                        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
                    );
                    $query->where('variant_id', $combinationJson);
                }
            })
            ->select([
                'id',
                'inventory_id',
                'product_id',
                'invoice_id',
                'price',
                'purchase_price',
                'expiry_date',
                'lot_number',
                'variant_id'
            ])
            ->orderBy('created_at', 'desc') // Get latest if multiple
            ->limit(1);
    }
}
