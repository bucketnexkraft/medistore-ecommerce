<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PosSetting extends Model
{
    use HasFactory, BelongsToCompany;
    protected $fillable = ['company_id', 'key', 'value'];

    protected $casts = [
        'value' => 'array', // Automatically cast JSON to array
    ];

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    // Scope to filter by company_id
    public function scopeByCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }
}
