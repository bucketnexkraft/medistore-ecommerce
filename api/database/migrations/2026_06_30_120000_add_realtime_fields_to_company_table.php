<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company', function (Blueprint $table) {
            if (! Schema::hasColumn('company', 'push_status')) {
                $table->boolean('push_status')->default(false)->after('youtube_link');
            }

            if (! Schema::hasColumn('company', 'pusher_app_key')) {
                $table->string('pusher_app_key')->nullable()->after('push_status');
            }

            if (! Schema::hasColumn('company', 'pusher_app_cluster')) {
                $table->string('pusher_app_cluster')->nullable()->after('pusher_app_key');
            }

            if (! Schema::hasColumn('company', 'pusher_app_id')) {
                $table->string('pusher_app_id')->nullable()->after('pusher_app_cluster');
            }

            if (! Schema::hasColumn('company', 'pusher_app_secret')) {
                $table->string('pusher_app_secret')->nullable()->after('pusher_app_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('company', function (Blueprint $table) {
            $columns = array_values(array_filter([
                'push_status',
                'pusher_app_key',
                'pusher_app_cluster',
                'pusher_app_id',
                'pusher_app_secret',
            ], fn (string $column) => Schema::hasColumn('company', $column)));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
