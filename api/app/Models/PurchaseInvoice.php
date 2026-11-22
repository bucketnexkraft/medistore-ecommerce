<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseInvoice extends Model
{
    use HasFactory, BelongsToCompany;

    protected $with = ['supplier'];

    protected $guarded = [];

    protected $primaryKey = 'id';
    public $incrementing = false;

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
        static::creating(function ($model) {
            $model->id = substr(uniqid(), 0, 13).'-prs-'.random_int(10000000000000000, 99999999999999999);
        });
		
		static::deleting(function ($product) {
            
        });
    }

    function supplier(){
        return $this->belongsTo(Supplier::class);
    }

    function inventory(){
        return $this->hasMany(Inventory::class,'purchase_invoice_id');
    }
}
