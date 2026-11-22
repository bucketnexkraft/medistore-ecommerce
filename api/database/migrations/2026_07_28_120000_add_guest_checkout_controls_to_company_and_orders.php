<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('company')) {
            Schema::table('company', function (Blueprint $table) {
                if (! Schema::hasColumn('company', 'allow_guest_checkout')) {
                    $table->boolean('allow_guest_checkout')->default(false)->after('payment_gateway_settings');
                }
            });
        }

        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table) {
                if (Schema::hasColumn('orders', 'user_id')) {
                    $table->string('user_id', 40)->nullable()->change();
                }
            });
        }

        if (Schema::hasTable('user_shipping')) {
            Schema::table('user_shipping', function (Blueprint $table) {
                if (Schema::hasColumn('user_shipping', 'user_id')) {
                    $table->string('user_id', 40)->nullable()->change();
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('user_shipping')) {
            Schema::table('user_shipping', function (Blueprint $table) {
                if (Schema::hasColumn('user_shipping', 'user_id')) {
                    $table->string('user_id', 40)->nullable(false)->change();
                }
            });
        }

        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table) {
                if (Schema::hasColumn('orders', 'user_id')) {
                    $table->string('user_id', 40)->nullable(false)->change();
                }
            });
        }

        if (Schema::hasTable('company')) {
            Schema::table('company', function (Blueprint $table) {
                if (Schema::hasColumn('company', 'allow_guest_checkout')) {
                    $table->dropColumn('allow_guest_checkout');
                }
            });
        }
    }
};
