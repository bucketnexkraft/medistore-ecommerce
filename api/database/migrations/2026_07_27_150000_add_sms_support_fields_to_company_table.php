<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company', function (Blueprint $table) {
            if (!Schema::hasColumn('company', 'sms_service_provider')) {
                $table->string('sms_service_provider')->nullable()->after('delivery_charge_settings');
            }

            if (!Schema::hasColumn('company', 'sms_api_key')) {
                $table->text('sms_api_key')->nullable()->after('sms_service_provider');
            }

            if (!Schema::hasColumn('company', 'sms_sender_id')) {
                $table->string('sms_sender_id')->nullable()->after('sms_api_key');
            }

            if (!Schema::hasColumn('company', 'sms_verify_phone_on_order')) {
                $table->boolean('sms_verify_phone_on_order')->default(false)->after('sms_sender_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('company', function (Blueprint $table) {
            foreach ([
                'sms_verify_phone_on_order',
                'sms_sender_id',
                'sms_api_key',
                'sms_service_provider',
            ] as $column) {
                if (Schema::hasColumn('company', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
