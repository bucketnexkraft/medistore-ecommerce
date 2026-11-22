<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('e_section_presets', function (Blueprint $table) {
            if (Schema::hasColumn('e_section_presets', 'config_json')) {
                $table->dropColumn('config_json');
            }
        });
    }

    public function down(): void
    {
        Schema::table('e_section_presets', function (Blueprint $table) {
            if (! Schema::hasColumn('e_section_presets', 'config_json')) {
                $table->longText('config_json')->nullable()->after('categories');
            }
        });
    }
};
