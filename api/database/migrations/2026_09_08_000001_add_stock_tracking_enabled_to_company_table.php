<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('company', 'stock_tracking_enabled')) {
            Schema::table('company', function (Blueprint $table) {
                $table->boolean('stock_tracking_enabled')->default(true)->after('stockguard_value_threshold');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('company', 'stock_tracking_enabled')) {
            Schema::table('company', function (Blueprint $table) {
                $table->dropColumn('stock_tracking_enabled');
            });
        }
    }
};
