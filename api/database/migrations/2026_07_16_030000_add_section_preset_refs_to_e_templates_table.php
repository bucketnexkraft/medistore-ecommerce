<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('e_templates', function (Blueprint $table) {
            $table->json('section_preset_refs')->nullable()->after('tags');
        });
    }

    public function down(): void
    {
        Schema::table('e_templates', function (Blueprint $table) {
            $table->dropColumn('section_preset_refs');
        });
    }
};
