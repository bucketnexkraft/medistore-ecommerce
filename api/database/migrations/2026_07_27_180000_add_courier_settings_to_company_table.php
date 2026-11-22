<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company', function (Blueprint $table) {
            if (! Schema::hasColumn('company', 'courier_settings')) {
                $table->json('courier_settings')->nullable()->after('delivery_charge_settings');
            }
        });
    }

    public function down(): void
    {
        Schema::table('company', function (Blueprint $table) {
            if (Schema::hasColumn('company', 'courier_settings')) {
                $table->dropColumn('courier_settings');
            }
        });
    }
};
