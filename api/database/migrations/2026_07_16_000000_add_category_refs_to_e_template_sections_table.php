<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('e_template_sections', function (Blueprint $table) {
            $table->json('category_refs')->nullable()->after('preset_key');
        });
    }

    public function down(): void
    {
        Schema::table('e_template_sections', function (Blueprint $table) {
            $table->dropColumn('category_refs');
        });
    }
};
