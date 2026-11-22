<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company', function (Blueprint $table) {
            if (!Schema::hasColumn('company', 'payment_gateway_settings')) {
                $table->json('payment_gateway_settings')->nullable()->after('sms_template_settings');
            }
        });
    }

    public function down(): void
    {
        Schema::table('company', function (Blueprint $table) {
            if (Schema::hasColumn('company', 'payment_gateway_settings')) {
                $table->dropColumn('payment_gateway_settings');
            }
        });
    }
};
