<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company', function (Blueprint $table) {
            if (!Schema::hasColumn('company', 'sms_template_settings')) {
                $table->json('sms_template_settings')->nullable()->after('sms_sender_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('company', function (Blueprint $table) {
            if (Schema::hasColumn('company', 'sms_template_settings')) {
                $table->dropColumn('sms_template_settings');
            }
        });
    }
};
