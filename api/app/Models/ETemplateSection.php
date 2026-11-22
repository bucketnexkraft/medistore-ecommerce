<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ETemplateSection extends Model
{
    use HasFactory;

    protected $table = 'e_template_sections';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'template_id',
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
        'category_refs',
        'order',
        'query_sql',
        'query_json',
        'rich_text_html',
        'config_json',
    ];

    protected $casts = [
        'category_refs' => 'array',
        'config_json' => 'array',
    ];

    /**
     * Normalize encoded payloads before Laravel's array cast persists them so
     * config_json is stored as one JSON document, never an escaped JSON string.
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

    public function template()
    {
        return $this->belongsTo(ETemplate::class, 'template_id');
    }

    public function page()
    {
        return $this->belongsTo(ETemplatePage::class, 'page_id', 'id');
    }

    public function actions()
    {
        return $this->hasMany(ETemplateAction::class, 'section_id', 'id');
    }
}
