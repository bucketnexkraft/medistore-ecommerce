<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'payable_amount')) {
                $table->decimal('payable_amount', 28, 8)->default(0)->after('payment_status');
            }

            if (! Schema::hasColumn('orders', 'payment_payload')) {
                $table->longText('payment_payload')->nullable()->after('coupon_discount_amount');
            }

            if (! Schema::hasColumn('orders', 'remarks')) {
                $table->text('remarks')->nullable()->after('payment_payload');
            }

            if (! Schema::hasColumn('orders', 'trx')) {
                $table->string('trx', 40)->nullable()->after('remarks')->index();
            }

            if (! Schema::hasColumn('orders', 'gateway_txn_id')) {
                $table->string('gateway_txn_id', 120)->nullable()->after('trx');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'trx')) {
                $table->dropIndex(['trx']);
            }

            $columns = array_values(array_filter([
                'payable_amount',
                'payment_payload',
                'remarks',
                'trx',
                'gateway_txn_id',
            ], fn (string $column) => Schema::hasColumn('orders', $column)));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
