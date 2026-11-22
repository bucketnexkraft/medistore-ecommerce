<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StorefrontSection extends Model
{
    use HasFactory;

    protected $table = 'storefront_sections';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'page_id',
        'name',
        'title',
        'subtitle',
        'newsletter_title',
        'newsletter_text',
        'layout',
        'variant',
        'preset_key',
        'component_key',
        'order',
        'query_sql',
        'query_json',
        'rich_text_html',
        'config_json',
    ];

    protected $casts = [
        'config_json' => 'array',
    ];

    /**
     * Always hand the JSON cast an array. This also repairs values submitted
     * by older clients as an already-encoded (or double-encoded) JSON string.
     */
    public function setConfigJsonAttribute(mixed $value): void
    {
        for ($attempt = 0; $attempt < 2 && is_string($value); $attempt++) {
            $decoded = json_decode($value, true);
            $value = json_last_error() === JSON_ERROR_NONE ? $decoded : null;
        }

        $this->attributes['config_json'] = json_encode(
            is_array($value) ? $value : [],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'company_id');
    }

    public function page()
    {
        return $this->belongsTo(StorefrontPage::class, 'page_id', 'id');
    }

    public function actions()
    {
        return $this->hasMany(StorefrontAction::class, 'section_id', 'id');
    }
}
