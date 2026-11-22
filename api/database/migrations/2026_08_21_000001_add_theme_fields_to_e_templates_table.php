<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('e_templates', function (Blueprint $table) {
            if (! Schema::hasColumn('e_templates', 'primary_color')) {
                $table->string('primary_color', 7)->default('#7F00FF')->after('template_name');
            }
            if (! Schema::hasColumn('e_templates', 'secondary_color')) {
                $table->string('secondary_color', 7)->default('#F5F3FF')->after('primary_color');
            }
            if (! Schema::hasColumn('e_templates', 'font_family')) {
                $table->string('font_family', 100)->default('Inter')->after('secondary_color');
            }
        });
    }

    public function down(): void
    {
        Schema::table('e_templates', function (Blueprint $table) {
            foreach (['font_family', 'secondary_color', 'primary_color'] as $column) {
                if (Schema::hasColumn('e_templates', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
