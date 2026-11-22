<?php

namespace App\Models;

use App\Constant\Directory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ETemplate extends Model
{
    use HasFactory;

    protected $table = 'e_templates';

    protected $fillable = [
        'template_name',
        'primary_color',
        'secondary_color',
        'font_family',
        'template_type',
        'short_description',
        'price',
        'discount_amount',
        'discount_type',
        'image',
        'categories',
        'tags',
        'section_preset_refs',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'categories' => 'array',
        'tags' => 'array',
        'section_preset_refs' => 'array',
    ];

    protected $appends = ['image_url'];

    public function getImageUrlAttribute(): ?string
    {
        if (! $this->image) {
            return null;
        }

        return get_file($this->image, Directory::E_TEMPLATE_IMAGE_PATH);
    }

    public function pages()
    {
        return $this->hasMany(ETemplatePage::class, 'template_id')->orderBy('created_at');
    }

    public function plans(): BelongsToMany
    {
        return $this->belongsToMany(
            SaasPlan::class,
            'e_template_saas_plan',
            'template_id',
            'plan_id'
        )->withTimestamps()->orderBy('name');
    }

    public function primaryPlan(): ?SaasPlan
    {
        $plans = $this->relationLoaded('plans')
            ? $this->plans
            : $this->plans()->get();

        if ($plans->isEmpty()) {
            return null;
        }

        // A template can be attached to both a paid plan and a commission plan.
        // Commission plans intentionally have a zero subscription price, so they
        // must not win as the primary plan for a paid template.
        return $plans->first(function (SaasPlan $plan) {
            return (bool) ($plan->status ?? false)
                && ($plan->is_free ?? null) !== 'free'
                && ! $plan->isCommissionBased();
        })
            ?? $plans->first(fn (SaasPlan $plan) => (bool) ($plan->status ?? false))
            ?? $plans->first();
    }

    public function sections()
    {
        return $this->hasMany(ETemplateSection::class, 'template_id')->orderBy('page_id')->orderBy('order');
    }

    public function actions()
    {
        return $this->hasMany(ETemplateAction::class, 'template_id')->orderBy('created_at');
    }
}
