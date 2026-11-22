<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company', function (Blueprint $table) {
            $columns = [
                'gtm_id' => fn () => $table->string('gtm_id')->nullable()->after('whatsapp_number'),
                'facebook_pixel_id' => fn () => $table->string('facebook_pixel_id')->nullable()->after('gtm_id'),
                'facebook_pixel_access_token' => fn () => $table->text('facebook_pixel_access_token')->nullable()->after('facebook_pixel_id'),
                'facebook_test_event_id' => fn () => $table->string('facebook_test_event_id')->nullable()->after('facebook_pixel_access_token'),
                'tiktok_pixel_id' => fn () => $table->string('tiktok_pixel_id')->nullable()->after('facebook_test_event_id'),
                'tiktok_pixel_access_token' => fn () => $table->text('tiktok_pixel_access_token')->nullable()->after('tiktok_pixel_id'),
                'tiktok_test_event_code' => fn () => $table->string('tiktok_test_event_code')->nullable()->after('tiktok_pixel_access_token'),
            ];

            foreach ($columns as $name => $definition) {
                if (! Schema::hasColumn('company', $name)) {
                    $definition();
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('company', function (Blueprint $table) {
            foreach ([
                'gtm_id',
                'facebook_pixel_id',
                'facebook_pixel_access_token',
                'facebook_test_event_id',
                'tiktok_pixel_id',
                'tiktok_pixel_access_token',
                'tiktok_test_event_code',
            ] as $column) {
                if (Schema::hasColumn('company', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
