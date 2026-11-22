<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('e_categories', function (Blueprint $table) {
            if (Schema::hasColumn('e_categories', 'section_preset_rules')) {
                $table->dropColumn('section_preset_rules');
            }
        });
    }

    public function down(): void
    {
        Schema::table('e_categories', function (Blueprint $table) {
            if (! Schema::hasColumn('e_categories', 'section_preset_rules')) {
                $table->json('section_preset_rules')->nullable()->after('status');
            }
        });
    }
};
