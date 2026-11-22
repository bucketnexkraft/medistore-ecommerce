<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('e_template_sections', function (Blueprint $table) {
            $table->string('newsletter_title', 191)->nullable()->after('subtitle');
            $table->text('newsletter_text')->nullable()->after('newsletter_title');
        });
    }

    public function down(): void
    {
        Schema::table('e_template_sections', function (Blueprint $table) {
            $table->dropColumn(['newsletter_title', 'newsletter_text']);
        });
    }
};
