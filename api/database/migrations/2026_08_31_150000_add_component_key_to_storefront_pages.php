<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('e_template_pages', function (Blueprint $table) {
            if (! Schema::hasColumn('e_template_pages', 'component_key')) {
                $table->string('component_key', 160)->nullable()->after('route_key');
            }
        });

        Schema::table('storefront_pages', function (Blueprint $table) {
            if (! Schema::hasColumn('storefront_pages', 'component_key')) {
                $table->string('component_key', 160)->nullable()->after('route_key');
            }
        });
    }

    public function down(): void
    {
        Schema::table('storefront_pages', function (Blueprint $table) {
            if (Schema::hasColumn('storefront_pages', 'component_key')) {
                $table->dropColumn('component_key');
            }
        });

        Schema::table('e_template_pages', function (Blueprint $table) {
            if (Schema::hasColumn('e_template_pages', 'component_key')) {
                $table->dropColumn('component_key');
            }
        });
    }
};
