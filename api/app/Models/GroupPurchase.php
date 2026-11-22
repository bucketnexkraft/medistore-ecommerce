<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class GroupPurchase extends Model
{
    use HasFactory, BelongsToCompany;

    protected $table = 'group_purchases';
    protected $primaryKey = 'id';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'company_id',
        'product_id',
        'owner_user_id',
        'share_token',
        'status',
        'purchase_status',
        'minimum_users',
        'discount_type',
        'discount_amount',
        'base_price',
        'discounted_price',
        'expires_at',
        'purchase_deadline_at',
        'discount_unlocked_at',
        'last_message_at',
    ];

    protected $casts = [
        'minimum_users' => 'integer',
        'discount_amount' => 'decimal:2',
        'base_price' => 'decimal:2',
        'discounted_price' => 'decimal:2',
        'expires_at' => 'datetime',
        'purchase_deadline_at' => 'datetime',
        'discount_unlocked_at' => 'datetime',
        'last_message_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();

        static::creating(function (self $groupPurchase) {
            if (empty($groupPurchase->id)) {
                $groupPurchase->id = (string) Str::uuid();
            }

            if (empty($groupPurchase->share_token)) {
                $groupPurchase->share_token = Str::random(40);
            }
        });
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id')->withoutGlobalScope('company');
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_user_id', 'id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'company_id');
    }

    public function members()
    {
        return $this->hasMany(GroupPurchaseMember::class, 'group_purchase_id', 'id');
    }

    public function activeMembers()
    {
        return $this->hasMany(GroupPurchaseMember::class, 'group_purchase_id', 'id')->where('status', 'joined');
    }

    public function messages()
    {
        return $this->hasMany(GroupPurchaseMessage::class, 'group_purchase_id', 'id');
    }

    public function orders()
    {
        return $this->hasMany(CustomerOrder::class, 'group_purchase_id', 'id');
    }
}
