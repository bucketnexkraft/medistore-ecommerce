<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use App\Helpers\Helper;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Invoice extends Model
{
    use HasFactory, BelongsToCompany, SoftDeletes;

    protected $table = 'invoices';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'type', 
        'company_id', 
        'warehouse_id', 
        'user_id', 
        'customer_id', 
        'supplier_id', 
        'invoice_no', 
        'date', 
        'qty', 
        'discount', 
        'sub_total', 
        'total', 
        'return_amount', 
        'note', 
        'document', 
        'payment_status', 
        'payment_method', 
        'paid_amount', 
        'due_amount', 
        'change_due', 
        'card_type', 
        'card_last_digits', 
        'mf_type', 
        'mf_number', 
        'qr_provider', 
        'qr_transaction_id', 
        'points_used', 
        'points_earned', 
        'original_invoice_id', 
        'referance_value', 
        'draft_payload',
    ];

    protected $casts = [
        'draft_payload' => 'array',
    ];

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
        static::creating(function ($model) {
            $model->id = substr(uniqid(), 0, 13).'-inv-'.random_int(10000000000000000, 99999999999999999);
            if (empty($model->invoice_no)) {
                $model->invoice_no = self::generateInvoiceNo();
            }
        });
		
		static::deleting(function ($invoice) {
            if (!$invoice->isForceDeleting() && !$invoice->is_deleted) {
                $invoice->is_deleted = true;
                $invoice->saveQuietly();
            }
        });

        static::restoring(function ($invoice) {
            if ($invoice->is_deleted) {
                $invoice->is_deleted = false;
                $invoice->saveQuietly();
            }
        });
    }

    public static function generateInvoiceNo()
    {
        $prefix = 'INV-';
        $date = now()->format('Ymd');

        // Find last invoice number for today
        $lastInvoice = self::whereDate('created_at', now()->toDateString())
            ->orderBy('id', 'desc')
            ->first();

        $number = 1;

        if ($lastInvoice && preg_match('/INV-' . $date . '-(\d+)/', $lastInvoice->invoice_no, $matches)) {
            $number = intval($matches[1]) + 1;
        }

        // Check setting
        if (Helper::getSettings('invoice_number') === 'serial') {
            // Sequential format
            return $prefix . $date . '-' . str_pad($number, 4, '0', STR_PAD_LEFT);
        } else {
            // Random suffix format (e.g., INV-20250818-4829)
            $random = rand(1000, 9999);
            return $prefix . $date . '-' . $random;
        }
    }

    public static function generateQuotationNo()
    {
        $prefix = 'QTN-';
        $date = now()->format('Ymd');

        $lastQuotation = self::where('type', 'quotation')
            ->whereDate('created_at', now()->toDateString())
            ->orderBy('created_at', 'desc')
            ->first();

        $number = 1;

        if ($lastQuotation && preg_match('/QTN-' . $date . '-(\d+)/', (string) $lastQuotation->invoice_no, $matches)) {
            $number = intval($matches[1]) + 1;
        }

        return $prefix . $date . '-' . str_pad($number, 4, '0', STR_PAD_LEFT);
    }

    public function items()
    {
        return $this->hasMany(InvoiceItem::class, 'invoice_id', 'id');
    }

    public function customer(){
        return $this->belongsTo(User::class, 'customer_id', 'id');
    }

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class, 'warehouse_id', 'id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id', 'id');
    }

    public function originalInvoice()
    {
        return $this->belongsTo(self::class, 'original_invoice_id', 'id');
    }

    public function paymentSchedules(){
        return $this->hasMany(PaymentSchedule::class, 'invoice_id', 'id');
    }

    public function transactions(){
        return $this->hasMany(Transaction::class, 'invoice_id', 'id');
    }

    public function invoiceHistory(){
        return $this->hasMany(InventoryHistory::class, 'invoice_id', 'id');
    }
}
