<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('e_template_sections', 'config_json')) {
            Schema::table('e_template_sections', function (Blueprint $table) {
                $table->longText('config_json')->nullable()->after('rich_text_html');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('e_template_sections', 'config_json')) {
            Schema::table('e_template_sections', function (Blueprint $table) {
                $table->dropColumn('config_json');
            });
        }
    }
};
