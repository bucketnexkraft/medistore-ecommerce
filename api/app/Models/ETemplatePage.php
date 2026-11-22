<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ETemplatePage extends Model
{
    use HasFactory;

    protected $table = 'e_template_pages';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'template_id',
        'name',
        'slug',
        'route_mode',
        'route_key',
        'component_key',
        'description',
        'menu_token',
    ];

    public function template()
    {
        return $this->belongsTo(ETemplate::class, 'template_id');
    }

    public function sections()
    {
        return $this->hasMany(ETemplateSection::class, 'page_id', 'id')->orderBy('order');
    }

    public function actions()
    {
        return $this->hasMany(ETemplateAction::class, 'page_id', 'id');
    }
}
