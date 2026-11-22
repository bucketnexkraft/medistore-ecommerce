<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StorefrontPage extends Model
{
    use HasFactory;

    protected $table = 'storefront_pages';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'name',
        'slug',
        'route_mode',
        'route_key',
        'component_key',
        'description',
        'menu_token',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'company_id');
    }

    public function sections()
    {
        return $this->hasMany(StorefrontSection::class, 'page_id', 'id')->orderBy('order');
    }

    public function actions()
    {
        return $this->hasMany(StorefrontAction::class, 'page_id', 'id');
    }

    public function incomingActions()
    {
        return $this->hasMany(StorefrontAction::class, 'target_page_id', 'id');
    }
}
