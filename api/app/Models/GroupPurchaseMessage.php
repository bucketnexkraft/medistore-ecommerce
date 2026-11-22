<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class GroupPurchaseMessage extends Model
{
    use HasFactory;

    protected $table = 'group_purchase_messages';
    protected $primaryKey = 'id';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'group_purchase_id',
        'user_id',
        'message',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function (self $message) {
            if (empty($message->id)) {
                $message->id = (string) Str::uuid();
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
