<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company', function (Blueprint $table) {
            if (! Schema::hasColumn('company', 'delivery_channel_settings')) {
                $table->json('delivery_channel_settings')->nullable()->after('tiktok_test_event_code');
            }

            if (! Schema::hasColumn('company', 'delivery_charge_settings')) {
                $table->json('delivery_charge_settings')->nullable()->after('delivery_channel_settings');
            }
        });
    }

    public function down(): void
    {
        Schema::table('company', function (Blueprint $table) {
            foreach (['delivery_channel_settings', 'delivery_charge_settings'] as $column) {
                if (Schema::hasColumn('company', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
