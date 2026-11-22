<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company', function (Blueprint $table) {
            $table->string('google_client_id')->nullable()->after('pusher_app_secret');
            $table->text('google_client_secret')->nullable()->after('google_client_id');
        });
    }

    public function down(): void
    {
        Schema::table('company', function (Blueprint $table) {
            $table->dropColumn(['google_client_id', 'google_client_secret']);
        });
    }
};
