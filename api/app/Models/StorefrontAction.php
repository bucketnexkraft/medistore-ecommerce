<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StorefrontAction extends Model
{
    use HasFactory;

    protected $table = 'storefront_actions';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'page_id',
        'target_page_id',
        'section_id',
        'name',
        'slug',
        'expression',
        'link_type',
        'route_key',
        'label',
        'placement',
        'footer_group',
        'sort_order',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'company_id');
    }

    public function page()
    {
        return $this->belongsTo(StorefrontPage::class, 'page_id', 'id');
    }

    public function section()
    {
        return $this->belongsTo(StorefrontSection::class, 'section_id', 'id');
    }

    public function targetPage()
    {
        return $this->belongsTo(StorefrontPage::class, 'target_page_id', 'id');
    }
}
