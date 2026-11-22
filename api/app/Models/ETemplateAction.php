<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ETemplateAction extends Model
{
    use HasFactory;

    protected $table = 'e_template_actions';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'template_id',
        'page_id',
        'section_id',
        'target_page_id',
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

    public function template()
    {
        return $this->belongsTo(ETemplate::class, 'template_id');
    }

    public function page()
    {
        return $this->belongsTo(ETemplatePage::class, 'page_id', 'id');
    }

    public function section()
    {
        return $this->belongsTo(ETemplateSection::class, 'section_id', 'id');
    }

    public function targetPage()
    {
        return $this->belongsTo(ETemplatePage::class, 'target_page_id', 'id');
    }
}
