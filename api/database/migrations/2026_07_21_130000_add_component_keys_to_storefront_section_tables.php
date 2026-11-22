<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('e_section_presets', function (Blueprint $table) {
            if (! Schema::hasColumn('e_section_presets', 'component_key')) {
                $table->string('component_key', 120)->nullable()->after('section_type');
            }
        });

        Schema::table('e_template_sections', function (Blueprint $table) {
            if (! Schema::hasColumn('e_template_sections', 'component_key')) {
                $table->string('component_key', 120)->nullable()->after('preset_key');
            }
        });

        Schema::table('storefront_sections', function (Blueprint $table) {
            if (! Schema::hasColumn('storefront_sections', 'preset_key')) {
                $table->string('preset_key', 120)->nullable()->after('variant');
            }

            if (! Schema::hasColumn('storefront_sections', 'component_key')) {
                $table->string('component_key', 120)->nullable()->after('preset_key');
            }
        });
    }

    public function down(): void
    {
        Schema::table('storefront_sections', function (Blueprint $table) {
            if (Schema::hasColumn('storefront_sections', 'component_key')) {
                $table->dropColumn('component_key');
            }

            if (Schema::hasColumn('storefront_sections', 'preset_key')) {
                $table->dropColumn('preset_key');
            }
        });

        Schema::table('e_template_sections', function (Blueprint $table) {
            if (Schema::hasColumn('e_template_sections', 'component_key')) {
                $table->dropColumn('component_key');
            }
        });

        Schema::table('e_section_presets', function (Blueprint $table) {
            if (Schema::hasColumn('e_section_presets', 'component_key')) {
                $table->dropColumn('component_key');
            }
        });
    }
};
