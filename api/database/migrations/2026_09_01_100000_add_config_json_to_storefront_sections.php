<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('storefront_sections', 'config_json')) {
            Schema::table('storefront_sections', function (Blueprint $table) {
                $table->longText('config_json')->nullable()->after('rich_text_html');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('storefront_sections', 'config_json')) {
            Schema::table('storefront_sections', function (Blueprint $table) {
                $table->dropColumn('config_json');
            });
        }
    }
};
