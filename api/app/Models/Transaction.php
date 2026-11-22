<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Transaction extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = "transactions";

    protected $fillable = [
        'invoice_id',
        'user_id',
        'amount',
        'collection_source',
        'payment_method',
        'card_type',
        'card_last_digits',
        'mf_type',
        'mf_number',
        'qr_provider',
        'qr_transaction_id',
        'transaction_date',
    ];

    protected static function boot()
    {
        parent::boot();

        static::deleting(function ($transaction) {
            if (!$transaction->isForceDeleting() && !$transaction->is_deleted) {
                $transaction->is_deleted = true;
                $transaction->saveQuietly();
            }
        });

        static::restoring(function ($transaction) {
            if ($transaction->is_deleted) {
                $transaction->is_deleted = false;
                $transaction->saveQuietly();
            }
        });
    }

    public function invoice()
    {
        return $this->belongsTo(Invoice::class, 'invoice_id', 'id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}
