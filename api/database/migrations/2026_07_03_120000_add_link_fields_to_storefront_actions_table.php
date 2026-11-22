<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storefront_actions', function (Blueprint $table) {
            $table->string('link_type', 40)->default('custom_path')->after('expression');
            $table->string('route_key', 160)->nullable()->after('link_type');
        });
    }

    public function down(): void
    {
        Schema::table('storefront_actions', function (Blueprint $table) {
            $table->dropColumn(['link_type', 'route_key']);
        });
    }
};
