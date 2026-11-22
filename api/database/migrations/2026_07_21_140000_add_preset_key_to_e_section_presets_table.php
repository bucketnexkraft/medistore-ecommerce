<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('e_section_presets', function (Blueprint $table) {
            if (! Schema::hasColumn('e_section_presets', 'preset_key')) {
                $table->string('preset_key', 120)->nullable()->after('section_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('e_section_presets', function (Blueprint $table) {
            if (Schema::hasColumn('e_section_presets', 'preset_key')) {
                $table->dropColumn('preset_key');
            }
        });
    }
};
