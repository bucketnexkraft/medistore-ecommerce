<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductBarcodeStore extends Model
{
    use HasFactory, BelongsToCompany;

    protected $table = 'product_barcode_store';

    protected $fillable = [
        'company_id',
        'product_id',
        'invoice_no',
        'note',
        'date',
        'barcode',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }
}
