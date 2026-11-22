<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('group_purchases', function (Blueprint $table) {
            if (! Schema::hasColumn('group_purchases', 'purchase_status')) {
                $table->enum('purchase_status', ['awaiting_members', 'awaiting_purchases', 'discount_unlocked', 'discount_failed'])
                    ->default('awaiting_members')
                    ->after('status');
            }

            if (! Schema::hasColumn('group_purchases', 'purchase_deadline_at')) {
                $table->timestamp('purchase_deadline_at')->nullable()->after('expires_at');
            }

            if (! Schema::hasColumn('group_purchases', 'discount_unlocked_at')) {
                $table->timestamp('discount_unlocked_at')->nullable()->after('purchase_deadline_at');
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'group_purchase_id')) {
                $table->string('group_purchase_id')->nullable()->index()->after('company_id');
            }

            if (! Schema::hasColumn('orders', 'group_purchase_discount_status')) {
                $table->enum('group_purchase_discount_status', ['none', 'pending', 'applied', 'missed'])
                    ->default('none')
                    ->after('payment_status');
            }

            if (! Schema::hasColumn('orders', 'group_discount_amount')) {
                $table->decimal('group_discount_amount', 10, 2)->default(0)->after('total_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $columns = array_values(array_filter([
                'group_purchase_id',
                'group_purchase_discount_status',
                'group_discount_amount',
            ], fn (string $column) => Schema::hasColumn('orders', $column)));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });

        Schema::table('group_purchases', function (Blueprint $table) {
            $columns = array_values(array_filter([
                'purchase_status',
                'purchase_deadline_at',
                'discount_unlocked_at',
            ], fn (string $column) => Schema::hasColumn('group_purchases', $column)));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
