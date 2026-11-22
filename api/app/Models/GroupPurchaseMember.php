<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class GroupPurchaseMember extends Model
{
    use HasFactory;

    protected $table = 'group_purchase_members';
    protected $primaryKey = 'id';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'group_purchase_id',
        'user_id',
        'status',
        'joined_at',
    ];

    protected $casts = [
        'joined_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function (self $member) {
            if (empty($member->id)) {
                $member->id = (string) Str::uuid();
            }

            if (empty($member->joined_at)) {
                $member->joined_at = now();
            }
        });
    }

    public function groupPurchase()
    {
        return $this->belongsTo(GroupPurchase::class, 'group_purchase_id', 'id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}
