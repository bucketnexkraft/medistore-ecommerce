<?php

namespace App\Models;

use App\Data\FeaturePreference;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class SaasPlan extends Model
{
    use HasFactory;

    protected $table = 'saas_plans';

    protected $fillable = [
        'name',
        'description',
        'is_free',
        'is_default',
        'plan_type',
        'included_plan_id',
        'price',
        'discount_amount',
        'discount_type',
        'billing_period',
        'trial_period',
        'commission_rate',
        'commission_type',
        'commission_base',
        'inventory_item_limit',
        'monthly_pos_transaction_limit',
        'warehouse_limit',
        'user_limit',
        'allow_inventory',
        'allow_pos',
        'features',
        'default_features',
        'status',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'commission_rate' => 'decimal:4',
        'trial_period' => 'integer',
        'inventory_item_limit' => 'integer',
        'monthly_pos_transaction_limit' => 'integer',
        'warehouse_limit' => 'integer',
        'user_limit' => 'integer',
        'allow_inventory' => 'boolean',
        'allow_pos' => 'boolean',
        'features' => 'array',
        'default_features' => 'array',
        'status' => 'boolean',
        'is_default' => 'boolean',
        'included_plan_id' => 'integer',
    ];

    public function isCommissionBased(): bool
    {
        return (string) $this->plan_type === 'commission';
    }

    public function templates(): BelongsToMany
    {
        return $this->belongsToMany(
            ETemplate::class,
            'e_template_saas_plan',
            'plan_id',
            'template_id'
        )->withTimestamps()->orderBy('template_name');
    }

    public function includedPlan(): BelongsTo
    {
        return $this->belongsTo(self::class, 'included_plan_id');
    }

    public function effectiveFeatures(array &$visited = []): array
    {
        if ($this->id && in_array((int) $this->id, $visited, true)) {
            return [];
        }

        if ($this->id) {
            $visited[] = (int) $this->id;
        }

        $ownFeatures = is_array($this->features) ? $this->features : [];
        $coreFeatures = FeaturePreference::coreValues();
        $parent = $this->relationLoaded('includedPlan')
            ? $this->includedPlan
            : $this->includedPlan()->first();

        if (!$parent) {
            return array_values(array_unique([...$coreFeatures, ...$ownFeatures]));
        }

        return array_values(array_unique([
            ...$coreFeatures,
            ...$parent->effectiveFeatures($visited),
            ...$ownFeatures,
        ]));
    }

    public function effectiveDefaultFeatures(array &$visited = []): array
    {
        if ($this->id && in_array((int) $this->id, $visited, true)) {
            return [];
        }

        if ($this->id) {
            $visited[] = (int) $this->id;
        }

        $hasExplicitDefaults = is_array($this->default_features);
        $ownDefaults = $hasExplicitDefaults
            ? $this->default_features
            : (is_array($this->features) ? $this->features : []);
        $parent = $this->relationLoaded('includedPlan')
            ? $this->includedPlan
            : $this->includedPlan()->first();
        $defaults = $parent && !$hasExplicitDefaults
            ? [...$parent->effectiveDefaultFeatures($visited), ...$ownDefaults]
            : $ownDefaults;
        $effectiveFeatures = $this->effectiveFeatures();

        return array_values(array_unique([
            ...FeaturePreference::coreValues(),
            ...array_intersect($defaults, $effectiveFeatures),
        ]));
    }
}
